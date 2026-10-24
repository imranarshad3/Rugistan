import { useEffect, useId, useRef, useState } from 'react'
import { CURRENCIES, chooseCurrency, useCurrency } from '../../lib/currency'
import { useStore } from '../../context/StoreContext'

const DETAILS = {
  USD: { name: 'US Dollar', symbol: '$' },
  PKR: { name: 'Pakistani Rupee', symbol: 'Rs' },
  INR: { name: 'Indian Rupee', symbol: '₹' },
}
export default function CurrencySelector() {
  const currency = useCurrency()
  const { store } = useStore()
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const options = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const code = currency.error ? store.currency : currency.code
  const selectedIndex = Math.max(0, CURRENCIES.findIndex(c => c.code === code))

  useEffect(() => {
    if (!open) return
    options.current[focused]?.focus()
  }, [open, focused])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const close = () => { setOpen(false); trigger.current?.focus() }

  return <div className="currency-picker" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <button className="currency-trigger" ref={trigger} type="button" aria-label={`Display currency: ${code}`} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} disabled={currency.loading || Boolean(currency.error)} title={currency.error || 'Choose your currency'} onClick={() => { setFocused(selectedIndex); setOpen(v => !v) }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setFocused(selectedIndex); setOpen(true) }
    }}>
      <span>{code}</span><span className="currency-trigger-symbol">{DETAILS[code as keyof typeof DETAILS]?.symbol || store.currency_symbol}</span>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg>
    </button>
    {open && <div className="currency-menu" id={menuId} role="menu" aria-label="Display currency" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      else if (event.key === 'ArrowDown') { event.preventDefault(); setFocused(v => (v + 1) % CURRENCIES.length) }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setFocused(v => (v + CURRENCIES.length - 1) % CURRENCIES.length) }
      else if (event.key === 'Home') { event.preventDefault(); setFocused(0) }
      else if (event.key === 'End') { event.preventDefault(); setFocused(CURRENCIES.length - 1) }
    }}>
      <div className="currency-menu-heading">YOUR PREFERRED CURRENCY</div>
      {CURRENCIES.map((item,index) => <button key={item.code} type="button" role="menuitemradio" aria-checked={code === item.code} tabIndex={focused === index ? 0 : -1} ref={element => { options.current[index] = element }} className={`currency-option ${code === item.code ? 'selected' : ''}`} onFocus={() => setFocused(index)} onClick={() => { chooseCurrency(item.code); close() }}>
        <span className="currency-symbol">{DETAILS[item.code].symbol}</span>
        <span className="currency-option-copy"><strong>{item.code}</strong><span>{DETAILS[item.code].name}</span></span>
        {code === item.code && <svg className="currency-check" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}
      </button>)}
      <p className="currency-menu-note">Prices converted for your convenience.</p>
    </div>}
  </div>
}
