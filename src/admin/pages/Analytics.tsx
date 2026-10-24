import Select from '../../components/ui/Select'
import { useMoney } from '../../lib/currency'
import { useEffect, useState } from 'react'
import { plainNumber, titleCase } from '../../lib/format'
import {
  loadSeries,
  loadStats,
  loadTopCategories,
  loadTopProducts,
  rangeBounds,
  seriesLabels,
  RANGES,
  type DashboardStats,
  type RangeKey,
} from '../lib/stats'
import { EmptyState, LineChart, Notice, PageHeader, Stat, StatSkeleton } from '../components/ui'

export default function Analytics() {
  const money = useMoney('PKR')
  const [range, setRange] = useState<RangeKey>('12m')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [series, setSeries] = useState<{ bucket: string; revenue: number; orders: number }[]>([])
  const [products, setProducts] = useState<Awaited<ReturnType<typeof loadTopProducts>>>([])
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof loadTopCategories>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const { from, to, bucket } = rangeBounds(range)
    ;(async () => {
      try {
        const [s, se, tp, tc] = await Promise.all([
          loadStats(from, to),
          loadSeries(from, to, bucket),
          loadTopProducts(from, to),
          loadTopCategories(from, to),
        ])
        if (!active) return
        setStats(s)
        setSeries(se)
        setProducts(tp)
        setCategories(tc)
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

  if (error) return <><PageHeader title="Store insights" subtitle="Data is temporarily unavailable" /><Notice tone="error">{error}</Notice><button type="button" className="btn soft" onClick={() => window.location.reload()}>Try again</button></>

  const bucket = rangeBounds(range).bucket
  const statusEntries = Object.entries(stats?.by_status ?? {})
  const statusTotal = statusEntries.reduce((sum, [, n]) => sum + Number(n), 0)

  return (
    <>
      <PageHeader
        title="Store Analytics"
        subtitle="An overview of revenue, customer activity, and product performance."
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
            <Stat name="Revenue" icon="revenue" value={money(stats.revenue)} current={stats.revenue} previous={stats.revenue_prev} />
            <Stat name="Orders" icon="orders" value={plainNumber(stats.orders)} current={stats.orders} previous={stats.orders_prev} />
            <Stat name="Average Order Value" icon="clock" value={money(stats.aov)} note="Selected period" />
            <Stat name="Repeat Customer Rate" icon="repeat" value={`${stats.repeat_rate}%`} note="All time" />
          </>
        )}
      </div>

      <div className="grid cols2">
        <div className="card pad">
          <div className="hstack space">
            <h2>Revenue Over Time</h2>
            <span className="pill">{RANGES.find((r) => r.key === range)?.label}</span>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 250, marginTop: 18 }} />
          ) : series.some((s) => Number(s.revenue) > 0) ? (
            <LineChart points={series.map((s) => Number(s.revenue))} labels={seriesLabels(series, bucket)} />
          ) : (
            <EmptyState title="No revenue in this period" message="The chart fills in as orders are placed." />
          )}
        </div>

        <div className="card pad">
          <h2 style={{ marginBottom: 18 }}>Top Selling Products</h2>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : products.length === 0 ? (
            <EmptyState title="Nothing sold yet" message="Your best sellers will be listed here." />
          ) : (
            products.map((p) => (
              <div className="kpi" key={p.product_id}>
                <img src={p.image_url ?? '/assets/rug_lifestyle_1.jpg'} alt="" aria-hidden="true" />
                <div style={{ flex: 1 }}>
                  <strong>{p.name}</strong>
                  <p className="tiny">{p.units} units sold</p>
                </div>
                <strong>{money(p.revenue)}</strong>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid cols3" style={{ marginTop: 19 }}>
        <div className="card pad">
          <h2>Orders by Status</h2>
          {statusTotal === 0 ? (
            <p className="sub">No orders recorded yet.</p>
          ) : (
            <>
              <p className="sub">
                {statusEntries
                  .map(([status, n]) => `${titleCase(status)} ${Math.round((Number(n) / statusTotal) * 100)}%`)
                  .join(' · ')}
              </p>
              {statusEntries.map(([status, n]) => (
                <div key={status} style={{ marginTop: 14 }}>
                  <div className="hstack space tiny">
                    <span>{titleCase(status)}</span>
                    <span>{n}</span>
                  </div>
                  <div className="progress">
                    <b style={{ width: `${(Number(n) / statusTotal) * 100}%` }} />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="card pad">
          <h2>Top Collections</h2>
          {categories.length === 0 ? (
            <p className="sub">Collection performance appears once orders are placed.</p>
          ) : (
            categories.map((c) => (
              <div key={c.category_id} style={{ marginTop: 14 }}>
                <div className="hstack space tiny">
                  <span>{c.name}</span>
                  <span>{money(c.revenue)}</span>
                </div>
                <div className="progress">
                  <b style={{ width: `${Math.min(Number(c.share), 100)}%` }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card pad">
          <h2>Catalogue Health</h2>
          {loading || !stats ? (
            <div className="skeleton" style={{ height: 120, marginTop: 14 }} />
          ) : (
            <>
              <p className="sub">
                {stats.products_total} product{stats.products_total === 1 ? '' : 's'} · {stats.low_stock} low on stock ·{' '}
                {stats.reviews_pending} review{stats.reviews_pending === 1 ? '' : 's'} awaiting approval
              </p>
              <div className="progress" style={{ marginTop: 28, height: 12 }}>
                <b
                  style={{
                    width: `${stats.products_total ? Math.round(((stats.products_total - stats.low_stock) / stats.products_total) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="tiny" style={{ marginTop: 10 }}>
                Share of the catalogue comfortably in stock.
              </p>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 19 }}>
        <Notice>
          Every figure above is calculated from live order and catalogue data. Traffic and conversion metrics need a web
          analytics provider, which is not connected to this store.
        </Notice>
      </div>
    </>
  )
}
