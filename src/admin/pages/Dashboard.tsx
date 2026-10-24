import Select from '../../components/ui/Select'
import { useMoney } from '../../lib/currency'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { plainNumber, shortDate, statusTone, titleCase } from '../../lib/format'
import {
  loadSeries,
  loadStats,
  loadTopCategories,
  rangeBounds,
  seriesLabels,
  type DashboardStats,
  type RangeKey,
  RANGES,
} from '../lib/stats'
import { EmptyState, LineChart, Notice, PageHeader, Stat, StatSkeleton, TableSkeleton } from '../components/ui'
import type { Order } from '../../lib/types'

export default function Dashboard() {
  const money = useMoney('PKR')
  const [range, setRange] = useState<RangeKey>('30d')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [series, setSeries] = useState<{ bucket: string; revenue: number; orders: number }[]>([])
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof loadTopCategories>>>([])
  const [orders, setOrders] = useState<(Order & { items: { id: string }[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const { from, to, bucket } = rangeBounds(range)
    ;(async () => {
      try {
        const [s, se, cats, recent] = await Promise.all([
          loadStats(from, to),
          loadSeries(from, to, bucket),
          loadTopCategories(from, to),
          supabase
            .from('orders')
            .select('*, items:order_items(id)')
            .order('created_at', { ascending: false })
            .limit(5),
        ])
        if (!active) return
        setStats(s)
        setSeries(se)
        setCategories(cats)
        setOrders((recent.data ?? []) as never)
      } catch (err) {
        if (active) setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [range])

  const bucket = rangeBounds(range).bucket

  return (
    <>
      <PageHeader
        title="Welcome back, Admin"
        subtitle="Here’s what’s happening with your store today."
        actions={
          <Select className="select" value={range} onChange={(e) => setRange(e.target.value as RangeKey)} aria-label="Date range">
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                ◷ {r.label}
              </option>
            ))}
          </Select>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      <div className="stats">
        {loading || !stats ? (
          Array.from({ length: 4 }, (_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <Stat name="Total Revenue" icon="revenue" value={money(stats.revenue)} current={stats.revenue} previous={stats.revenue_prev} />
            <Stat name="Total Orders" icon="orders" value={plainNumber(stats.orders)} current={stats.orders} previous={stats.orders_prev} />
            <Stat name="Customers" icon="customers" value={plainNumber(stats.customers)} note={`${stats.customers_new} new this period`} />
            <Stat name="New Reviews" icon="reviews" value={plainNumber(stats.reviews_new)} current={stats.reviews_new} previous={stats.reviews_prev} />
          </>
        )}
      </div>

      {stats && stats.low_stock > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Notice tone="error">
            {stats.low_stock} product{stats.low_stock === 1 ? ' is' : 's are'} at or below the low-stock threshold.{' '}
            <Link to="/admin/products" style={{ textDecoration: 'underline' }}>
              Review inventory →
            </Link>
          </Notice>
        </div>
      )}

      <div className="grid cols2">
        <div className="card pad">
          <div className="hstack space">
            <h2>Sales Overview</h2>
            <span className="pill">{bucket === 'month' ? 'Monthly revenue' : 'Daily revenue'} ↗</span>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 250, marginTop: 18 }} />
          ) : series.some((s) => Number(s.revenue) > 0) ? (
            <LineChart points={series.map((s) => Number(s.revenue))} labels={seriesLabels(series, bucket)} />
          ) : (
            <EmptyState title="No revenue yet" message="Sales will be charted here as soon as orders start coming in." />
          )}
        </div>

        <div className="card pad">
          <h2 style={{ marginBottom: 23 }}>Top Collections</h2>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : categories.length === 0 ? (
            <EmptyState title="Nothing sold yet" message="Collection performance appears once orders are placed." />
          ) : (
            categories.map((c) => (
              <div className="kpi" key={c.category_id}>
                <img src={c.image_url ?? '/assets/rug_lifestyle_1.jpg'} alt="" aria-hidden="true" />
                <div style={{ flex: 1 }}>
                  <strong>{c.name}</strong>
                  <div className="progress">
                    <b style={{ width: `${Math.min(Number(c.share), 100)}%` }} />
                  </div>
                </div>
                <strong>{Number(c.share).toFixed(0)}%</strong>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 19 }}>
        <div className="hstack space" style={{ padding: '20px 22px' }}>
          <h2>Recent Orders</h2>
          <Link className="action" to="/admin/orders">
            View all orders →
          </Link>
        </div>
        {loading ? (
          <TableSkeleton cols={6} />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders yet" message="New orders from the storefront will appear here." />
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link className="action" to={`/admin/orders/${o.id}`}>
                        {o.order_number}
                      </Link>
                    </td>
                    <td>
                      {o.first_name} {o.last_name}
                    </td>
                    <td>{(o.items ?? []).length}</td>
                    <td>
                      <strong>{money(o.total)}</strong>
                    </td>
                    <td>
                      <span className={`tag ${statusTone(o.status)}`}>{titleCase(o.status)}</span>
                    </td>
                    <td>{shortDate(o.created_at)}</td>
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
