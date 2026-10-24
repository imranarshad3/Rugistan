import { useMoney } from '../../lib/currency'
import { useEffect, useState } from 'react'
import Icon from '../../components/client/Icon'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { shortDate, titleCase } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import { EmptyState } from '../../components/client/Primitives'
import { PageBanner } from '../../components/client/Sections'
import type { Order, OrderItem } from '../../lib/types'

export default function OrderConfirmation() {
  const { orderNumber = '' } = useParams()
  const { state } = useLocation() as { state?: { email?: string; instructions?: string; trackingToken?: string } }
  const { user } = useAuth()
  const [order, setOrder] = useState<(Order & { items: OrderItem[] }) | null>(null)
  const money = useMoney(undefined, order?.currency)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      // Signed-in shoppers can read their own order directly; guests use the
      // order-number + email lookup, which is the same path /track-order uses.
      if (user) {
        const { data } = await supabase
          .from('orders')
          .select('*, items:order_items(*)')
          .eq('order_number', orderNumber)
          .maybeSingle()
        if (active && data) {
          setOrder(data as never)
          setLoading(false)
          return
        }
      }
      if (state?.email) {
        const { data } = await supabase.rpc('track_order', {
          p_order_number: orderNumber,
          p_email: state.email,
          p_tracking_token: state.trackingToken,
        })
        const result = data as { found?: boolean; order?: Order; items?: OrderItem[] } | null
        if (active && result?.found) {
          setOrder({ ...(result.order as Order), items: (result.items ?? []) as OrderItem[] })
        }
      }
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [orderNumber, user, state?.email, state?.trackingToken])

  return (
    <>
      <PageBanner
        eyebrow="THANK YOU"
        title={order ? "Your Order Has Been Received" : "Order Details"}
        description="View your order details and payment status below."
        image="/assets/rug_lifestyle_2.jpg"
      />

      <section className="section wrap">
        {loading ? (
          <div className="skeleton" style={{ height: 240 }} />
        ) : !order ? (
          <EmptyState
            title="Order details unavailable"
            message="Sign in to view your orders, or use your saved tracking link. Contact our team if you need help."
            actionLabel="Track your order"
            actionTo="/track-order"
          />
        ) : (
          <div className="cartgrid">
            <div className="carttable">
              <h3 style={{ marginBottom: 18 }}>Order {order.order_number}</h3>
              <p className="subtitle" style={{ marginBottom: 20 }}>
                Placed {shortDate(order.created_at)} · Status {titleCase(order.status)} · Payment{' '}
                {titleCase(order.payment_status)}
              </p>
              {(order.items ?? []).map((item, i) => (
                <div className="cartitem confirmation-item" key={item.id ?? `${item.product_name}-${i}`}>
                  <img src={item.image_url ?? '/assets/rug_lifestyle_1.jpg'} alt="" aria-hidden="true" />
                  <div>
                    <h3>{item.product_name}</h3>
                    <p>
                      Qty {item.quantity}
                      {item.size_label ? ` · ${item.size_label}` : ''}
                    </p>
                  </div>
                  <div className="price">{money(item.line_total)}</div>
                </div>
              ))}

              {state?.instructions && (
                <div className="notice" style={{ marginTop: 24 }}>
                  <strong>{order.payment_method}:</strong> {state.instructions}
                </div>
              )}

              {state?.trackingToken && <div className="notice" style={{ marginTop: 24 }}>
                <strong>Save your private tracking link</strong>
                <p>Keep this link safe to view this guest order later.</p>
                <Link className="inline-link" to={`/track-order?order=${encodeURIComponent(orderNumber)}#${state.trackingToken}`}>Open tracking link</Link>
              </div>}
              <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link className="btn" to="/shop">
                  Continue Shopping
                </Link>
                <Link className="btn outline" to={user ? '/account/orders' : '/track-order'}>
                  {user ? 'View My Orders' : 'Track This Order'}
                </Link>
              </div>
            </div>

            <aside className="summary">
              <h3>Summary</h3>
              <div className="sumrow">
                <span>Subtotal</span>
                <strong>{money(order.subtotal)}</strong>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div className="sumrow">
                  <span>Discount{order.promo_code ? ` (${order.promo_code})` : ''}</span>
                  <strong>−{money(order.discount_amount)}</strong>
                </div>
              )}
              <div className="sumrow">
                <span>Shipping ({order.shipping_method})</span>
                <strong>{Number(order.shipping_amount) === 0 ? 'Free' : money(order.shipping_amount)}</strong>
              </div>
              <div className="sumrow total">
                <span>Total</span>
                <strong>{money(order.total)}</strong>
              </div>
              <div className="secure"><Icon name="spark" />Payment method: {order.payment_method}</div>
              <p className="subtle">
                Delivering to {order.city}
                {order.country ? `, ${order.country}` : ''}
              </p>
            </aside>
          </div>
        )}
      </section>
    </>
  )
}
