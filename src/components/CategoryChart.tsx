import { useState } from 'react'
import { useCurrency } from '../lib/currency'
import { formatShare } from '../lib/format'
import type { CategoryTotal } from '../lib/analytics'

type Props = {
  categories: CategoryTotal[]
  label: string
}

/**
 * Ranked horizontal bars, one hue.
 *
 * Categories are nominal — reordering them changes nothing — so they are one
 * series in one colour rather than eight. Colouring each bar by its own value
 * would spend the identity channel restating what the bar length already says.
 */
function CategoryChart({ categories, label }: Props) {
  const { formatMoney } = useCurrency()
  const [active, setActive] = useState<string | null>(null)

  // Bars are relative to the largest, so the top category fills the track.
  const scale = Math.max(...categories.map((c) => c.total), 0)

  return (
    <ul
      role="group"
      aria-label={label}
      className="flex list-none flex-col gap-3 p-0"
    >
      {categories.map((category) => {
        const width = scale > 0 ? (category.total / scale) * 100 : 0
        const on = active === category.id

        return (
          <li
            key={category.id}
            className="grid grid-cols-[minmax(4.5rem,7rem)_1fr_auto] items-center gap-3 text-sm"
            tabIndex={0}
            role="img"
            aria-label={`${category.name}: ${formatMoney(category.total)}, ${formatShare(category.share)} of the total`}
            onPointerEnter={() => setActive(category.id)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(category.id)}
            onBlur={() => setActive(null)}
          >
            <span className="truncate font-medium text-ink" title={category.name}>
              {category.name}
            </span>

            <div className="relative h-2.5 rounded-[4px] bg-accent-soft">
              <div
                className={`h-full rounded-r-[4px] ${on ? 'bg-accent-strong' : 'bg-accent'}`}
                style={{ width: `${width}%` }}
              />
              {on && (
                <div
                  className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-card"
                  style={{
                    left: `clamp(4rem, ${width}%, calc(100% - 4rem))`,
                  }}
                >
                  <div className="font-semibold text-ink tabular-nums">
                    {formatMoney(category.total)}
                  </div>
                  <div className="text-muted">
                    {formatShare(category.share)} of total · {category.count}{' '}
                    {category.count === 1 ? 'expense' : 'expenses'}
                  </div>
                </div>
              )}
            </div>

            <span className="text-ink tabular-nums">
              {formatMoney(category.total)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default CategoryChart
