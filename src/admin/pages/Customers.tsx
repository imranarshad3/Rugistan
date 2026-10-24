import { useMoney } from '../../lib/currency'
import { Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { initials, plainNumber, shortDate } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { EmptyState, Modal, PageHeader, SearchInput, Stat, StatSkeleton, TableSkeleton } from '../components/ui'
import type { Order } from '../../lib/types'

type CustomerRow = {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  created_at: string
  orders_count: number
  total_spent: number
  last_order_at: string | null
}

export default function Customers() {
  const money = useMoney('PKR')
  const toast = useToast()
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CustomerRow | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('admin_customers', { p_search: '' })
    setRows((data ?? []) as CustomerRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) return
    setOrdersLoading(true)
    void supabase
      .from('orders')
      .select('*')
      .eq('user_id', selected.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders(data ?? [])
        setOrdersLoading(false)
      })
  }, [selected])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) => `${r.first_name} ${r.last_name} ${r.email}`.toLowerCase().includes(term))
  }, [rows, search])

  const totals = useMemo(() => {
    const monthAgo = Date.now() - 30 * 86_400_000
    return {
      total: rows.length,
      newThisMonth: rows.filter((r) => new Date(r.created_at).getTime() >= monthAgo).length,
      repeat: rows.filter((r) => r.orders_count > 1).length,
      ltv: rows.length ? rows.reduce((sum, r) => sum + Number(r.total_spent), 0) / rows.length : 0,
    }
  }, [rows])

  function exportCsv() {
    const header = ['First name', 'Last name', 'Email', 'Phone', 'Orders', 'Total spent', 'Joined', 'Last order']
    const lines = visible.map((r) =>
      [r.first_name, r.last_name, r.email, r.phone, r.orders_count, r.total_spent, r.created_at, r.last_order_at ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rugistan-customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${visible.length} customer${visible.length === 1 ? '' : 's'}.`)
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Manage relationships with customers and returning buyers."
        actions={
          <button type="button" className="btn soft" onClick={exportCsv} disabled={visible.length === 0}>
            <Download size={16} aria-hidden="true" /> Export Customers
          </button>
        }
      />

      <div className="stats">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <Stat name="Total Customers" icon="customers" value={plainNumber(totals.total)} note="With an account" />
            <Stat name="New This Month" icon="new" value={plainNumber(totals.newThisMonth)} note="Last 30 days" />
            <Stat name="Repeat Buyers" icon="repeat" value={plainNumber(totals.repeat)} note="More than one order" />
            <Stat name="Average Spend" icon="revenue" value={money(totals.ltv)} note="Per customer" />
          </>
        )}
      </div>

      <div className="card">
        <div className="hstack space" style={{ padding: 24, flexWrap: 'wrap', gap: 14 }}>
          <h2>Customer Directory</h2>
          <SearchInput value={search} onChange={setSearch} placeholder="⌕  Search name or email..." width={350} />
        </div>

        {loading ? (
          <TableSkeleton cols={6} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length ? 'No customers match that search' : 'No customers yet'}
            message={
              rows.length
                ? 'Try a different name or email address.'
                : 'Customers appear here as soon as someone creates an account on the storefront.'
            }
          />
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email Address</th>
                  <th>Orders</th>
                  <th>Total Spent</th>
                  <th>Joined</th>
                  <th>Last Order</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="hstack">
                        <span className="avatar" style={{ width: 35, height: 35, fontSize: '0.75rem' }}>
                          {initials(c.first_name, c.last_name, c.email)}
                        </span>
                        <strong>{`${c.first_name} ${c.last_name}`.trim() || '—'}</strong>
                      </div>
                    </td>
                    <td>{c.email}</td>
                    <td>{c.orders_count}</td>
                    <td>
                      <strong>{money(c.total_spent)}</strong>
                    </td>
                    <td>{shortDate(c.created_at)}</td>
                    <td>{c.last_order_at ? shortDate(c.last_order_at) : '—'}</td>
                    <td>
                      <button type="button" className="action" onClick={() => setSelected(c)}>
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <Modal title={`${selected.first_name} ${selected.last_name}`.trim() || selected.email} onClose={() => setSelected(null)} width={620}>
          <div className="hstack" style={{ gap: 18, marginBottom: 20 }}>
            <span className="profile-big" style={{ width: 62, height: 62, fontSize: '1.5rem' }}>
              {initials(selected.first_name, selected.last_name, selected.email)}
            </span>
            <div>
              <p>{selected.email}</p>
              {selected.phone && <p className="sub">{selected.phone}</p>}
              <p className="sub">Joined {shortDate(selected.created_at)}</p>
            </div>
          </div>

          <div className="stats" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 20 }}>
            <Stat name="Orders" icon="orders" value={plainNumber(selected.orders_count)} />
            <Stat name="Total Spent" icon="revenue" value={money(selected.total_spent)} />
          </div>

          <h3 className="smalltitle">Order history</h3>
          {ordersLoading ? (
            <div className="skeleton" style={{ height: 90 }} />
          ) : orders.length === 0 ? (
            <p className="tiny">This customer has not placed an order yet.</p>
          ) : (
            <div className="tablewrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.order_number}</td>
                      <td>{money(o.total)}</td>
                      <td>{o.status}</td>
                      <td>{shortDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
