import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

type Props = SelectHTMLAttributes<HTMLSelectElement>
type Option = { value: string; label: string; disabled: boolean }
function text(node: ReactNode): string {
  return Children.toArray(node).map(item => isValidElement<{ children?: ReactNode }>(item) ? text(item.props.children) : String(item)).join('')
}
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap(item => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(item)) return []
    if (item.type === 'option') return [{ value: String(item.props.value ?? text(item.props.children)), label: text(item.props.children).replace(/^◷\s*/, ''), disabled: Boolean(item.props.disabled) }]
    return optionsFrom(item.props.children)
  })
}
/** Custom listbox with a real select retained for forms, validation and change events. */
export default function Select({ children, className = '', value, defaultValue, disabled, onChange, ...props }: Props) {
  const options = optionsFrom(children)
  const native = useRef<HTMLSelectElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [local, setLocal] = useState(String(defaultValue ?? ''))
  const selected = String(value ?? local)
  const index = Math.max(0, options.findIndex(option => option.value === selected))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(index)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 220, maxHeight: 300 })
  const id = useId()
  const typeahead = useRef({ value: '', time: 0 })
  function choose(next: number) {
    const option = options[next]
    if (!option || option.disabled || !native.current) return
    setLocal(option.value)
    native.current.value = option.value
    native.current.dispatchEvent(new Event('change', { bubbles: true }))
    setOpen(false)
    trigger.current?.focus()
  }
  function move(direction: number) {
    let next = active
    for (let i = 0; i < options.length; i++) {
      next = (next + direction + options.length) % options.length
      if (!options[next].disabled) { setActive(next); break }
    }
  }
  useLayoutEffect(() => {
    if (!open || !trigger.current) return
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect()
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 24)
      const below = window.innerHeight - rect.bottom - 14
      const above = rect.top - 14
      const height = Math.min(320, Math.max(below, above))
      const up = below < Math.min(240, options.length * 42 + 52) && above > below
      setPosition({ top: up ? Math.max(12, rect.top - Math.min(height, options.length * 42 + 52) - 8) : rect.bottom + 8, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width, maxHeight: height })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, options.length])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])
  useEffect(() => { if (open) menu.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active, open])
  const label = props['aria-label'] || props.name || 'Select option'
  return <span className="modern-select-wrap">
    <select {...props} id={props.id ? `${props.id}-native` : undefined} className="modern-select-native" ref={native} value={value ?? local} disabled={disabled} onChange={onChange} tabIndex={-1} aria-hidden="true" onInvalid={event => { event.preventDefault(); trigger.current?.focus() }}>
      {children}
    </select>
    <button type="button" id={props.id} ref={trigger} className={`modern-select-trigger ${className}`} role="combobox" aria-invalid={props['aria-invalid']} aria-describedby={props['aria-describedby']} aria-required={props.required || undefined} aria-label={label} aria-labelledby={props['aria-labelledby']} aria-expanded={open && !disabled} aria-controls={id} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled}
      onClick={() => { setActive(index); setOpen(!open) }} onBlur={event => { if (!menu.current?.contains(event.relatedTarget)) setOpen(false) }}
      onKeyDown={event => {
        if (event.key === 'Tab') { setOpen(false); return }
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
          event.preventDefault()
          if (!open) { setActive(index); setOpen(true); return }
          if (event.key === 'ArrowDown') move(1)
          else if (event.key === 'ArrowUp') move(-1)
          else if (event.key === 'Home') setActive(options.findIndex(option => !option.disabled))
          else if (event.key === 'End') setActive(options.findLastIndex(option => !option.disabled))
          else choose(active)
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const now = Date.now()
          const query = now - typeahead.current.time > 700 ? event.key : typeahead.current.value + event.key
          typeahead.current = { value: query.toLowerCase(), time: now }
          const match = options.findIndex(option => !option.disabled && option.label.toLowerCase().startsWith(query.toLowerCase()))
          if (match >= 0) { setActive(match); setOpen(true) }
        }
      }}>
      <span className="modern-select-value">{options.find(option => option.value === selected)?.label || options[0]?.label || 'Choose an option'}</span><ChevronDown className="modern-select-arrow" size={16} strokeWidth={1.7} aria-hidden="true" />
    </button>
    {open && !disabled && createPortal(<div ref={menu} className="modern-select-menu" id={id} role="listbox" aria-label={label} style={{ ...position, maxHeight: position.maxHeight }} onPointerDown={event => event.preventDefault()}>
      <div className="modern-select-caption">{label}</div>
      {options.map((option, i) => <div key={`${option.value}-${i}`} id={`${id}-${i}`} role="option" aria-selected={option.value === selected} aria-disabled={option.disabled || undefined} data-option-index={i} className={`modern-select-option ${option.value === selected ? 'selected' : ''} ${active === i ? 'focused' : ''} ${option.disabled ? 'disabled' : ''}`} onPointerMove={() => { if (!option.disabled) setActive(i) }} onClick={() => choose(i)}>
        <span>{option.label}</span>{option.value === selected && <Check size={16} strokeWidth={2} aria-hidden="true" />}
      </div>)}
    </div>, document.body)}
  </span>
}
