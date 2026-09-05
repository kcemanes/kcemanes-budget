import { useState } from 'react'
import { useCurrency } from '../lib/currency'
import { formatMonth, formatMonthShort } from '../lib/format'
import { axisMax } from '../lib/analytics'
import type { MonthTotal } from '../lib/analytics'
import { useElementWidth } from '../hooks/useElementWidth'

type Props = {
  months: MonthTotal[]
  /** Accessible name for the figure; the visible heading is the caller's. */
  label: string
}

// Drawn at one unit per pixel — see useElementWidth for why.
const PAD_LEFT = 54 // room for a compact money tick
const PAD_RIGHT = 6
const PAD_TOP = 20 // room for the direct label above the tallest column
const PLOT_H = 180
const AXIS_H = 26
const HEIGHT = PAD_TOP + PLOT_H + AXIS_H

const MAX_BAR = 24 // marks stay thin; the band's leftover is air
const TICKS = [0, 0.25, 0.5, 0.75, 1] // four divisions

/** Rounded at the data end, square where it meets the baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  return (
    `M${x} ${y + h}` +
    `L${x} ${y + r}Q${x} ${y} ${x + r} ${y}` +
    `L${x + w - r} ${y}Q${x + w} ${y} ${x + w} ${y + r}` +
    `L${x + w} ${y + h}Z`
  )
}

function MonthlyChart({ months, label }: Props) {
  const { formatMoney, formatMoneyCompact } = useCurrency()
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const width = useElementWidth(box)

  const peak = Math.max(...months.map((m) => m.total), 0)
  const max = axisMax(peak, TICKS.length - 1)
  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT)
  const band = months.length > 0 ? plotW / months.length : 0
  const barW = Math.min(MAX_BAR, band * 0.6)

  // Below these widths the text would collide with its neighbours, so the
  // tooltip and the table carry those values instead of clipping them.
  const labelStep = band >= 30 ? 1 : 2
  const showValues = band >= 40

  const peakIndex = months.findIndex((m) => m.total === peak)
  const lastIndex = months.length - 1
  const labelled = new Set<number>()
  if (showValues && peak > 0) {
    labelled.add(peakIndex)
    // The most recent month is the other one worth calling out — unless it is
    // next to the peak, where the two labels would overlap.
    if (months[lastIndex].total > 0 && Math.abs(lastIndex - peakIndex) > 1) {
      labelled.add(lastIndex)
    }
  }

  const y = (value: number) =>
    PAD_TOP + PLOT_H - (max > 0 ? (value / max) * PLOT_H : 0)

  const hovered = active === null ? null : months[active]

  return (
    <div ref={setBox} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          // A group rather than an img: role="img" would make the focusable
          // bands inside it presentational, and they carry the per-month
          // readout. The table view below is the full text equivalent.
          role="group"
          aria-label={label}
          className="block"
        >
          {TICKS.map((fraction) => {
            const at = y(max * fraction)
            return (
              <g key={fraction}>
                <line
                  x1={PAD_LEFT}
                  x2={width - PAD_RIGHT}
                  y1={at}
                  y2={at}
                  className="stroke-line"
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={at}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted text-[11px] tabular-nums"
                >
                  {formatMoneyCompact(max * fraction)}
                </text>
              </g>
            )
          })}

          {months.map((month, index) => {
            const x = PAD_LEFT + band * index
            const barX = x + (band - barW) / 2
            // A non-zero month always gets a visible sliver rather than
            // disappearing into the baseline.
            const h = month.total > 0 ? Math.max(2, PAD_TOP + PLOT_H - y(month.total)) : 0
            const top = PAD_TOP + PLOT_H - h

            return (
              <g key={month.key}>
                {active === index && (
                  <rect
                    x={x}
                    y={PAD_TOP}
                    width={band}
                    height={PLOT_H}
                    className="fill-accent-soft"
                  />
                )}
                {h > 0 && (
                  <path
                    d={columnPath(barX, top, barW, h)}
                    className="fill-accent"
                  />
                )}
                {labelled.has(index) && (
                  <text
                    x={barX + barW / 2}
                    y={top - 7}
                    textAnchor="middle"
                    className="fill-ink text-[11px] font-medium tabular-nums"
                  >
                    {formatMoneyCompact(month.total)}
                  </text>
                )}
                {(index - lastIndex) % labelStep === 0 && (
                  <text
                    x={x + band / 2}
                    y={PAD_TOP + PLOT_H + 17}
                    textAnchor="middle"
                    className="fill-muted text-[11px]"
                  >
                    {formatMonthShort(month.year, month.month)}
                  </text>
                )}
                {/* The hit target is the whole band, not the painted column. */}
                <rect
                  x={x}
                  y={PAD_TOP}
                  width={band}
                  height={PLOT_H}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${formatMonth(month.year, month.month)}: ${formatMoney(month.total)}`}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
              </g>
            )
          })}

          <line
            x1={PAD_LEFT}
            x2={width - PAD_RIGHT}
            y1={PAD_TOP + PLOT_H}
            y2={PAD_TOP + PLOT_H}
            className="stroke-line"
            strokeWidth={1}
          />
        </svg>
      )}

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-card"
          style={{
            left: Math.min(
              Math.max(PAD_LEFT + band * (active! + 0.5), 60),
              width - 60,
            ),
            // Sits above the cap, but never above the plot: a tall column
            // would otherwise push it out over the heading.
            top: Math.max(y(hovered.total) - 10, PAD_TOP + 32),
          }}
        >
          <div className="font-semibold text-ink tabular-nums">
            {formatMoney(hovered.total)}
          </div>
          <div className="text-muted">
            {formatMonth(hovered.year, hovered.month)} · {hovered.count}{' '}
            {hovered.count === 1 ? 'expense' : 'expenses'}
          </div>
        </div>
      )}
    </div>
  )
}

export default MonthlyChart
