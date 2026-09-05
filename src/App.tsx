import { useEffect, useMemo, useState } from 'react'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import UpdatePrompt from './components/UpdatePrompt'
import { useSession } from './hooks/useSession'
import {
  CurrencyContext,
  formatMoneyIn,
  storeCurrency,
  storedCurrency,
} from './lib/currency'
import type { CurrencyCode } from './lib/currency'
import {
  ThemeContext,
  applyTheme,
  storeTheme,
  storedTheme,
  systemTheme,
  watchSystemTheme,
} from './lib/theme'
import type { ThemeChoice } from './lib/theme'

function App() {
  const { account, loading } = useSession()
  const [currency, setCurrency] = useState(storedCurrency)
  const [theme, setTheme] = useState(storedTheme)
  const [system, setSystem] = useState(systemTheme)

  // Only matters while the choice is `system`, but tracking it unconditionally
  // keeps `resolved` correct the moment the user switches back to it.
  useEffect(() => watchSystemTheme(setSystem), [])

  const resolved = theme === 'system' ? system : theme

  // index.html already stamped this before the first paint; re-applying covers
  // a later change, and a first load where storage was unreadable.
  useEffect(() => applyTheme(resolved), [resolved])

  const currencyValue = useMemo(
    () => ({
      currency,
      setCurrency: (code: CurrencyCode) => {
        storeCurrency(code)
        setCurrency(code)
      },
      formatMoney: (amount: number) => formatMoneyIn(currency, amount),
    }),
    [currency],
  )

  const themeValue = useMemo(() => {
    const choose = (choice: ThemeChoice) => {
      storeTheme(choice)
      setTheme(choice)
    }

    return {
      theme,
      resolved,
      setTheme: choose,
      // Reads off `resolved`, so the first click always moves away from what
      // is on screen rather than from the `system` placeholder.
      toggleTheme: () => choose(resolved === 'dark' ? 'light' : 'dark'),
    }
  }, [theme, resolved])

  return (
    <ThemeContext.Provider value={themeValue}>
      <CurrencyContext.Provider value={currencyValue}>
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            Loading…
          </div>
        ) : account ? (
          <Dashboard account={account} />
        ) : (
          <Login />
        )}
        <UpdatePrompt />
      </CurrencyContext.Provider>
    </ThemeContext.Provider>
  )
}

export default App
