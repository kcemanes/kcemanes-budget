import { useTheme } from '../lib/theme'

// Sized to sit level with .btn-quiet in the header row.
const BUTTON = 'btn-quiet h-9 w-9 rounded-full p-0 grid place-items-center'

// Two 20px glyphs on a 24px grid, stroked in currentColor so they pick up
// .btn-quiet's text colour and its hover.
function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.1M12 19.3v2.1M4.4 4.4l1.5 1.5M18.1 18.1l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.4 19.6l1.5-1.5M18.1 5.9l1.5-1.5" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.1 14.6A8.5 8.5 0 1 1 9.4 3.9a6.8 6.8 0 0 0 10.7 10.7Z" />
    </svg>
  )
}

/**
 * Flips between light and dark. The icon shows the theme being offered, not
 * the current one, which is what the label says too.
 */
function ThemeToggle() {
  const { resolved, toggleTheme } = useTheme()
  const target = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={BUTTON}
      onClick={toggleTheme}
      aria-label={`Switch to ${target} theme`}
      title={`Switch to ${target} theme`}
    >
      {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

export default ThemeToggle
