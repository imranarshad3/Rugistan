let activeCurrency = 'USD'
let activeSymbol = '$'

export function setCurrency(code: string, symbol: string) {
  activeCurrency = code || 'USD'
  activeSymbol = symbol || '$'
}

export function getStoreCurrency() { return activeCurrency }

export function money(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${activeSymbol}${value.toLocaleString('en-US')}`
  }
}

export function plainNumber(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('en-US')
}

export function shortDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function longDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function dateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function percentChange(current: number, previous: number): { label: string; tone: 'up' | 'down' | 'flat' } {
  if (!previous) return current > 0 ? { label: 'New', tone: 'up' } : { label: 'No change', tone: 'flat' }
  const delta = ((current - previous) / previous) * 100
  if (Math.abs(delta) < 0.05) return { label: 'No change', tone: 'flat' }
  return { label: `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}%`, tone: delta > 0 ? 'up' : 'down' }
}

export function slugify(value: string) {
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function initials(first?: string | null, last?: string | null, email?: string | null) {
  const a = (first ?? '').trim()
  const b = (last ?? '').trim()
  if (a || b) return `${a.charAt(0)}${b.charAt(0)}`.toUpperCase() || '?'
  return (email ?? '?').charAt(0).toUpperCase()
}

export function fullName(first?: string | null, last?: string | null, fallback = 'Guest') {
  const name = `${first ?? ''} ${last ?? ''}`.trim()
  return name || fallback
}

/** Maps an order/review/product status onto the design's tag colours. */
export function statusTone(status: string): 'green' | 'orange' | 'blue' | 'red' | 'grey' {
  switch (status) {
    case 'delivered': case 'paid': case 'published': case 'active': return 'green'
    case 'shipped': case 'pending': case 'awaiting_confirmation': case 'draft': return 'orange'
    case 'processing': return 'blue'
    case 'cancelled': case 'rejected': case 'failed': return 'red'
    default: return 'grey'
  }
}

export function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
