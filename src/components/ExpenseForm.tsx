import { useState } from 'react'
import type { FormEvent } from 'react'
import { createCategory, createExpense } from '../lib/api'
import { today } from '../lib/format'
import type { Category } from '../types'

type Props = {
  categories: Category[]
  onAdded: () => void
  onCategoryAdded: (category: Category) => void
}

const NEW_CATEGORY = '__new__'

// Fields wrap to full width below the 640px breakpoint.
const FIELD = 'flex flex-col gap-1 max-sm:min-w-0 max-sm:basis-full'
const LABEL = 'text-xs font-semibold text-ink'

function ExpenseForm({ categories, onAdded, onCategoryAdded }: Props) {
  const [spentOn, setSpentOn] = useState(today())
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [newCategory, setNewCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addingCategory = categoryId === NEW_CATEGORY

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }

    setBusy(true)
    try {
      let targetId = categoryId

      if (addingCategory) {
        const created = await createCategory(newCategory, null)
        onCategoryAdded(created)
        targetId = created.id
      }

      await createExpense({
        category_id: targetId,
        spent_on: spentOn,
        // Guard against float drift from inputs like 19.99 + 0.1.
        amount: Math.round(value * 100) / 100,
        note: note.trim() || null,
      })

      setAmount('')
      setNote('')
      setNewCategory('')
      setCategoryId(targetId)
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the expense.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4 shadow-card"
      onSubmit={handleSubmit}
    >
      <div className={FIELD}>
        <label htmlFor="spent-on" className={LABEL}>
          Date
        </label>
        <input
          id="spent-on"
          type="date"
          className="input"
          required
          value={spentOn}
          max={today()}
          onChange={(e) => setSpentOn(e.target.value)}
        />
      </div>

      <div className={FIELD}>
        <label htmlFor="category" className={LABEL}>
          Category
        </label>
        <select
          id="category"
          className="input"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={NEW_CATEGORY}>+ New category…</option>
        </select>
      </div>

      {addingCategory && (
        <div className={FIELD}>
          <label htmlFor="new-category" className={LABEL}>
            New category name
          </label>
          <input
            id="new-category"
            type="text"
            className="input"
            required
            maxLength={40}
            placeholder="e.g. Subscriptions"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
        </div>
      )}

      <div className={FIELD}>
        <label htmlFor="amount" className={LABEL}>
          Amount
        </label>
        <input
          id="amount"
          type="number"
          className="input w-28 tabular-nums max-sm:w-full"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className={`${FIELD} min-w-40 flex-1`}>
        <label htmlFor="note" className={LABEL}>
          Note (optional)
        </label>
        <input
          id="note"
          type="text"
          className="input"
          maxLength={200}
          placeholder="What was it for?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="btn-primary max-sm:w-full"
        disabled={busy}
      >
        {busy ? 'Adding…' : 'Add expense'}
      </button>

      {error && (
        <p className="msg msg-error basis-full" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

export default ExpenseForm
