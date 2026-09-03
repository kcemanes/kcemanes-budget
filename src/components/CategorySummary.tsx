import { formatMoney } from '../lib/format'
import type { Category, Expense } from '../types'

type Props = {
  expenses: Expense[]
  categories: Category[]
}

function CategorySummary({ expenses, categories }: Props) {
  const totals = new Map<string, number>()
  for (const expense of expenses) {
    totals.set(
      expense.category_id,
      (totals.get(expense.category_id) ?? 0) + expense.amount,
    )
  }

  const rows = categories
    .map((category) => ({
      category,
      spent: totals.get(category.id) ?? 0,
    }))
    .filter((row) => row.spent > 0 || row.category.monthly_budget !== null)
    .sort((a, b) => b.spent - a.spent)

  if (rows.length === 0) return null

  // Bars are relative to the largest number on screen, so the biggest
  // category always fills the track.
  const scale = Math.max(
    ...rows.map((row) => Math.max(row.spent, row.category.monthly_budget ?? 0)),
  )

  return (
    <ul className="my-7 flex list-none flex-col gap-3.5 p-0">
      {rows.map(({ category, spent }) => {
        const budget = category.monthly_budget
        const over = budget !== null && spent > budget

        return (
          <li key={category.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
              <span className="font-medium text-ink">{category.name}</span>
              <span
                className={
                  over
                    ? 'font-semibold text-overspend-strong tabular-nums'
                    : 'text-ink tabular-nums'
                }
              >
                {formatMoney(spent)}
                {budget !== null && (
                  <span className="font-normal text-muted">
                    {' '}
                    of {formatMoney(budget)}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
              <div
                className={`h-full rounded-full ${over ? 'bg-overspend' : 'bg-accent-mid'}`}
                style={{ width: `${Math.min(100, (spent / scale) * 100)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default CategorySummary
