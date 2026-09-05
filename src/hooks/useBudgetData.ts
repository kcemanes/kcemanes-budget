import { useEffect, useState } from 'react'
import { listCategories, listExpenses } from '../lib/api'
import { subscribe } from '../lib/store'
import type { Category, Expense } from '../types'

/**
 * The categories, plus every expense in a day range, kept current.
 *
 * The store changes from underneath: a write from a component, or a sync
 * landing rows from another device. One subscription re-reads for both, so a
 * caller never threads a reload callback down through the tree.
 *
 * Reads are local and quick, so `loading` is really only true for the very
 * first read of a range. A later range change keeps the previous rows on
 * screen until the new ones arrive rather than blanking the view.
 */
export function useBudgetData(userId: string, from: string, to: string) {
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  useEffect(() => subscribe(() => setReloadAt((n) => n + 1)), [])

  useEffect(() => {
    // Guards against a slow response for a range the user already left.
    let cancelled = false

    async function run() {
      try {
        const [cats, rows] = await Promise.all([
          listCategories(userId),
          listExpenses(userId, from, to),
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
  }, [userId, from, to, reloadAt])

  // setCategories is handed back so a component that has just created one can
  // show it without waiting for the re-read the write will trigger anyway.
  return { categories, expenses, loading, error, setCategories }
}
