import { supabase } from '../../lib/supabase'

export type DashboardStats = {
  revenue: number
  revenue_prev: number
  orders: number
  orders_prev: number
  customers: number
  customers_new: number
  customers_prev: number
  reviews_new: number
  reviews_prev: number
  reviews_pending: number
  reviews_total: number
  reviews_published: number
  rating_avg: number
  low_stock: number
  products_total: number
  repeat_rate: number
  aov: number
  by_status: Record<string, number>
}

export type RangeKey = '7d' | '30d' | '90d' | '12m'

export const RANGES: { key: RangeKey; label: string; days: number; bucket: 'day' | 'month' }[] = [
  { key: '7d', label: 'Last 7 days', days: 7, bucket: 'day' },
  { key: '30d', label: 'Last 30 days', days: 30, bucket: 'day' },
  { key: '90d', label: 'Last 90 days', days: 90, bucket: 'month' },
  { key: '12m', label: 'Last 12 months', days: 365, bucket: 'month' },
]

export function rangeBounds(key: RangeKey) {
  const range = RANGES.find((r) => r.key === key) ?? RANGES[1]
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  const from = new Date(to)
  from.setDate(from.getDate() - range.days)
  from.setHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: to.toISOString(), bucket: range.bucket, label: range.label }
}

export async function loadStats(from: string, to: string): Promise<DashboardStats | null> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats', { p_from: from, p_to: to })
  if (error) throw error
  return (data as DashboardStats) ?? null
}

export async function loadSeries(from: string, to: string, bucket: 'day' | 'month') {
  const { data, error } = await supabase.rpc('admin_sales_series', { p_from: from, p_to: to, p_bucket: bucket })
  if (error) throw error
  if (error) throw error
  return (data ?? []) as { bucket: string; revenue: number; orders: number }[]
}

export async function loadTopProducts(from: string, to: string, limit = 4) {
  const { data, error } = await supabase.rpc('admin_top_products', { p_from: from, p_to: to, p_limit: limit })
  if (error) throw error
  return (data ?? []) as { product_id: string; name: string; image_url: string | null; units: number; revenue: number }[]
}

export async function loadTopCategories(from: string, to: string, limit = 4) {
  const { data, error } = await supabase.rpc('admin_top_categories', { p_from: from, p_to: to, p_limit: limit })
  if (!error) return data ?? []
  if (error.code !== '42702') throw error
  const grouped = new Map<string, { category_id: string; name: string; image_url: string | null; units: number; revenue: number; share: number }>()
  let total = 0
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from('order_items')
      .select('id,quantity,line_total,product:products(category:categories(id,name,image_url)),order:orders!inner(created_at,status)')
      .gte('order.created_at', from).lt('order.created_at', to).neq('order.status', 'cancelled')
      .order('id').range(offset, offset + 999)
    if (result.error) throw result.error
    for (const row of result.data) {
      total += Number(row.line_total)
      const category = row.product?.category
      if (!category) continue
      const entry = grouped.get(category.id) ?? { category_id: category.id, name: category.name, image_url: category.image_url, units: 0, revenue: 0, share: 0 }
      entry.units += row.quantity
      entry.revenue += Number(row.line_total)
      grouped.set(category.id, entry)
    }
    if (result.data.length < 1000) break
  }
  return [...grouped.values()].sort((a,b) => b.revenue-a.revenue).slice(0,limit).map(row => ({ ...row, share: total ? Math.round(row.revenue / total * 1000) / 10 : 0 }))
}

export function seriesLabels(rows: { bucket: string }[], bucket: 'day' | 'month') {
  return rows.map((r) => {
    const d = new Date(r.bucket)
    return bucket === 'month'
      ? d.toLocaleDateString('en-GB', { month: 'short' })
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  })
}
