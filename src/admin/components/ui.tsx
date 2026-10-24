import { Search, Upload, X } from 'lucide-react'
import AdminIcon from './AdminIcon'
import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { supabase, readableError } from '../../lib/supabase'
import { percentChange } from '../../lib/format'

/* ---------------- page header ---------------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="heading">
      <div>
        <div className="eyebrow">RUGISTAN • STUDIO ADMIN</div>
        <h1>{title}</h1>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      {actions && <div className="hstack">{actions}</div>}
    </div>
  )
}

/* ---------------- stat tile ---------------- */
export function Stat({
  name,
  value,
  icon,
  current,
  previous,
  note,
}: {
  name: string
  value: ReactNode
  icon: string
  current?: number
  previous?: number
  note?: string
}) {
  const delta =
    typeof current === 'number' && typeof previous === 'number' ? percentChange(current, previous) : null
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{name}</span>
        <span aria-hidden="true"><AdminIcon name={icon} /></span>
      </div>
      <div className="statval">
        {value}
        {delta && <span className={`delta ${delta.tone}`}>{delta.label}</span>}
        {!delta && note && <span className="delta flat">{note}</span>}
      </div>
    </div>
  )
}

export function StatSkeleton() {
  return (
    <div className="stat">
      <div className="skeleton" style={{ height: 14, width: '55%' }} />
      <div className="skeleton" style={{ height: 30, marginTop: 18 }} />
    </div>
  )
}

/* ---------------- feedback ---------------- */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`notice ${tone === 'info' ? '' : tone}`.trim()}>{children}</div>
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="emptystate">
      <h3>{title}</h3>
      <p>{message}</p>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className="spinner" aria-hidden="true" />
      {label}
    </span>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="pad">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 14, marginBottom: 14 }}>
          {Array.from({ length: cols }, (_, c) => (
            <div className="skeleton" key={c} style={{ height: 18 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ---------------- modal ---------------- */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useLayoutEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]):not([aria-hidden="true"]), [tabindex="0"]') ?? []).filter(el => el.getClientRects().length)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first) { event.preventDefault(); dialog.current?.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ;(focusable()[0] || dialog.current)?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className="modal"
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="closex" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  busy,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button type="button" className="btn soft" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ lineHeight: 1.7, color: '#6b564a' }}>{message}</p>
    </Modal>
  )
}

/* ---------------- form helpers ---------------- */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  const fieldId = useId()
  const labelId = `${fieldId}-label`
  const child = isValidElement(children) ? children as ReactElement<{ id?: string; 'aria-labelledby'?: string; 'aria-label'?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }> : null
  const inputId = child?.props.id || fieldId
  return (
    <div className={`field ${error ? 'invalid' : ''}`.trim()}>
      <label id={labelId} htmlFor={inputId}>{label}</label>
      {child ? cloneElement(child, { id: inputId, 'aria-labelledby': child.props['aria-labelledby'] || labelId, 'aria-label': child.props['aria-label'] || label, 'aria-invalid': !!error, 'aria-describedby': error || hint ? `${fieldId}-help` : child.props['aria-describedby'] }) : children}
      {error ? <div id={`${fieldId}-help`} className="err" role="alert">{error}</div> : hint ? <div id={`${fieldId}-help`} className="hint">{hint}</div> : null}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'on' : ''}`.trim()}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  )
}

/* ---------------- image upload to Supabase Storage ---------------- */
export async function uploadMedia(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw new Error(readableError(error, 'The image could not be uploaded.'))
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

export function ImageUploader({
  folder,
  onUploaded,
  label = 'Upload Image',
  multiple = false,
  className = 'btn soft',
  onError,
}: {
  folder: string
  onUploaded: (urls: string[]) => void
  label?: string
  multiple?: boolean
  className?: string
  onError?: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handle(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is larger than 8 MB.`)
        urls.push(await uploadMedia(file, folder))
      }
      onUploaded(urls)
    } catch (err) {
      onError?.((err as Error).message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        multiple={multiple}
        hidden
        onChange={(e) => void handle(e.target.files)}
      />
      <button type="button" className={className} onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Spinner label="Uploading" /> : <><Upload size={16} aria-hidden="true" />{label.replace(/^＋\s*/, "")}</>}
      </button>
    </>
  )
}

/* ---------------- search input ---------------- */
export function SearchInput({
  value,
  onChange,
  placeholder,
  width,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  width?: number
}) {
  return (
    <label className="admin-search" style={width ? { width } : undefined}>
      <Search size={17} aria-hidden="true" />
      <input
        className="input"
        aria-label={placeholder.replace(/^[^a-zA-Z]+/, '').replace(/\.\.\.$/, '')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder.replace(/^[^a-zA-Z]+/, '')}
        type="search"
      />
    </label>
  )
}

/* ---------------- line chart from real series ---------------- */
export function LineChart({ points, labels }: { points: number[]; labels: string[] }) {
  const width = 800
  const height = 255
  const left = 30
  const right = 780
  const top = 22
  const bottom = 242

  if (!points.length) {
    return <div className="emptystate">No data for this period yet.</div>
  }

  const max = Math.max(...points, 1)
  const step = points.length > 1 ? (right - left) / (points.length - 1) : 0
  const coords = points.map((value, i) => ({
    x: left + i * step,
    y: bottom - (value / max) * (bottom - top),
  }))
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)} ${bottom} L${coords[0].x.toFixed(1)} ${bottom} Z`

  return (
    <svg className="linechart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Revenue over time">
      <defs>
        <linearGradient id="rgArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#b58c6b" stopOpacity=".29" />
          <stop offset="1" stopColor="#b58c6b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[60, 105, 150, 195, 240].map((y) => (
        <line key={y} x1={left} x2={right} y1={y} y2={y} stroke="#f1e8df" />
      ))}
      <path d={area} fill="url(#rgArea)" />
      <path d={line} fill="none" stroke="#86563e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {coords.length > 0 && <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="6" fill="#86563e" />}
      {labels.map((label, i) => (
        <text key={`${label}-${i}`} x={left + i * step} y="253" textAnchor="middle">
          {label}
        </text>
      ))}
    </svg>
  )
}
