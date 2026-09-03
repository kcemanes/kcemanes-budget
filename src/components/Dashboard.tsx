import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import CategorySummary from './CategorySummary'
import ExpenseForm from './ExpenseForm'
import ExpenseList from './ExpenseList'
import { listCategories, listExpenses } from '../lib/api'
import { formatMoney, formatMonth, monthBounds } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Category, Expense } from '../types'

const now = new Date()

// Round stepper; colours and hover come from .btn-quiet.
const STEP =
  'btn-quiet h-9 w-9 rounded-full p-0 text-xl leading-none disabled:opacity-35'

function Dashboard({ session }: { session: Session }) {
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reloadAt, setReloadAt] = useState(0)

  const bounds = useMemo(() => monthBounds(year, month), [year, month])

  // Children call this after a write; bumping the counter re-runs the effect.
  const reload = () => setReloadAt((n) => n + 1)

  useEffect(() => {
    // Guards against a slow response for a month the user already left.
    let cancelled = false

    async function run() {
      try {
        const [cats, rows] = await Promise.all([
          listCategories(),
          listExpenses(bounds.from, bounds.to),
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
  }, [bounds, reloadAt])

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  function shiftMonth(delta: number) {
    const shifted = new Date(year, month + delta, 1)
    setYear(shifted.getFullYear())
    setMonth(shifted.getMonth())
  }

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth()

  return (
    <div className="mx-auto w-full max-w-[860px] flex-1 px-5 pt-6 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <h1 className="text-2xl font-medium tracking-[-0.4px] text-ink">
          Budget
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{session.user.email}</span>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => supabase.auth.signOut()}
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

      {loading ? (
        <p className="my-8 text-center text-muted">Loading…</p>
      ) : (
        <>
          <ExpenseForm
            categories={categories}
            onAdded={reload}
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
            expenses={expenses}
            categories={categories}
            onChanged={reload}
          />
        </>
      )}
    </div>
  )
}

export default Dashboard
