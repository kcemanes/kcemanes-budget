import { useMemo, useState } from 'react'
import CategoryChart from './CategoryChart'
import MonthlyChart from './MonthlyChart'
import { categoryTotals, monthlyTotals, windowBounds } from '../lib/analytics'
import { useCurrency } from '../lib/currency'
import {
  formatMonth,
  formatMonthAbbr,
  formatShare,
} from '../lib/format'
import { useBudgetData } from '../hooks/useBudgetData'

const now = new Date()

/**
 * The window always ends with the current month, which is why this view does
 * not follow the month stepper: a trend that stops halfway through history
 * because the reader was browsing March is a trap, not a feature.
 */
const RANGES = [3, 6, 12] as const

const TH =
  'border-b border-line px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-[0.06em] text-muted'
const TD = 'border-b border-line px-2.5 py-2 text-ink'

function Charts({ userId }: { userId: string }) {
  const { formatMoney } = useCurrency()
  const [range, setRange] = useState<(typeof RANGES)[number]>(6)

  const year = now.getFullYear()
  const month = now.getMonth()

  const bounds = useMemo(
    () => windowBounds(year, month, range),
    [year, month, range],
  )

  const { categories, expenses, loading, error } = useBudgetData(
    userId,
    bounds.from,
    bounds.to,
  )

  const months = useMemo(
    () => monthlyTotals(expenses, year, month, range),
    [expenses, year, month, range],
  )
  const byCategory = useMemo(
    () => categoryTotals(expenses, categories),
    [expenses, categories],
  )

  const total = months.reduce((sum, entry) => sum + entry.total, 0)
  const first = months[0]
  const rangeLabel = `${formatMonthAbbr(first.year, first.month)} – ${formatMonthAbbr(year, month)}`

  return (
    <>
      {/* One filter row, above everything it scopes. */}
      <div className="my-6 flex items-center gap-2 text-sm">
        <span className="text-muted">Last</span>
        {RANGES.map((option) => (
          <button
            key={option}
            type="button"
            className="btn-toggle"
            aria-pressed={option === range}
            onClick={() => setRange(option)}
          >
            {option} months
          </button>
        ))}
      </div>

      {error && (
        <p className="msg msg-error my-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="my-8 text-center text-muted">Loading…</p>
      ) : (
        <>
          <section className="my-8 text-center">
            <h2 className="text-base font-medium text-muted">
              Spent in the last {range} months
            </h2>
            {/* The hero figure: proportional digits, not tabular — equal-width
                digits read loose at this size. */}
            <p className="text-5xl font-semibold tracking-[-1px] text-ink">
              {formatMoney(total)}
            </p>
            <p className="mt-1.5 text-xs text-muted">
              {rangeLabel} · {formatMoney(total / range)} a month on average
            </p>
          </section>

          {total === 0 ? (
            <p className="my-12 text-center text-muted">
              Nothing recorded in this range yet. Add an expense and the charts
              will fill in.
            </p>
          ) : (
            <>
              <section className="my-10">
                <h3 className="text-sm font-semibold text-ink">By month</h3>
                <p className="mb-3 text-xs text-muted">
                  Total spent each month, {rangeLabel}.
                </p>
                <MonthlyChart
                  months={months}
                  label={`Total spent each month, ${rangeLabel}`}
                />
                <details className="mt-3">
                  <summary className="btn-link cursor-pointer text-muted">
                    Show as table
                  </summary>
                  <table className="mt-2 w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th scope="col" className={TH}>
                          Month
                        </th>
                        <th scope="col" className={`${TH} text-right`}>
                          Expenses
                        </th>
                        <th scope="col" className={`${TH} text-right`}>
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((entry) => (
                        <tr key={entry.key}>
                          <td className={TD}>
                            {formatMonth(entry.year, entry.month)}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {entry.count}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {formatMoney(entry.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </section>

              <section className="my-10">
                <h3 className="text-sm font-semibold text-ink">By category</h3>
                <p className="mb-3 text-xs text-muted">
                  Where the {formatMoney(total)} went, {rangeLabel}.
                </p>
                <CategoryChart
                  categories={byCategory}
                  label={`Total spent per category, ${rangeLabel}`}
                />
                <details className="mt-3">
                  <summary className="btn-link cursor-pointer text-muted">
                    Show as table
                  </summary>
                  <table className="mt-2 w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th scope="col" className={TH}>
                          Category
                        </th>
                        <th scope="col" className={`${TH} text-right`}>
                          Expenses
                        </th>
                        <th scope="col" className={`${TH} text-right`}>
                          Share
                        </th>
                        <th scope="col" className={`${TH} text-right`}>
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory.map((entry) => (
                        <tr key={entry.id}>
                          <td className={TD}>{entry.name}</td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {entry.count}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {formatShare(entry.share)}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {formatMoney(entry.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </section>
            </>
          )}
        </>
      )}
    </>
  )
}

export default Charts
