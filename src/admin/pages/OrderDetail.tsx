import Select from '../../components/ui/Select'
import { useMoney } from '../../lib/currency'
import { Printer } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, readableError } from '../../lib/supabase'
import { dateTime, fullName, initials, statusTone, titleCase } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { EmptyState, Field, Notice, PageHeader, Spinner } from '../components/ui'
import type { OrderFull, OrderStatus, PaymentStatus } from '../../lib/types'

const STATUSES: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
const PAYMENTS: PaymentStatus[] = ['unpaid', 'awaiting_confirmation', 'paid', 'refunded', 'failed']
const STAGES = ['Order Placed', 'Processing', 'Shipped', 'Delivered']

export default function OrderDetail() {
  const money = useMoney('PKR')
  const { id = '' } = useParams()
  const toast = useToast()
  const [order, setOrder] = useState<OrderFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<OrderStatus>('pending')
  const [note, setNote] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid')
  const [adminNote, setAdminNote] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, items:order_items(*), events:order_events(*)')
      .eq('id', id)
      .maybeSingle()
    const found = (data as never as OrderFull) ?? null
    setOrder(found)
    if (found) {
      setStatus(found.status)
      setPaymentStatus(found.payment_status)
      setAdminNote(found.admin_note)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function saveStatus() {
    setBusy('status')
    setError('')
    const { error: err } = await supabase.rpc('admin_set_order_status', {
      p_order_id: id,
      p_status: status,
      p_note: note,
    })
    setBusy('')
    if (err) {
      setError(readableError(err))
      return
    }
    setNote('')
    toast.success(`Order marked as ${status}.`)
    await load()
  }

  async function savePayment() {
    setBusy('payment')
    const { error: err } = await supabase.from('orders').update({ payment_status: paymentStatus }).eq('id', id)
    setBusy('')
    if (err) {
      toast.error(readableError(err))
      return
    }
    toast.success('Payment status updated.')
    await load()
  }

  async function saveNote() {
    setBusy('note')
    const { error: err } = await supabase.from('orders').update({ admin_note: adminNote }).eq('id', id)
    setBusy('')
    if (err) {
      toast.error(readableError(err))
      return
    }
    toast.success('Internal note saved.')
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Order" subtitle="Loading…" />
        <div className="skeleton" style={{ height: 380 }} />
      </>
    )
  }

  if (!order) {
    return (
      <>
        <PageHeader title="Order not found" subtitle="This order may have been removed." />
        <div className="card">
          <EmptyState
            title="Nothing to show"
            message="We could not find that order."
            action={
              <Link className="btn" to="/admin/orders">
                Back to orders
              </Link>
            }
          />
        </div>
      </>
    )
  }

  const events = [...(order.events ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const cancelled = order.status === 'cancelled'
  const itemCount = (order.items ?? []).reduce((sum, i) => sum + i.quantity, 0)

  return (
    <>
      <PageHeader
        title={`Order ${order.order_number}`}
        subtitle={`Placed ${dateTime(order.created_at)} · ${itemCount} item${itemCount === 1 ? '' : 's'}`}
        actions={
          <>
            <span className={`tag ${statusTone(order.status)}`}>{titleCase(order.status)}</span>
            <button type="button" className="btn soft" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" /> Print Invoice
            </button>
          </>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      <div className="grid cols2">
        <div>
          <div className="card pad">
            <h2 style={{ marginBottom: 24 }}>Items in This Order</h2>
            {(order.items ?? []).map((item) => (
              <div className="kpi" key={item.id}>
                <img src={item.image_url ?? '/assets/rug_lifestyle_1.jpg'} alt="" aria-hidden="true" />
                <div style={{ flex: 1 }}>
                  <strong>{item.product_name}</strong>
                  <p className="sub">
                    {[item.size_label, `Qty: ${item.quantity}`, `${money(item.unit_price)} each`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <strong>{money(item.line_total)}</strong>
              </div>
            ))}
            <div className="hstack space" style={{ paddingTop: 25, fontSize: '1.125rem' }}>
              <strong>Total</strong>
              <strong style={{ font: '28px Georgia, serif' }}>{money(order.total)}</strong>
            </div>
          </div>

          <div className="card pad" style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 15 }}>Order Timeline</h2>
            {(cancelled ? ['Order Placed', 'Cancelled'] : STAGES).map((stage) => {
              const event = events.find((e) => e.label === stage)
              return (
                <div className="kpi" key={stage}>
                  <span className={`mini-dot ${event ? '' : 'pending'}`} />
                  <div>
                    <strong>{stage}</strong>
                    <div className="tiny">{event ? dateTime(event.created_at) : 'Pending'}</div>
                    {event?.note && <div className="tiny">{event.note}</div>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card pad" style={{ marginTop: 18 }}>
            <h2 className="smalltitle">Update Order</h2>
            <div className="formgrid">
              <Field label="Order Status">
                <Select className="select" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Note for the timeline" hint="Shown to the customer on their order page.">
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
              </Field>
            </div>
            {status === 'cancelled' && order.status !== 'cancelled' && (
              <Notice tone="error">Cancelling returns every item in this order to stock.</Notice>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => void saveStatus()}
              disabled={busy === 'status' || status === order.status}
              style={{ marginTop: 14 }}
            >
              {busy === 'status' ? <Spinner label="Saving" /> : 'Save Status'}
            </button>

            <div className="sep" />

            <div className="formgrid">
              <Field label="Payment Status" hint="Mark as paid only once funds have actually cleared.">
                <Select className="select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}>
                  {PAYMENTS.map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label=" ">
                <button
                  type="button"
                  className="btn soft"
                  onClick={() => void savePayment()}
                  disabled={busy === 'payment' || paymentStatus === order.payment_status}
                >
                  {busy === 'payment' ? <Spinner /> : 'Update Payment'}
                </button>
              </Field>
            </div>

            <div className="sep" />

            <Field label="Internal note" hint="Only visible to your team.">
              <textarea className="textarea" style={{ height: 90 }} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            </Field>
            <button type="button" className="btn soft" onClick={() => void saveNote()} disabled={busy === 'note'}>
              {busy === 'note' ? <Spinner /> : 'Save Note'}
            </button>
          </div>
        </div>

        <div>
          <div className="card pad">
            <h2 style={{ marginBottom: 24 }}>Customer Information</h2>
            <div className="hstack">
              <span className="avatar">{initials(order.first_name, order.last_name, order.email)}</span>
              <div>
                <strong>{fullName(order.first_name, order.last_name)}</strong>
                <p className="sub">
                  <a href={`mailto:${order.email}`}>{order.email}</a>
                </p>
                {order.phone && <p className="sub">{order.phone}</p>}
              </div>
            </div>
            <div className="sep" />
            <p className="eyebrow">SHIPPING ADDRESS</p>
            <p style={{ lineHeight: 1.7, marginTop: 10 }}>
              {order.address_line1}
              {order.address_line2 && (
                <>
                  <br />
                  {order.address_line2}
                </>
              )}
              <br />
              {[order.city, order.province, order.postal_code].filter(Boolean).join(', ')}
              <br />
              {order.country}
            </p>
            <div className="sep" />
            <p className="eyebrow">DELIVERY</p>
            <p style={{ marginTop: 10 }}>{order.shipping_method || '—'}</p>
            {order.customer_note && (
              <>
                <div className="sep" />
                <p className="eyebrow">CUSTOMER NOTE</p>
                <p style={{ marginTop: 10 }}>{order.customer_note}</p>
              </>
            )}
          </div>

          <div className="card pad" style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 19 }}>Order Summary</h2>
            {[
              ['Subtotal', money(order.subtotal)],
              ['Shipping', Number(order.shipping_amount) === 0 ? 'Free' : money(order.shipping_amount)],
              ['Discount' + (order.promo_code ? ` (${order.promo_code})` : ''), `−${money(order.discount_amount)}`],
              ['Total', money(order.total)],
            ].map(([label, value]) => (
              <div className="hstack space" style={{ padding: '9px 0' }} key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <div className="sep" />
            <p className="eyebrow">PAYMENT METHOD</p>
            <p style={{ marginTop: 10 }}>
              {order.payment_method || '—'} · <span className={`tag ${statusTone(order.payment_status)}`}>{titleCase(order.payment_status)}</span>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
