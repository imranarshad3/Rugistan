import {ArrowUpRight,Download,RefreshCw,Plus,PackageCheck,MessageSquare,ShoppingBag,Layers,ChartNoAxesCombined} from 'lucide-react'
import {csvCell} from '../../lib/csv'
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
  loadTopProducts,
  rangeBounds,
  seriesLabels,
  type DashboardStats,
  type RangeKey,
  RANGES,
} from '../lib/stats'
import { EmptyState, LineChart, Notice, PageHeader, Stat, StatSkeleton, TableSkeleton } from '../components/ui'
import type { Order } from '../../lib/types'

type RecentOrder=Pick<Order,'id'|'order_number'|'first_name'|'last_name'|'total'|'status'|'created_at'>&{items:{id:string}[]}
type InventoryRow={id:string;name:string;stock_quantity:number;low_stock_at:number;product_images:{url:string;sort_order:number}[]}
export default function Dashboard() {
  const money = useMoney('PKR')
  const [range, setRange] = useState<RangeKey>('30d')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [series, setSeries] = useState<{ bucket: string; revenue: number; orders: number }[]>([])
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof loadTopCategories>>>([])
  const [orders, setOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh,setRefresh]=useState(0)
  const [metric,setMetric]=useState<'revenue'|'orders'>('revenue')
  const [updated,setUpdated]=useState<Date|null>(null)
  const [inventory,setInventory]=useState<InventoryRow[]>([])
  const [bestsellers,setBestsellers]=useState<Awaited<ReturnType<typeof loadTopProducts>>>([])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const { from, to, bucket } = rangeBounds(range)
    ;(async () => {
      try {
        const [s, se, cats, recent, stock, top] = await Promise.all([
          loadStats(from, to),
          loadSeries(from, to, bucket),
          loadTopCategories(from, to),
          supabase
            .from('orders')
            .select('id,order_number,first_name,last_name,total,status,created_at,items:order_items(id)')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('products').select('id,name,stock_quantity,low_stock_at,product_images(url,sort_order)').eq('status','published').order('stock_quantity').order('id').limit(6),
          loadTopProducts(from,to,4),
        ])
        if(!s)throw new Error('Store statistics could not be loaded. Please refresh.')
        if(recent.error)throw recent.error
        if(stock.error)throw stock.error
        if (!active) return
        setInventory((stock.data??[]) as InventoryRow[])
        setBestsellers(top)
        setUpdated(new Date())
        setStats(s)
        setSeries(se)
        setCategories(cats)
        setOrders(recent.data??[])
      } catch (err) {
        if (active) setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [range,refresh])

  if (error) return <><PageHeader title="Store insights" subtitle="Data is temporarily unavailable" /><Notice tone="error">{error}</Notice><button type="button" className="btn soft" onClick={() => setRefresh(v=>v+1)}>Try again</button></>

  const bucket = rangeBounds(range).bucket
  const rangeLabel=RANGES.find(r=>r.key===range)!.label
  const statuses=Object.entries(stats?.by_status??{}).filter(([,n])=>Number(n)>0)
  const statusTotal=statuses.reduce((total,[,n])=>total+Number(n),0)
  function downloadSummary(){
    if(!stats)return
    const rows:unknown[][]=[['Metric','Value','Period','Scope'],['Revenue (PKR)',Math.round(stats.revenue),rangeLabel,'Selected period'],['Orders',stats.orders,rangeLabel,'Selected period'],['Average order value (PKR)',Math.round(stats.aov),rangeLabel,'Selected period'],['New customers',stats.customers_new,rangeLabel,'Selected period'],['Total customers',stats.customers,rangeLabel,'All time'],['Repeat customer rate (%)',stats.repeat_rate,rangeLabel,'All time'],['Products',stats.products_total,rangeLabel,'Current catalogue'],['Low stock',stats.low_stock,rangeLabel,'Current catalogue'],['Reviews awaiting approval',stats.reviews_pending,rangeLabel,'Current moderation queue']]
    const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}))
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`rugistan-summary-${range}-${new Date().toISOString().slice(0,10)}.csv`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }

  return (
    <section className="dashboard-page" aria-busy={loading}>
      <PageHeader
        title="Welcome back, Admin"
        subtitle="Your daily view of sales, fulfilment and the collection."
        actions={
          <><button type="button" className="btn soft dashboard-refresh" disabled={loading} onClick={()=>setRefresh(v=>v+1)} aria-label="Refresh dashboard"><RefreshCw size={16} aria-hidden="true"/></button><Select className="select" value={range} onChange={(e) => setRange(e.target.value as RangeKey)} aria-label="Date range">
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select></>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      <div className="dashboard-quick-actions" aria-label="Quick actions">
        <Link to="/admin/products/new"><Plus size={18} aria-hidden="true"/><span>Add a rug</span><ArrowUpRight size={15} aria-hidden="true"/></Link>
        <Link to="/admin/orders"><ShoppingBag size={18} aria-hidden="true"/><span>Manage orders</span><ArrowUpRight size={15} aria-hidden="true"/></Link>
        <Link to="/admin/pages"><Layers size={18} aria-hidden="true"/><span>Website content</span><ArrowUpRight size={15} aria-hidden="true"/></Link>
        <Link to="/admin/reviews"><MessageSquare size={18} aria-hidden="true"/><span>Moderate reviews</span><ArrowUpRight size={15} aria-hidden="true"/></Link>
      </div>
      <div className="dashboard-update"><span role="status">{loading?'Updating your overview…':updated?`Updated ${updated.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`:'Store overview'}</span><button className="action" type="button" disabled={loading||!stats} onClick={downloadSummary}><Download size={14} aria-hidden="true"/> Download summary</button></div>
      <div className="stats analytics-metrics">
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

      <div className="dashboard-attention" aria-label="Store priorities">
        <Link to="/admin/products"><span className="dashboard-task-icon"><PackageCheck size={20} aria-hidden="true"/></span><div><strong>{loading?'—':plainNumber(stats?.low_stock??0)}</strong><span>Products low on stock</span></div><ArrowUpRight size={16} aria-hidden="true"/></Link>
        <Link to="/admin/reviews"><span className="dashboard-task-icon"><MessageSquare size={20} aria-hidden="true"/></span><div><strong>{loading?'—':plainNumber(stats?.reviews_pending??0)}</strong><span>Reviews awaiting approval</span></div><ArrowUpRight size={16} aria-hidden="true"/></Link>
        <div><span className="dashboard-task-icon"><ShoppingBag size={20} aria-hidden="true"/></span><div><strong>{loading?'—':money(stats?.aov??0)}</strong><span>Average order · {rangeLabel.toLowerCase()}</span></div></div>
      </div>
      <div className="dashboard-main-grid">
        <div className="card pad">
          <div className="hstack space">
            <h2>Sales Overview</h2>
            <div className="dashboard-chart-switch" role="group" aria-label="Chart metric">{(['revenue','orders'] as const).map(value=><button key={value} type="button" aria-pressed={metric===value} onClick={()=>setMetric(value)}>{titleCase(value)}</button>)}</div>
          </div>
          <div className="dashboard-chart-total"><strong>{loading?'—':metric==='revenue'?money(stats?.revenue??0):plainNumber(stats?.orders??0)}</strong><span>{metric==='revenue'?'Sales revenue':'Orders placed'} · {rangeLabel.toLowerCase()}</span></div>
          {loading ? (
            <div className="skeleton" style={{ height: 250, marginTop: 18 }} />
          ) : series.some((s) => Number(s[metric]) > 0) ? (
            <LineChart points={series.map((s) => Number(s[metric]))} labels={seriesLabels(series, bucket)} label={metric==='revenue'?'Revenue over time':'Orders over time'}/>
          ) : (
            <div className="analytics-chart-empty"><ChartNoAxesCombined size={28} aria-hidden="true"/><strong>{metric==='revenue'?'No revenue yet':'No orders in this period'}</strong><p>Your sales story will appear here as orders arrive.</p></div>
          )}
        </div>

        <div className="card pad">
          <h2 style={{ marginBottom: 23 }}>Top Collections</h2>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : categories.length === 0 ? (
            <EmptyState title="Nothing sold yet" message="Collection performance appears once orders are placed." />
          ) : (
            categories.map((c) => {
              const share = Math.min(Math.max(Number(c.share) || 0, 0), 100)
              return (
                <div className="kpi" key={c.category_id}>
                  <img src={c.image_url ?? '/assets/rug_lifestyle_1.jpg'} alt="" aria-hidden="true" />
                  <div style={{ flex: 1 }}>
                    <strong>{c.name}</strong>
                    <div className="progress">
                      <b style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  <strong>{share.toFixed(0)}%</strong>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="dashboard-insights-grid">
        <section className="card pad"><div className="analytics-card-heading"><div><span className="eyebrow">FULFILMENT</span><h2>Order activity</h2></div><ShoppingBag size={20} aria-hidden="true"/></div><p className="tiny">All time · {plainNumber(statusTotal)} orders</p>{loading?<div className="skeleton" style={{height:150}}/>:statuses.length?statuses.map(([status,n])=><div className="dashboard-status" key={status}><div><span className={`tag ${statusTone(status)}`}>{titleCase(status)}</span><strong>{plainNumber(Number(n))}</strong></div><div className="progress"><b style={{width:`${Number(n)/statusTotal*100}%`}}/></div></div>):<p className="dashboard-quiet">New orders will build your fulfilment overview.</p>}<Link className="inline-link" to="/admin/orders">Open orders <ArrowUpRight size={14} aria-hidden="true"/></Link></section>
        <section className="card pad"><div className="analytics-card-heading"><div><span className="eyebrow">THE COLLECTION</span><h2>Inventory watch</h2></div><PackageCheck size={20} aria-hidden="true"/></div><p className="tiny">Published rugs with the fewest available units.</p>{loading?<div className="skeleton" style={{height:150}}/>:inventory.length?inventory.map(product=><Link className="dashboard-inventory-row" to={`/admin/products/${product.id}`} key={product.id}><img src={[...(product.product_images??[])].sort((a,b)=>a.sort_order-b.sort_order)[0]?.url??'/assets/rug_lifestyle_1.jpg'} alt=""/><span><strong>{product.name}</strong><small>{product.stock_quantity===0?'Out of stock':product.stock_quantity<=product.low_stock_at?'Low stock':'In stock'}</small></span><b className={product.stock_quantity<=product.low_stock_at?'low':''}>{plainNumber(product.stock_quantity)}</b></Link>):<p className="dashboard-quiet">Published products will appear here. Add your first rug to get started.</p>}<Link className="inline-link" to="/admin/products">Manage inventory <ArrowUpRight size={14} aria-hidden="true"/></Link></section>
        <section className="card pad"><div className="analytics-card-heading"><div><span className="eyebrow">CUSTOMER FAVOURITES</span><h2>Best sellers</h2></div><Layers size={20} aria-hidden="true"/></div>{loading?<div className="skeleton" style={{height:150}}/>:bestsellers.length?bestsellers.map((product,index)=><div className="dashboard-bestseller" key={product.product_id}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{product.name}</strong><small>{plainNumber(product.units)} units · {money(product.revenue)}</small></div></div>):<p className="dashboard-quiet">Your most loved rugs will appear after your first sales.</p>}<div className="dashboard-retention"><strong>{loading?'—':`${stats?.repeat_rate??0}%`}</strong><span>Repeat customer rate · all time</span></div><Link className="inline-link" to="/admin/analytics">Explore analytics <ArrowUpRight size={14} aria-hidden="true"/></Link></section>
      </div>
      <div className="card dashboard-recent-orders" style={{ marginTop: 19 }}>
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
    </section>
  )
}
