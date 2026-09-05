/**
 * The local-first store: the only thing the UI reads from.
 *
 * Every read is served from IndexedDB, so a month renders whether or not
 * there is a network. Every write lands in IndexedDB immediately and is
 * appended to an *outbox* — an ordered log of changes that ./sync replays to
 * Supabase when a connection is available. The UI never waits on the network
 * and never needs to know whether it is online.
 *
 * Row ids are generated here rather than by Postgres. That is what makes a
 * write work offline: the expense has a real, final id the moment it is
 * created, so nothing has to be re-pointed when it eventually syncs, and a
 * replay that runs twice writes the same row rather than a duplicate.
 */
import * as db from './db'
import type { Category, Expense } from '../types'

export type LocalCategory = Category & { user_id: string }
export type LocalExpense = Expense & { user_id: string; created_at: string }

/** A change waiting to reach Supabase. Replayed in `seq` order. */
export type OutboxOp = {
  seq: number
  user_id: string
  kind: 'category.create' | 'expense.create' | 'expense.delete'
  row: Record<string, unknown>
}

/**
 * Categories every new account starts with, so the expense form is usable
 * before the user has set anything up.
 */
const STARTER_CATEGORIES = [
  'Groceries',
  'Rent',
  'Transport',
  'Utilities',
  'Dining out',
  'Other',
]

function uuid(): string {
  // randomUUID is secure-context only, which covers https and localhost — but
  // a plain-http preview on a LAN address is neither, and would throw.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 1
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

// ---------------------------------------------------------------------------
// Change notification
//
// Writes and syncs both mutate the store behind the UI's back, so components
// subscribe once and re-read rather than threading a reload callback down
// through every level.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>()

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyChanged() {
  for (const listener of listeners) listener()
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const byName = (a: LocalCategory, b: LocalCategory) =>
  a.name.localeCompare(b.name)

export async function loadCategories(userId: string): Promise<Category[]> {
  const rows = await db.readAll<LocalCategory>('categories')
  return rows.filter((row) => row.user_id === userId).sort(byName)
}

export async function loadExpenses(
  userId: string,
  from: string,
  to: string,
): Promise<Expense[]> {
  const rows = await db.readAll<LocalExpense>('expenses')
  return rows
    .filter(
      (row) =>
        row.user_id === userId && row.spent_on >= from && row.spent_on <= to,
    )
    .sort(
      (a, b) =>
        b.spent_on.localeCompare(a.spent_on) ||
        b.created_at.localeCompare(a.created_at),
    )
}

export async function readOutbox(userId: string): Promise<OutboxOp[]> {
  const rows = await db.readAll<OutboxOp>('outbox')
  return rows
    .filter((row) => row.user_id === userId)
    .sort((a, b) => a.seq - b.seq)
}

// ---------------------------------------------------------------------------
// Writes — local first, then queued
// ---------------------------------------------------------------------------

export async function addCategory(
  userId: string,
  name: string,
  monthlyBudget: number | null,
): Promise<Category> {
  const row: LocalCategory = {
    id: uuid(),
    user_id: userId,
    name: name.trim(),
    monthly_budget: monthlyBudget,
  }

  await db.put('categories', row)
  await db.append({
    user_id: userId,
    kind: 'category.create',
    row: { id: row.id, name: row.name, monthly_budget: row.monthly_budget },
  })

  notifyChanged()
  return row
}

export async function addExpense(
  userId: string,
  input: {
    category_id: string
    spent_on: string
    amount: number
    note: string | null
  },
): Promise<Expense> {
  const row: LocalExpense = {
    id: uuid(),
    user_id: userId,
    created_at: new Date().toISOString(),
    ...input,
  }

  await db.put('expenses', row)
  await db.append({
    user_id: userId,
    kind: 'expense.create',
    // created_at is pushed too, so the order rows were entered in survives a
    // replay that happens minutes or days later.
    row: {
      id: row.id,
      category_id: row.category_id,
      spent_on: row.spent_on,
      amount: row.amount,
      note: row.note,
      created_at: row.created_at,
    },
  })

  notifyChanged()
  return row
}

export async function removeExpense(userId: string, id: string): Promise<void> {
  await db.remove('expenses', [id])

  const queued = await readOutbox(userId)
  const pendingCreate = queued.find(
    (op) => op.kind === 'expense.create' && op.row.id === id,
  )

  if (pendingCreate) {
    // Added and deleted without ever reaching the server: drop the create
    // rather than queue a delete for a row Supabase has never seen.
    await db.remove('outbox', [pendingCreate.seq])
  } else {
    await db.append({ user_id: userId, kind: 'expense.delete', row: { id } })
  }

  notifyChanged()
}

/**
 * Seeds the starter categories for an account that has none. Called only once
 * a pull has confirmed the server side is genuinely empty — seeding on any
 * empty read would re-seed on every cold offline start.
 */
export async function seedStarterCategories(userId: string): Promise<void> {
  for (const name of STARTER_CATEGORIES) {
    const row: LocalCategory = {
      id: uuid(),
      user_id: userId,
      name,
      monthly_budget: null,
    }
    await db.put('categories', row)
    await db.append({
      user_id: userId,
      kind: 'category.create',
      row: { id: row.id, name, monthly_budget: null },
    })
  }
  // One notification for the batch, rather than six re-reads of the same list.
  notifyChanged()
}

// ---------------------------------------------------------------------------
// Sync support
// ---------------------------------------------------------------------------

/**
 * Replaces local rows with what the server just returned, keeping any local
 * change that has not been pushed yet.
 *
 * Rows the outbox still owns are layered back on top, so a pull that overlaps
 * an unsynced write does not make the user's row flicker out. A change the
 * server *rejected* has already been dropped from the outbox by this point,
 * so this is also what quietly reverts it.
 */
export async function replaceFromRemote(
  userId: string,
  remote: { categories: LocalCategory[]; expenses: LocalExpense[] },
): Promise<void> {
  const queued = await readOutbox(userId)

  const [localCategories, localExpenses] = await Promise.all([
    db.readAll<LocalCategory>('categories'),
    db.readAll<LocalExpense>('expenses'),
  ])
  const localCategoryById = new Map(localCategories.map((row) => [row.id, row]))
  const localExpenseById = new Map(localExpenses.map((row) => [row.id, row]))

  const keptCategories: LocalCategory[] = []
  const keptExpenses: LocalExpense[] = []
  const deletedLocally = new Set<string>()

  for (const op of queued) {
    const id = op.row.id as string
    if (op.kind === 'category.create') {
      const row = localCategoryById.get(id)
      if (row) keptCategories.push(row)
    } else if (op.kind === 'expense.create') {
      const row = localExpenseById.get(id)
      if (row) keptExpenses.push(row)
    } else {
      deletedLocally.add(id)
    }
  }

  const remoteCategoryIds = new Set(remote.categories.map((row) => row.id))
  const remoteExpenseIds = new Set(remote.expenses.map((row) => row.id))

  // Rows belonging to another account are left untouched: this browser may
  // hold a second user's data, and a pull for one must not wipe the other.
  await db.replaceAll('categories', [
    ...localCategories.filter((row) => row.user_id !== userId),
    ...remote.categories,
    ...keptCategories.filter((row) => !remoteCategoryIds.has(row.id)),
  ])

  await db.replaceAll('expenses', [
    ...localExpenses.filter((row) => row.user_id !== userId),
    ...remote.expenses.filter((row) => !deletedLocally.has(row.id)),
    ...keptExpenses.filter((row) => !remoteExpenseIds.has(row.id)),
  ])

  notifyChanged()
}

export async function dropOps(seqs: number[]): Promise<void> {
  if (seqs.length) await db.remove('outbox', seqs)
}

/**
 * Repoints everything that referenced a locally-created category at a
 * different one, and drops the local category row.
 *
 * This is the repair for the one collision the schema can produce: two
 * devices, both offline, both adding a category with the same name. Names are
 * unique per account, so the second one to reach the server is refused — but
 * the expenses queued behind it are perfectly good, and would otherwise be
 * refused too for pointing at a category that no longer exists. Sending them
 * to the surviving category is what the user meant either way.
 */
export async function remapCategory(
  userId: string,
  fromId: string,
  toId: string,
): Promise<void> {
  const queued = await readOutbox(userId)
  for (const op of queued) {
    if (op.row.category_id === fromId) {
      await db.put('outbox', { ...op, row: { ...op.row, category_id: toId } })
    }
  }

  const rows = await db.readAll<LocalExpense>('expenses')
  const touched = rows
    .filter((row) => row.user_id === userId && row.category_id === fromId)
    .map((row) => ({ ...row, category_id: toId }))
  if (touched.length) await db.putAll('expenses', touched)

  await db.remove('categories', [fromId])
  notifyChanged()
}

/** Everything this browser holds, dropped. Used on an explicit sign-out. */
export async function clearLocalData(): Promise<void> {
  await db.clearAll()
  notifyChanged()
}
