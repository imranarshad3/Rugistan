import { convertAmount } from './currencyMath'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { getStoreCurrency, money as baseMoney } from './format'

export const CURRENCIES = [
  { code: 'USD', label: 'USD $', locale: 'en-US' },
  { code: 'PKR', label: 'PKR Rs', locale: 'en-PK' },
  { code: 'INR', label: 'INR ₹', locale: 'en-IN' },
] as const
export type DisplayCurrency = typeof CURRENCIES[number]['code']
type Rates = Record<string, number>
type CurrencyState = { code: DisplayCurrency; rates: Rates; loading: boolean; error: string | null }
const PREFERENCE_KEY = 'rugistan.display-currency'
const CACHE_KEY = 'rugistan.exchange-rates.v1'
const listeners = new Set<() => void>()
let state: CurrencyState = { code: 'PKR', rates: { USD: 1 }, loading: true, error: null }
let pending: Promise<void> | null = null
let loaded = false
const validCode = (code: string | null): code is DisplayCurrency => CURRENCIES.some(c => c.code === code)
function emit(patch: Partial<CurrencyState>) { state = { ...state, ...patch }; listeners.forEach(fn => fn()) }
function readPreference(): DisplayCurrency {
  try { const code = localStorage.getItem(PREFERENCE_KEY); return validCode(code) ? code : 'PKR' } catch { return 'PKR' }
}
function validRates(rates: unknown): rates is Rates {
  if (!rates || typeof rates !== 'object') return false
  return CURRENCIES.every(({code}) => Number.isFinite((rates as Rates)[code]) && (rates as Rates)[code] > 0)
}
async function loadRates() {
  if (loaded) return
  if (pending) return pending
  pending = (async () => {
    try {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
        if (cached && validRates(cached.rates) && Number.isFinite(cached.expires) && cached.expires > Date.now()) {
          emit({ rates: cached.rates, code: readPreference(), loading: false }); loaded = true; return
        }
      } catch { /* Storage can be unavailable without preventing shopping. */ }
      const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('Unable to load exchange rates')
      const data = await response.json()
      if (data.result !== 'success' || data.base_code !== 'USD' || !validRates(data.rates)) throw new Error('Invalid exchange rates')
      const expires = Math.min(Date.now() + 86400000, Number(data.time_next_update_unix) * 1000 || Date.now() + 86400000)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: data.rates, expires })) } catch { /* Optional cache. */ }
      emit({ rates: data.rates, code: readPreference(), loading: false, error: null })
      loaded = true
    } catch {
      emit({ loading: false, error: 'Currency conversion is temporarily unavailable. Prices remain in the store currency.' })
      loaded = true
    } finally { pending = null }
  })()
  return pending
}
export function chooseCurrency(code: string) {
  if (!validCode(code) || state.loading || !state.rates[code]) return
  try { localStorage.setItem(PREFERENCE_KEY, code) } catch { /* Preference is optional. */ }
  emit({ code })
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => state
export function useCurrency() {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(() => { void loadRates() }, [])
  return current
}

export function useMoney(displayCode?: DisplayCurrency, sourceCurrency?: string) {
  const current = useCurrency()
  return useCallback((amount: number | string | null | undefined): string => {
    const value = convertAmount(Number(amount ?? 0), sourceCurrency || getStoreCurrency(), displayCode || current.code, current.rates)
    if (value === null || current.error) {
      if (!sourceCurrency) return baseMoney(amount)
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: sourceCurrency }).format(Number(amount ?? 0))
    }
    const code = displayCode || current.code
    const locale = CURRENCIES.find(c => c.code === code)?.locale || 'en-US'
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value)
  }, [current, displayCode, sourceCurrency])
}
