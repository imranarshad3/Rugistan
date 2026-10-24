import Select from '../../components/ui/Select'
import { useMoney } from '../../lib/currency'
import { isVideoMedia } from '../../lib/productMedia'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, readableError } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { ConfirmDialog, EmptyState, PageHeader, SearchInput, Spinner } from '../components/ui'
import type { Category, ProductFull, ProductStatus } from '../../lib/types'

const SELECT = '*, category:categories(id,name,slug), images:product_images(*), variants:product_variants(*)'

export default function Products() {
  const money = useMoney('PKR')
  const navigate = useNavigate()
  const toast = useToast()
  const [products, setProducts] = useState<ProductFull[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [viewCounts, setViewCounts] = useState<Record<string, number> | null>(null)
  const [statusBusy, setStatusBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('created')
  const [pendingDelete, setPendingDelete] = useState<ProductFull | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: cats }] = await Promise.all([
      supabase.from('products').select(SELECT).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
    ])
    setProducts((data ?? []) as never)
    setCategories(cats ?? [])
    const { data: views, error: viewsError } = await supabase.rpc('admin_product_views')
    setViewCounts(viewsError ? null : Object.fromEntries((views ?? []).map(row => [row.product_id, Number(row.views)])))
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = products.filter((p) => {
      if (categoryId && p.category_id !== categoryId) return false
      if (status && p.status !== status) return false
      if (term && !`${p.name} ${p.sku} ${p.material} ${p.color}`.toLowerCase().includes(term)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'name': return a.name.localeCompare(b.name)
        case 'price-asc': return Number(a.price) - Number(b.price)
        case 'price-desc': return Number(b.price) - Number(a.price)
        case 'stock': return a.stock_quantity - b.stock_quantity
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return list
  }, [products, search, categoryId, status, sort])

  async function changeStatus(product: ProductFull, next: ProductStatus) {
    if (next === product.status || statusBusy) return
    setStatusBusy(product.id)
    const { error } = await supabase.from('products').update({ status: next }).eq('id', product.id)
    setStatusBusy(null)
    if (error) { toast.error(readableError(error)); return }
    setProducts(list => list.map(row => row.id === product.id ? { ...row, status: next } : row))
    toast.success(`${product.name} is now ${next}.`)
  }

  async function remove() {
    if (!pendingDelete) return
    setDeleting(true)
    const { error } = await supabase.from('products').delete().eq('id', pendingDelete.id)
    setDeleting(false)
    if (error) {
      toast.error(readableError(error, 'This rug could not be deleted — it may appear on an existing order.'))
      return
    }
    toast.success(`${pendingDelete.name} deleted.`)
    setPendingDelete(null)
    void load()
  }

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Manage your handmade rug catalogue, prices and availability."
        actions={
          <button type="button" className="btn" onClick={() => navigate('/admin/products/new')}>
            <Plus size={16} aria-hidden="true" /> Add New Product
          </button>
        }
      />

      <div className="searchrow">
        <SearchInput value={search} onChange={setSearch} placeholder="⌕  Search products by name or SKU..." />
        <Select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter by collection">
          <option value="">All Collections</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </Select>
        <Select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products">
          <option value="created">Sort: Newest</option>
          <option value="name">Sort: Name</option>
          <option value="price-asc">Sort: Price ↑</option>
          <option value="price-desc">Sort: Price ↓</option>
          <option value="stock">Sort: Lowest stock</option>
        </Select>
      </div>

      {loading ? (
        <div className="rugs-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="card rugcard" key={i}>
              <div className="skeleton" style={{ height: 175 }} />
              <div className="rugbody">
                <div className="skeleton" style={{ height: 20, marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 14, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            title={products.length ? 'No products match those filters' : 'No products yet'}
            message={products.length ? 'Try a different search or clear the filters.' : 'Add your first rug to start selling.'}
            action={
              <Link className="btn" to="/admin/products/new">
                <Plus size={16} aria-hidden="true" /> Add New Product
              </Link>
            }
          />
        </div>
      ) : (
        <div className="card product-table-card">
          <div className="catalogue-table-head"><h2>Product Catalogue</h2><span className="tiny">{visible.length} of {products.length} products</span></div>
          <div className="tablewrap"><table className="table product-table">
            <thead><tr><th>Product</th><th title="One view per browser session. Tracking starts from this update.">Product Views</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{visible.map(p => {
              const cover = [...p.images].sort((a,b) => a.sort_order - b.sort_order).find(item => !isVideoMedia(item.url))?.url
              const low = p.stock_quantity <= p.low_stock_at
              return <tr key={p.id}>
                <td><Link className="product-list-name" to={`/admin/products/${p.id}`}><img src={cover || '/assets/rug_lifestyle_1.jpg'} alt="" loading="lazy" /><span><strong>{p.name}</strong><small>SKU: {p.sku} · {p.variants.length} sizes</small></span></Link></td>
                <td><span className="product-view-count" title="One view per browser session">{viewCounts ? (viewCounts[p.id] ?? 0).toLocaleString() : "—"}</span></td>
                <td><strong className="list-price">{money(p.price)}</strong></td>
                <td><span className={`tag ${p.stock_quantity === 0 ? 'red' : low ? 'orange' : 'green'}`}>{p.stock_quantity === 0 ? 'Out of stock' : `${p.stock_quantity} available`}</span></td>
                <td><Select className={`select product-status-select ${p.status}`} aria-label={`Status for ${p.name}`} value={p.status} disabled={statusBusy !== null} onChange={e => void changeStatus(p, e.target.value as ProductStatus)}>
                  <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
                </Select></td>
                <td><div className="table-actions">
                  <Link className="icon-action" to={`/admin/products/${p.id}`} aria-label={`Edit ${p.name}`} title="Edit product"><Pencil size={17} /></Link>
                  <button type="button" className="icon-action danger" onClick={() => setPendingDelete(p)} aria-label={`Delete ${p.name}`} title="Delete product"><Trash2 size={17} /></button>
                </div></td>
              </tr>
            })}</tbody>
          </table></div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete product"
          message={`Delete “${pendingDelete.name}”? Its images and sizes are removed too. Products that appear on past orders cannot be deleted — unpublish them instead.`}
          busy={deleting}
          onConfirm={() => void remove()}
          onClose={() => setPendingDelete(null)}
        />
      )}
      {deleting && <Spinner />}
    </>
  )
}
