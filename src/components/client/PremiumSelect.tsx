import { useEffect, useId, useRef, useState } from 'react'

type Option = { value: string; label: string }
export default function PremiumSelect({ value, options, onChange, label }: { value: string; options: Option[]; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
  useEffect(() => { if (open) items.current[focused]?.focus() }, [open, focused])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const close = () => { setOpen(false); trigger.current?.focus() }
  return <div className="premium-select" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
    <button type="button" ref={trigger} className="premium-select-trigger" aria-label={`${label}: ${options[selectedIndex]?.label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => { setFocused(selectedIndex); setOpen(v => !v) }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setFocused(selectedIndex); setOpen(true) }
    }}>
      <svg className="sort-control-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M4 6h16M4 12h11M4 18h6" /></svg>
      <span className="premium-select-label">{label}</span><span className="premium-select-value">{options[selectedIndex]?.label}</span>
      <svg className="premium-select-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 6 5 5 5-5"/></svg>
    </button>
    {open && <div className="premium-select-menu" role="menu" id={menuId} aria-label={label} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      else if (event.key === 'ArrowDown') { event.preventDefault(); setFocused(v => (v + 1) % options.length) }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setFocused(v => (v + options.length - 1) % options.length) }
      else if (event.key === 'Home') { event.preventDefault(); setFocused(0) }
      else if (event.key === 'End') { event.preventDefault(); setFocused(options.length - 1) }
    }}>
      <div className="premium-select-heading">SORT YOUR COLLECTION</div>
      {options.map((option,index) => <button type="button" key={option.value} ref={element => { items.current[index] = element }} role="menuitemradio" aria-checked={option.value === value} tabIndex={focused === index ? 0 : -1} className={`premium-select-option ${option.value === value ? 'selected' : ''}`} onFocus={() => setFocused(index)} onClick={() => { onChange(option.value); close() }}>
        <span>{option.label}</span>{option.value === value && <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
      </button>)}
    </div>}
  </div>
}
