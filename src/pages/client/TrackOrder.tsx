import { useMoney } from '../../lib/currency'
import { Link, useLocation } from 'react-router-dom'
import Icon from '../../components/client/Icon'
import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { dateTime, titleCase, statusTone } from '../../lib/format'
import { PageBanner } from '../../components/client/Sections'
import { Spinner } from '../../components/client/Primitives'

type TrackResult = {
  found: boolean
  order?: {
    order_number: string
    status: string
    payment_status: string
    currency: string
    total: number
    created_at: string
    shipping_method: string
    city: string
    country: string
  }
  items?: { product_name: string; size_label: string; quantity: number; line_total: number; image_url: string | null }[]
  events?: { label: string; note: string; created_at: string }[]
}

const STAGES = ['Order Placed', 'Processing', 'Shipped', 'Delivered']

export default function TrackOrder() {
  const location = useLocation()
  const [orderNumber, setOrderNumber] = useState(new URLSearchParams(location.search).get('order') || '')
  const [token, setToken] = useState(location.hash.slice(1))
  const [failure, setFailure] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TrackResult | null>(null)

  const money = useMoney(undefined, result?.order?.currency)

  async function search(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setFailure('')
    setBusy(true)
    setResult(null)
    const { data, error } = await supabase.rpc('track_order', {
      p_order_number: orderNumber.trim(),
      p_email: email.trim(),
      p_tracking_token: token.trim(),
    })
    setBusy(false)
    if (error) { setFailure('Order tracking is temporarily unavailable. Please try again.'); return }
    setResult((data as TrackResult) ?? { found: false })
  }

  const events = result?.events ?? []
  const cancelled = result?.order?.status === 'cancelled'

  return (
    <>
      <PageBanner
        title="Track Your Order"
        description="Enter your order number, email address and private tracking key to see where your rug is."
        image="/assets/rug_lifestyle_3.jpg"
      />

      <section className="section wrap">
        <div className="twocol">
          <form className="card" onSubmit={search}>
            <div className="eyebrow">ORDER LOOKUP</div>
            <h2 style={{ marginBottom: 20 }}>Find Your Order</h2>
            <label className="field">
              Order Number
              <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="RG-1001" required />
            </label>
            <label className="field">
              Email Address
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
            </label>
            <label className="field">Private Tracking Key
              <input value={token} onChange={e => setToken(e.target.value)} placeholder="Key from your order confirmation link" required autoComplete="off" />
            </label>
            <p className="subtitle">For older orders without a tracking key, sign in or contact our team.</p>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? <Spinner label="Searching" /> : 'Track Order →'}
            </button>
          </form>

          <div>
            {failure && <div className="notice error" role="alert">{failure}</div>}
            {result && !result.found && (
              <div className="notice error">
                We could not find an order with those details. Check your tracking link and try again, or contact our team.
              </div>
            )}

            {result?.found && result.order && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div>
                    <div className="eyebrow">ORDER {result.order.order_number}</div>
                    <h3>{money(result.order.total)}</h3>
                  </div>
                  <span className={`tag ${statusTone(result.order.status)}`}>{titleCase(result.order.status)}</span>
                </div>
                <p className="subtitle" style={{ marginTop: 10 }}>
                  Placed {dateTime(result.order.created_at)} · {result.order.shipping_method} to {result.order.city}
                  {result.order.country ? `, ${result.order.country}` : ''}
                </p>

                <hr className="hr" />

                <div className="timeline">
                  {(cancelled ? ['Order Placed', 'Cancelled'] : STAGES).map((stage) => {
                    const event = events.find((e) => e.label === stage)
                    return (
                      <div className={`tl ${event ? 'done' : ''}`} key={stage}>
                        <span className="dot" />
                        <div>
                          <strong>{stage}</strong>
                          <p className="subtle">{event ? dateTime(event.created_at) : 'Pending'}</p>
                          {event?.note && <p style={{ fontSize: '0.875rem' }}>{event.note}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <hr className="hr" />

                {(result.items ?? []).map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 0' }}>
                    <img
                      src={item.image_url ?? '/assets/rug_lifestyle_1.jpg'}
                      alt=""
                      aria-hidden="true"
                      style={{ width: 60, height: 60, objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong>{item.product_name}</strong>
                      <p className="subtle">
                        Qty {item.quantity}
                        {item.size_label ? ` · ${item.size_label}` : ''}
                      </p>
                    </div>
                    <strong>{money(item.line_total)}</strong>
                  </div>
                ))}
              </div>
            )}

            {!result && (
              <div className="tracking-guide">
                <span className="guide-icon"><Icon name="truck" /></span>
                <div className="eyebrow">FROM OUR HANDS TO YOUR HOME</div>
                <h2>A little closer to home.</h2>
                <p>Your order number is on your confirmation page and in your confirmation email. It looks like <strong>RG-1001</strong>.</p>
                <div className="tracking-stages"><span>01 · Confirmed</span><span>02 · On its way</span><span>03 · At home</span></div>
                <Link className="inline-link" to="/contact">Need a hand? Contact us ↗</Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
