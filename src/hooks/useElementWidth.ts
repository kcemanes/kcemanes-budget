import { useEffect, useState } from 'react'

/**
 * The rendered width of an element, in CSS pixels.
 *
 * Charts here draw at 1 SVG unit per pixel rather than scaling a fixed
 * viewBox, because a scaled viewBox scales the axis text with it — readable
 * on a laptop, three pixels tall on a phone. Knowing the real width lets the
 * geometry adapt and leaves the type alone.
 *
 * Returns 0 until the first measurement, which is the caller's cue that there
 * is nothing sensible to lay out yet.
 */
export function useElementWidth(element: HTMLElement | null) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      // contentRect excludes padding and borders, which is what the plot has
      // to fit inside.
      setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return width
}
