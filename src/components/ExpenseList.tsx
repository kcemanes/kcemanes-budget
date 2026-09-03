import { useState } from 'react'
import { deleteExpense } from '../lib/api'
import { formatDay, formatMoney } from '../lib/format'
import type { Category, Expense } from '../types'

type Props = {
  expenses: Expense[]
  categories: Category[]
  onChanged: () => void
}

const TH = 'border-b border-line px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-[0.06em] text-muted'
const TD = 'border-b border-line px-2.5 py-2.5 text-ink'

function ExpenseList({ expenses, categories, onChanged }: Props) {
  const [removing, setRemoving] = useState<string | null>(null)
  const names = new Map(categories.map((c) => [c.id, c.name]))

  async function handleDelete(id: string) {
    setRemoving(id)
    try {
      await deleteExpense(id)
      onChanged()
    } finally {
      setRemoving(null)
    }
  }

  if (expenses.length === 0) {
    return (
      <p className="my-8 text-center text-muted">No expenses this month yet.</p>
    )
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th scope="col" className={TH}>
            Date
          </th>
          <th scope="col" className={TH}>
            Category
          </th>
          <th scope="col" className={TH}>
            Note
          </th>
          <th scope="col" className={`${TH} text-right`}>
            Amount
          </th>
          <th scope="col" className={TH}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {expenses.map((expense) => (
          <tr key={expense.id} className="hover:bg-accent-soft">
            <td className={`${TD} whitespace-nowrap`}>
              {formatDay(expense.spent_on)}
            </td>
            <td className={TD}>
              {names.get(expense.category_id) ?? 'Uncategorised'}
            </td>
            <td className={`${TD} text-muted`}>{expense.note}</td>
            <td className={`${TD} text-right font-medium tabular-nums`}>
              {formatMoney(expense.amount)}
            </td>
            <td className={`${TD} text-right`}>
              <button
                type="button"
                className="btn-link text-overspend-strong disabled:opacity-50"
                disabled={removing === expense.id}
                onClick={() => handleDelete(expense.id)}
              >
                {removing === expense.id ? 'Removing…' : 'Delete'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default ExpenseList
