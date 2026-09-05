import { useEffect, useMemo, useState } from 'react'
import CategorySummary from './CategorySummary'
import ExpenseForm from './ExpenseForm'
import ExpenseList from './ExpenseList'
import InstallButton from './InstallButton'
import SyncStatus from './SyncStatus'
import ThemeToggle from './ThemeToggle'
import { listCategories, listExpenses } from '../lib/api'
import { signOut } from '../lib/auth'
import type { Account } from '../lib/auth'
import { CURRENCIES, useCurrency } from '../lib/currency'
import type { CurrencyCode } from '../lib/currency'
import { formatMonth, monthBounds } from '../lib/format'
import { subscribe } from '../lib/store'
import { dismissRejected, startSync } from '../lib/sync'
import { useSyncState } from '../hooks/useSyncState'
import type { Category, Expense } from '../types'

const now = new Date()

// Round stepper; colours and hover come from .btn-quiet.
const STEP =
  'btn-quiet h-9 w-9 rounded-full p-0 text-xl leading-none disabled:opacity-35'

function Dashboard({ account }: { account: Account }) {
  const { currency, setCurrency, formatMoney } = useCurrency()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sync = useSyncState()

  const [reloadAt, setReloadAt] = useState(0)

  const bounds = useMemo(() => monthBounds(year, month), [year, month])

  // Push and pull for as long as this account is on screen.
  useEffect(() => startSync(account.id), [account.id])

  // The store changes from underneath: a write from this component, or a sync
  // landing rows from another device. One subscription re-reads for both.
  useEffect(() => subscribe(() => setReloadAt((n) => n + 1)), [])

  useEffect(() => {
    // Guards against a slow response for a month the user already left.
    let cancelled = false

    async function run() {
      try {
        const [cats, rows] = await Promise.all([
          listCategories(account.id),
          listExpenses(account.id, bounds.from, bounds.to),
        ])
        if (cancelled) return
        setCategories(cats)
        setExpenses(rows)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : 'Could not load your budget.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [account.id, bounds, reloadAt])

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  function shiftMonth(delta: number) {
    const shifted = new Date(year, month + delta, 1)
    setYear(shifted.getFullYear())
    setMonth(shifted.getMonth())
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  // Reads are local and quick, so the spinner is really only for the very
  // first launch of an account, where there is nothing on this device yet and
  // the opening sync is what will produce it.
  const firstEverSync =
    sync.lastSyncedAt === null &&
    sync.status === 'syncing' &&
    categories.length === 0

  async function handleSignOut() {
    if (
      sync.pending > 0 &&
      !window.confirm(
        `${sync.pending} change${sync.pending === 1 ? '' : 's'} on this device ` +
          'have not reached the server yet. Signing out erases them. Sign out anyway?',
      )
    ) {
      return
    }
    await signOut()
  }

  return (
    <div className="mx-auto w-full max-w-[860px] flex-1 px-5 pt-6 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <h1 className="text-2xl font-medium tracking-[-0.4px] text-ink">
          Budget
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">{account.email}</span>
          <SyncStatus />
          <label htmlFor="currency" className="sr-only">
            Currency
          </label>
          <select
            id="currency"
            className="input py-1.5"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          >
            {CURRENCIES.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <InstallButton />
          <ThemeToggle />
          <button
            type="button"
            className="btn-quiet"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="my-6 flex items-center justify-center gap-6">
        <button
          type="button"
          className={STEP}
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="min-w-48 text-center">
          <h2 className="text-base font-medium text-muted">
            {formatMonth(year, month)}
          </h2>
          <p className="text-4xl font-semibold tracking-[-1px] text-ink tabular-nums">
            {formatMoney(total)}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
          </p>
        </div>
        <button
          type="button"
          className={STEP}
          onClick={() => shiftMonth(1)}
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          ›
        </button>
      </section>

      {error && (
        <p className="msg msg-error my-4" role="alert">
          {error}
        </p>
      )}

      {sync.rejected.length > 0 && (
        <div className="msg msg-notice my-4" role="alert">
          <p className="font-semibold">
            The server refused {sync.rejected.length === 1 ? 'a change' : 'some changes'},
            so {sync.rejected.length === 1 ? 'it has' : 'they have'} been undone here:
          </p>
          <ul className="mt-1.5 list-disc pl-5">
            {sync.rejected.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-link mt-2 font-semibold"
            onClick={dismissRejected}
          >
            Dismiss
          </button>
        </div>
      )}

      {loading || firstEverSync ? (
        <p className="my-8 text-center text-muted">Loading…</p>
      ) : (
        <>
          <ExpenseForm
            userId={account.id}
            categories={categories}
            onCategoryAdded={(category) =>
              setCategories((current) =>
                [...current, category].sort((a, b) =>
                  a.name.localeCompare(b.name),
                ),
              )
            }
          />
          <CategorySummary expenses={expenses} categories={categories} />
          <ExpenseList
            userId={account.id}
            expenses={expenses}
            categories={categories}
          />
        </>
      )}
    </div>
  )
}

export default Dashboard
