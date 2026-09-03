import { createContext, useContext } from 'react'

/**
 * Amounts are stored as plain numbers, so switching currency relabels the
 * existing figures — it does not convert them.
 */
export const CURRENCIES = [
  { code: 'CAD', label: 'CAD $', locale: 'en-CA' },
  { code: 'USD', label: 'USD $', locale: 'en-US' },
  { code: 'PHP', label: 'PHP ₱', locale: 'en-PH' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

const DEFAULT_CURRENCY: CurrencyCode = 'CAD'
const STORAGE_KEY = 'budget.currency'

const formatters = new Map<CurrencyCode, Intl.NumberFormat>()

function formatterFor(code: CurrencyCode) {
  let formatter = formatters.get(code)
  if (!formatter) {
    const { locale } = CURRENCIES.find((c) => c.code === code)!
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
    })
    formatters.set(code, formatter)
  }
  return formatter
}

export function formatMoneyIn(code: CurrencyCode, amount: number) {
  return formatterFor(code).format(amount)
}

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return CURRENCIES.some((c) => c.code === value)
}

/** The remembered choice. Storage throws in browsers with cookies blocked. */
export function storedCurrency(): CurrencyCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isCurrencyCode(saved)) return saved
  } catch {
    // Fall through to the default.
  }
  return DEFAULT_CURRENCY
}

export function storeCurrency(code: CurrencyCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // A setting we cannot persist is not worth failing a render over.
  }
}

type CurrencySetting = {
  currency: CurrencyCode
  setCurrency: (code: CurrencyCode) => void
  formatMoney: (amount: number) => string
}

// The default keeps money rendering sanely if a component is used outside the
// provider; App supplies the real, persisted setting.
export const CurrencyContext = createContext<CurrencySetting>({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
  formatMoney: (amount) => formatMoneyIn(DEFAULT_CURRENCY, amount),
})

export function useCurrency() {
  return useContext(CurrencyContext)
}
