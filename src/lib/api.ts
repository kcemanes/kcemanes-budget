import { supabase } from './supabase'
import type { Category, Expense } from '../types'

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

function unwrap<T>(result: { data: T | null; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

export async function listCategories(): Promise<Category[]> {
  const rows = unwrap(
    await supabase
      .from('categories')
      .select('id, name, monthly_budget')
      .order('name'),
  )

  // First run for this account: seed the starters, then re-read.
  if (rows.length === 0) {
    unwrap(
      await supabase
        .from('categories')
        .insert(STARTER_CATEGORIES.map((name) => ({ name }))),
    )
    return unwrap(
      await supabase
        .from('categories')
        .select('id, name, monthly_budget')
        .order('name'),
    )
  }

  return rows
}

export async function createCategory(
  name: string,
  monthlyBudget: number | null,
): Promise<Category> {
  const rows = unwrap(
    await supabase
      .from('categories')
      .insert({ name: name.trim(), monthly_budget: monthlyBudget })
      .select('id, name, monthly_budget'),
  )
  return rows[0]
}

export async function listExpenses(from: string, to: string): Promise<Expense[]> {
  const rows = unwrap(
    await supabase
      .from('expenses')
      .select('id, category_id, spent_on, amount, note')
      .gte('spent_on', from)
      .lte('spent_on', to)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false }),
  )

  // numeric() can come back as a string once values get large enough.
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }))
}

export async function createExpense(input: {
  category_id: string
  spent_on: string
  amount: number
  note: string | null
}): Promise<void> {
  unwrap(await supabase.from('expenses').insert(input).select('id'))
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
