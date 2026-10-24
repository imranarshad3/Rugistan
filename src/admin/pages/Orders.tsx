import { csvCell } from '../../lib/csv'
import Select from '../../components/ui/Select'
import { useMoney } from '../../lib/currency'
import { Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { plainNumber, shortDate, statusTone, titleCase } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { EmptyState, PageHeader, SearchInput, Stat, StatSkeleton, TableSkeleton } from '../components/ui'
import { loadStats, rangeBounds, type DashboardStats } from '../lib/stats'
import type { Order, OrderStatus } from '../../lib/types'

const TABS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All Orders' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

type Row = Order & { items: { id: string; quantity: number }[] }

export default function Orders() {
  const money = useMoney('PKR')
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = rangeBounds('30d')
    const [{ data, error: readError }, s] = await Promise.all([
      supabase.from('orders').select('*, items:order_items(id,quantity)').order('created_at', { ascending: false }),
      loadStats(from, to).catch(() => null),
    ])
    if (readError) { setLoadError('The latest records could not be loaded. Please try again.'); setLoading(false); return }
    setLoadError('')
    setRows((data ?? []) as never)
    setStats(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const now = Date.now()
    const windows: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
    return rows.filter((o) => {
      if (tab !== 'all' && o.status !== tab) return false
      if (term && !`${o.order_number} ${o.first_name} ${o.last_name} ${o.email}`.toLowerCase().includes(term)) return false
      if (dateFilter !== 'all') {
        const days = windows[dateFilter]
        if (days && now - new Date(o.created_at).getTime() > days * 86_400_000) return false
      }
      return true
    })
  }, [rows, tab, search, dateFilter])

  function exportCsv() {
    const header = ['Order', 'Customer', 'Email', 'Items', 'Subtotal', 'Shipping', 'Discount', 'Total', 'Status', 'Payment', 'Date']
    const lines = visible.map((o) =>
      [
        o.order_number,
        `${o.first_name} ${o.last_name}`,
        o.email,
        (o.items ?? []).reduce((sum, i) => sum + i.quantity, 0),
        o.subtotal,
        o.shipping_amount,
        o.discount_amount,
        o.total,
        o.status,
        o.payment_status,
        new Date(o.created_at).toISOString(),
      ]
        .map(csvCell)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rugistan-orders-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${visible.length} order${visible.length === 1 ? '' : 's'}.`)
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: rows.length }
    for (const o of rows) map[o.status] = (map[o.status] ?? 0) + 1
    return map
  }, [rows])

  return (
    <>
      {loadError && <div className="notice error" role="alert">{loadError} <button type="button" className="action" onClick={() => void load()}>Try again</button></div>}
      <PageHeader
        title="Orders"
        subtitle="View, filter and manage every customer purchase."
        actions={
          <button type="button" className="btn soft" onClick={exportCsv} disabled={visible.length === 0}>
            <Download size={16} aria-hidden="true" /> Export Orders
          </button>
        }
      />

      <div className="stats">
        {loading || !stats ? (
          Array.from({ length: 4 }, (_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <Stat name="Order Value (30d)" icon="revenue" value={money(stats.revenue)} current={stats.revenue} previous={stats.revenue_prev} />
            <Stat name="Orders (30d)" icon="orders" value={plainNumber(stats.orders)} current={stats.orders} previous={stats.orders_prev} />
            <Stat name="Average Order" icon="clock" value={money(stats.aov)} note="Last 30 days" />
            <Stat name="Repeat Customers" icon="repeat" value={`${stats.repeat_rate}%`} note="All time" />
          </>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '22px 24px 0' }}>
          <div className="tabs">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
                {t.label}
                {counts[t.key] ? ` (${counts[t.key]})` : ''}
              </button>
            ))}
          </div>
          <div className="searchrow" style={{ marginTop: 18 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="⌕  Search order ID or customer..." />
            <Select className="select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} aria-label="Filter by date">
              <option value="all">All Dates</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <TableSkeleton cols={7} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length ? 'No orders match these filters' : 'No orders yet'}
            message={
              rows.length
                ? 'Try a different tab, search term or date range.'
                : 'Orders placed on the storefront will appear here in real time.'
            }
          />
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.order_number}</strong>
                    </td>
                    <td>
                      {o.first_name} {o.last_name}
                      <div className="tiny">{o.email}</div>
                    </td>
                    <td>{(o.items ?? []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)}</td>
                    <td>
                      <strong className="money">{money(o.total)}</strong>
                    </td>
                    <td>
                      <span className={`tag ${statusTone(o.status)}`}>{titleCase(o.status)}</span>
                    </td>
                    <td>
                      <span className={`tag ${statusTone(o.payment_status)}`}>{titleCase(o.payment_status)}</span>
                    </td>
                    <td>{shortDate(o.created_at)}</td>
                    <td>
                      <Link className="action" to={`/admin/orders/${o.id}`}>
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
