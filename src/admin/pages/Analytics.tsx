import {ArrowUpRight,ChartNoAxesCombined,ShoppingBag,Layers,PackageCheck} from 'lucide-react'
import {Link} from 'react-router-dom'
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
import { LineChart, Notice, PageHeader, Stat, StatSkeleton } from '../components/ui'

export default function Analytics() {
  const money = useMoney('PKR')
  const [range, setRange] = useState<RangeKey>('12m')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [series, setSeries] = useState<{ bucket: string; revenue: number; orders: number }[]>([])
  const [products, setProducts] = useState<Awaited<ReturnType<typeof loadTopProducts>>>([])
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof loadTopCategories>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry,setRetry]=useState(0)

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
  }, [range,retry])

  if (error) return <section className="analytics-page"><PageHeader title="Store Analytics" subtitle="Your studio, in numbers." /><Notice tone="error">{error}</Notice><button type="button" className="btn soft" onClick={() => setRetry(v=>v+1)}>Try again</button></section>

  const bucket = rangeBounds(range).bucket
  const statusEntries = Object.entries(stats?.by_status ?? {})
  const statusTotal = statusEntries.reduce((sum, [, n]) => sum + Number(n), 0)

  return (
    <section className="analytics-page" aria-label="Store analytics">
      <PageHeader
        title="Store Analytics"
        subtitle="A considered view of your revenue, customers and collection."
        actions={
          <Select className="select" value={range} onChange={(e) => setRange(e.target.value as RangeKey)} aria-label="Date range">
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      <div className="stats analytics-metrics" aria-label="Key performance indicators">
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

      <div className="analytics-primary">
        <div className="card pad analytics-revenue">
          <div className="analytics-card-heading">
            <div><span className="eyebrow">SALES PERFORMANCE</span><h2>Revenue over time</h2></div>
            <span className="pill">{RANGES.find((r) => r.key === range)?.label}</span>
          </div>
          <div className="analytics-revenue-total"><strong>{loading?'—':money(stats?.revenue??0)}</strong><span>Revenue in the selected period</span></div>
          {loading ? (
            <div className="skeleton" style={{ height: 200, marginTop: 18 }} />
          ) : series.some((s) => Number(s.revenue) > 0) ? (
            <LineChart points={series.map((s) => Number(s.revenue))} labels={seriesLabels(series, bucket)} />
          ) : (
            <div className="analytics-chart-empty"><ChartNoAxesCombined size={28} aria-hidden="true"/><strong>Your next chapter starts here</strong><p>Revenue will appear as your first orders arrive.</p><span>No sales recorded for this period</span></div>
          )}
        </div>

        <div className="card pad analytics-bestsellers">
          <div className="analytics-card-heading"><div><span className="eyebrow">COLLECTION HIGHLIGHTS</span><h2>Best sellers</h2></div><ShoppingBag size={21} aria-hidden="true"/></div>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : products.length === 0 ? (
            <div className="analytics-empty"><span className="analytics-empty-icon"><ShoppingBag size={26} aria-hidden="true"/></span><h3>A collection ready to be discovered</h3><p>Your most loved pieces will appear here after the first sale.</p><Link className="inline-link" to="/admin/products">View your products <ArrowUpRight size={15} aria-hidden="true"/></Link></div>
          ) : (
            products.map((p,index) => (
              <div className="kpi analytics-product" key={p.product_id}><span className="analytics-rank">{String(index+1).padStart(2,'0')}</span>
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

      <div className="analytics-secondary">
        <div className="card pad">
          <div className="analytics-card-heading"><h2>Order activity</h2><ShoppingBag size={20} aria-hidden="true"/></div>
          {statusTotal === 0 ? (
            <div className="analytics-empty compact"><p>Every order tells a story. Your fulfilment overview will appear here.</p><Link className="inline-link" to="/admin/orders">View orders <ArrowUpRight size={15} aria-hidden="true"/></Link></div>
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
          <div className="analytics-card-heading"><h2>Top collections</h2><Layers size={20} aria-hidden="true"/></div>
          {categories.length === 0 ? (
            <div className="analytics-empty compact"><p>Discover which collections resonate most as sales grow.</p><Link className="inline-link" to="/admin/categories">Explore collections <ArrowUpRight size={15} aria-hidden="true"/></Link></div>
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
          <div className="analytics-card-heading"><h2>Catalogue health</h2><PackageCheck size={20} aria-hidden="true"/></div>
          {loading || !stats ? (
            <div className="skeleton" style={{ height: 120, marginTop: 14 }} />
          ) : (
            <>
              <dl className="analytics-health"><div><dt>Products in your catalogue</dt><dd>{plainNumber(stats.products_total)}</dd></div><div><dt>Low stock</dt><dd>{plainNumber(stats.low_stock)}</dd></div><div><dt>Reviews to approve</dt><dd>{plainNumber(stats.reviews_pending)}</dd></div></dl>
              <div className="progress" style={{ marginTop: 28, height: 12 }}>
                <b
                  style={{
                    width: `${stats.products_total ? Math.max(0,Math.min(100,Math.round(((stats.products_total - stats.low_stock) / stats.products_total) * 100))) : 0}%`,
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

      <div className="analytics-data-note">
        <Notice>
          Every figure above is calculated from live order and catalogue data. Traffic and conversion metrics need a web
          analytics provider, which is not connected to this store.
        </Notice>
      </div>
    </section>
  )
}
