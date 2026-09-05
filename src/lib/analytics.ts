/**
 * The aggregations behind the charts.
 *
 * Everything here is a pure function over rows the store has already handed
 * back, so it costs nothing to re-run on every render and works offline for
 * the same reason the rest of the app does: it never asks anyone anything.
 */
import { monthBounds } from './format'
import type { Category, Expense } from '../types'

export type MonthTotal = {
  key: string // YYYY-MM
  year: number
  month: number // 0-11, as Date uses
  total: number
  count: number
}

export type CategoryTotal = {
  id: string
  name: string
  total: number
  count: number
  /** Fraction of the window's grand total, 0-1. */
  share: number
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * The inclusive day range covering `months` months and ending with the given
 * one, in the shape `listExpenses` wants.
 */
export function windowBounds(year: number, month: number, months: number) {
  // Month arithmetic through Date, so a window that reaches back past January
  // rolls the year rather than producing a negative month.
  const first = new Date(year, month - (months - 1), 1)
  return {
    from: monthBounds(first.getFullYear(), first.getMonth()).from,
    to: monthBounds(year, month).to,
  }
}

/**
 * One entry per month in the window, oldest first.
 *
 * Months with nothing spent are kept as zeroes on purpose: a gap is part of
 * the trend, and dropping the row would silently compress the axis.
 */
export function monthlyTotals(
  expenses: Expense[],
  year: number,
  month: number,
  months: number,
): MonthTotal[] {
  const buckets = new Map<string, MonthTotal>()

  for (let back = months - 1; back >= 0; back--) {
    const at = new Date(year, month - back, 1)
    const key = monthKey(at.getFullYear(), at.getMonth())
    buckets.set(key, {
      key,
      year: at.getFullYear(),
      month: at.getMonth(),
      total: 0,
      count: 0,
    })
  }

  for (const expense of expenses) {
    // spent_on is YYYY-MM-DD, so its first seven characters are the key.
    const bucket = buckets.get(expense.spent_on.slice(0, 7))
    // Anything outside the window belongs to a range the caller did not ask
    // for; ignoring it keeps the totals and the axis in agreement.
    if (!bucket) continue
    bucket.total += expense.amount
    bucket.count += 1
  }

  return [...buckets.values()]
}

/** Categories that were actually spent on, largest first. */
export function categoryTotals(
  expenses: Expense[],
  categories: Category[],
): CategoryTotal[] {
  const names = new Map(categories.map((c) => [c.id, c.name]))
  const buckets = new Map<string, CategoryTotal>()

  for (const expense of expenses) {
    let bucket = buckets.get(expense.category_id)
    if (!bucket) {
      bucket = {
        id: expense.category_id,
        // A category deleted on another device can still have expenses here.
        name: names.get(expense.category_id) ?? 'Uncategorised',
        total: 0,
        count: 0,
        share: 0,
      }
      buckets.set(expense.category_id, bucket)
    }
    bucket.total += expense.amount
    bucket.count += 1
  }

  const rows = [...buckets.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  )

  const grand = rows.reduce((sum, row) => sum + row.total, 0)
  if (grand > 0) for (const row of rows) row.share = row.total / grand

  return rows
}

/**
 * The top of an axis that clears `peak` and splits into `divisions` round
 * ticks.
 *
 * The tick step is what gets rounded, not the top: rounding the top first
 * gives clean ends and ugly middles ($10K in four steps of $2,500), and can
 * leave the tallest column at a third of the plot for want of a nicer number
 * to stop at.
 */
export function axisMax(peak: number, divisions: number) {
  if (peak <= 0) return 0
  const rough = peak / divisions
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].find((s) => rough <= s * magnitude)!
  return step * magnitude * divisions
}
