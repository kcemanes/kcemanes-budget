import { createContext, useContext } from 'react'

/**
 * The palette lives in index.css; this module only decides which one is
 * active by stamping `data-theme` on <html>.
 *
 * `system` is the default and follows the OS until the user picks a side,
 * after which the choice is remembered.
 */
export type ThemeChoice = 'system' | 'light' | 'dark'

/** What `data-theme` ends up as — `system` is resolved away before painting. */
export type ResolvedTheme = 'light' | 'dark'

const DEFAULT_THEME: ThemeChoice = 'system'

// Shared with the pre-paint script in index.html. Change both together.
const STORAGE_KEY = 'budget.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === 'system' ? systemTheme() : choice
}

/**
 * The installed app's title bar takes its colour from a meta tag rather than
 * from CSS, so it has to be told separately. These mirror --color-ground in
 * each palette; the pre-paint script in index.html repeats them.
 */
const BAR_COLOURS: Record<ResolvedTheme, string> = {
  light: '#f8fafc',
  dark: '#0b1220',
}

/** Hands the resolved theme to CSS, and to the browser chrome around it. */
export function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', BAR_COLOURS[resolved])
}

/** The remembered choice. Storage throws in browsers with cookies blocked. */
export function storedTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isThemeChoice(saved)) return saved
  } catch {
    // Fall through to the default.
  }
  return DEFAULT_THEME
}

export function storeTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // A setting we cannot persist is not worth failing a render over.
  }
}

/**
 * Calls back when the OS flips, so a `system` choice keeps up without a
 * reload. Returns an unsubscribe.
 */
export function watchSystemTheme(onChange: (resolved: ResolvedTheme) => void) {
  const query = window.matchMedia(DARK_QUERY)
  const handle = (event: MediaQueryListEvent) =>
    onChange(event.matches ? 'dark' : 'light')

  query.addEventListener('change', handle)
  return () => query.removeEventListener('change', handle)
}

type ThemeSetting = {
  /** What the user picked, which may be `system`. */
  theme: ThemeChoice
  /** What is actually on screen. */
  resolved: ResolvedTheme
  setTheme: (choice: ThemeChoice) => void
  /** Flips to the opposite of what is on screen, leaving `system` behind. */
  toggleTheme: () => void
}

// The default keeps a component rendering outside the provider sane; App
// supplies the real, persisted setting.
export const ThemeContext = createContext<ThemeSetting>({
  theme: DEFAULT_THEME,
  resolved: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}
