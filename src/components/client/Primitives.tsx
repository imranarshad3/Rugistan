import Icon from './Icon'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../context/StoreContext'

/** Fades content in once it scrolls into view. Honours reduced-motion via CSS. */
export function Reveal({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || shown) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [shown])

  return (
    <Tag ref={ref as never} className={`reveal ${shown ? 'in' : ''} ${className}`.trim()}>
      {children}
    </Tag>
  )
}

export function Logo({ to = '/', className = '' }: { to?: string | null; className?: string }) {
  const { store } = useStore()
  const inner = <img className="brand-reference-logo" src={store.logo_url || '/assets/rugistan-wordmark.webp'} alt={store.name} />

  if (!to) return <span className={`logo ${className}`.trim()}>{inner}</span>
  return (
    <Link to={to} className={`logo ${className}`.trim()} aria-label={`${store.name} home`}>
      {inner}
    </Link>
  )
}

export function Stars({ rating = 5, className = '' }: { rating?: number; className?: string }) {
  const rounded = Math.round(rating)
  return (
    <span className={`stars ${className}`.trim()} aria-label={`${rating} out of 5`}>
      {'★★★★★'.slice(0, rounded)}
      <span style={{ opacity: 0.28 }}>{'★★★★★'.slice(0, 5 - rounded)}</span>
    </span>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  linkLabel,
  linkTo,
}: {
  eyebrow: string
  title: ReactNode
  description?: string
  linkLabel?: string
  linkTo?: string
}) {
  return (
    <div className="headrow">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {(description || linkTo) && (
        <div>
          {description && <p className="subtitle">{description}</p>}
          {linkTo && (
            <p style={{ textAlign: 'right', marginTop: 9 }}>
              <Link className="inline-link" to={linkTo}>
                {linkLabel ?? 'View all →'}
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span className="spinner" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  )
}

export function EmptyState({
  title,
  message,
  actionLabel,
  actionTo,
  onAction,
}: {
  title: string
  message: string
  actionLabel?: string
  actionTo?: string
  onAction?: () => void
}) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden="true"><Icon name="spark" /></span>
      <h3>{title}</h3>
      <p className="subtitle" style={{ margin: '0 auto 22px' }}>
        {message}
      </p>
      {actionTo && (
        <Link className="btn" to={actionTo}>
          {actionLabel}
        </Link>
      )}
      {!actionTo && onAction && (
        <button type="button" className="btn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function Accordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  return (
    <div className="accord">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span aria-hidden="true" style={{ transition: 'transform .3s', transform: open ? 'rotate(180deg)' : 'none' }}>
          ⌄
        </span>
      </button>
      <div id={panelId} className={`panel ${open ? 'open' : ''}`} aria-hidden={!open} inert={!open}>
        <div>{children}</div>
      </div>
    </div>
  )
}

export function QuantityPicker({
  value,
  max,
  onChange,
  compact = false,
}: {
  value: number
  max: number
  onChange: (next: number) => void
  compact?: boolean
}) {
  return (
    <span className="qty" style={compact ? { transform: 'scale(.92)', transformOrigin: 'left center' } : undefined}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Reduce quantity">
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        +
      </button>
    </span>
  )
}
