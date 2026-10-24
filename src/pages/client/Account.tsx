import { ArrowUpRight, LayoutDashboard } from 'lucide-react'
import { useMoney } from '../../lib/currency'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom'
import { supabase, readableError } from '../../lib/supabase'
import { dateTime, fullName, shortDate, statusTone, titleCase } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useWishlist } from '../../context/WishlistContext'
import { fetchProductsByIds } from '../../lib/api'
import ProductCard from '../../components/client/ProductCard'
import { PageBanner } from '../../components/client/Sections'
import { EmptyState, Spinner } from '../../components/client/Primitives'
import type { OrderFull, ProductFull } from '../../lib/types'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="section wrap">
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    )
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname)}`} replace />
  return <>{children}</>
}

export function AccountLayout() {
  const { profile, signOut, isAdmin } = useAuth()
  const links = [
    { to: '/account', label: 'Overview', end: true },
    { to: '/account/orders', label: 'Orders' },
    { to: '/account/wishlist', label: 'Wishlist' },
    { to: '/account/details', label: 'My Details' },
  ]

  return (
    <>
      <PageBanner
        eyebrow="MY ACCOUNT"
        title={`Hello, ${profile?.first_name || 'there'}`}
        description="Track your orders, revisit saved rugs and keep your details up to date."
        image="/assets/rug_lifestyle_2.jpg"
      />
      <section className="section wrap">
        <div className="account-layout">
          <nav className="acct-nav" aria-label="Account">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.label}
              </NavLink>
            ))}
            {isAdmin && <Link className="acct-admin-link" to="/admin"><LayoutDashboard size={17} aria-hidden="true" /><span>Admin Dashboard</span><ArrowUpRight size={16} aria-hidden="true" /></Link>}
            <button
              type="button"
              className="acctsignout"
              onClick={() => void signOut()}
              style={{ padding: '14px 18px', fontSize: '0.875rem', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', color: '#a5503c' }}
            >
              Sign Out
            </button>
          </nav>
          <div>
            <Outlet />
          </div>
        </div>
      </section>
    </>
  )
}

export function AccountOverview() {
  const money = useMoney()
  const { profile, user } = useAuth()
  const wishlist = useWishlist()
  const [orders, setOrders] = useState<OrderFull[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void supabase
      .from('orders')
      .select('*, items:order_items(*), events:order_events(*)')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setOrders((data ?? []) as never)
        setLoading(false)
      })
  }, [user])

  const spent = orders.reduce((sum, o) => (o.status === 'cancelled' ? sum : sum + Number(o.total)), 0)

  return (
    <>
      <h2 style={{ marginBottom: 18 }}>Overview</h2>
      <div className="testimonials" style={{ marginTop: 0, gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="quote">
          <div className="eyebrow">RECENT ORDERS</div>
          <h3>{loading ? '—' : orders.length}</h3>
          <p>Showing your three most recent orders below.</p>
        </div>
        <div className="quote">
          <div className="eyebrow">SAVED RUGS</div>
          <h3>{wishlist.count}</h3>
          <p>Rugs you have added to your wishlist.</p>
        </div>
        <div className="quote">
          <div className="eyebrow">RECENT SPEND</div>
          <h3>{money(spent)}</h3>
          <p>Across the orders listed here.</p>
        </div>
      </div>

      <h3 style={{ margin: '34px 0 16px' }}>Latest Orders</h3>
      {loading ? (
        <div className="skeleton" style={{ height: 140 }} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="When you place your first order it will appear here with live status updates."
          actionLabel="Shop all rugs"
          actionTo="/shop"
        />
      ) : (
        orders.map((o) => <OrderRow key={o.id} order={o} />)
      )}

      <div className="card" style={{ marginTop: 26 }}>
        <h3>Your details</h3>
        <p className="subtitle" style={{ marginTop: 8 }}>
          {fullName(profile?.first_name, profile?.last_name)} · {profile?.email}
          {profile?.phone ? ` · ${profile.phone}` : ''}
        </p>
        <Link className="inline-link" to="/account/details" style={{ display: 'inline-block', marginTop: 12 }}>
          Edit details →
        </Link>
      </div>
    </>
  )
}

function OrderRow({ order }: { order: OrderFull }) {
  const money = useMoney()
  return (
    <div className="orderrow">
      <div className="top">
        <div>
          <strong>{order.order_number}</strong>
          <p className="subtle">
            {shortDate(order.created_at)} · {(order.items ?? []).length} item
            {(order.items ?? []).length === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className={`tag ${statusTone(order.status)}`}>{titleCase(order.status)}</span>
          <strong>{money(order.total)}</strong>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(order.items ?? []).slice(0, 4).map((item) => (
          <img
            key={item.id}
            src={item.image_url ?? '/assets/rug_lifestyle_1.jpg'}
            alt=""
            aria-hidden="true"
            style={{ width: 54, height: 54, objectFit: 'cover' }}
          />
        ))}
      </div>
      <Link className="inline-link" to={`/account/orders/${order.order_number}`} style={{ display: 'inline-block', marginTop: 14 }}>
        View order →
      </Link>
    </div>
  )
}

export function AccountOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderFull[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void supabase
      .from('orders')
      .select('*, items:order_items(*), events:order_events(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data ?? []) as never)
        setLoading(false)
      })
  }, [user])

  return (
    <>
      <h2 style={{ marginBottom: 18 }}>Order History</h2>
      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Your order history will appear here once you have made a purchase."
          actionLabel="Shop all rugs"
          actionTo="/shop"
        />
      ) : (
        orders.map((o) => <OrderRow key={o.id} order={o} />)
      )}
    </>
  )
}

const STAGES = ['Order Placed', 'Processing', 'Shipped', 'Delivered']

export function AccountOrderDetail() {
  const { orderNumber = '' } = useParams()
  const { user } = useAuth()
  const [order, setOrder] = useState<OrderFull | null>(null)
  const money = useMoney(undefined, order?.currency)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void supabase
      .from('orders')
      .select('*, items:order_items(*), events:order_events(*)')
      .eq('order_number', orderNumber)
      .maybeSingle()
      .then(({ data }) => {
        setOrder((data as never) ?? null)
        setLoading(false)
      })
  }, [user, orderNumber])

  if (loading) return <div className="skeleton" style={{ height: 320 }} />
  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        message="We could not find that order on your account."
        actionLabel="Back to orders"
        actionTo="/account/orders"
      />
    )
  }

  const events = [...(order.events ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const cancelled = order.status === 'cancelled'

  return (
    <>
      <Link className="inline-link" to="/account/orders">
        ← Back to orders
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap', margin: '18px 0 22px' }}>
        <div>
          <div className="eyebrow">ORDER {order.order_number}</div>
          <h2>{money(order.total)}</h2>
          <p className="subtle">Placed {dateTime(order.created_at)}</p>
        </div>
        <span className={`tag ${statusTone(order.status)}`}>{titleCase(order.status)}</span>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 16 }}>Items</h3>
        {(order.items ?? []).map((item) => (
          <div key={item.id} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0e6da' }}>
            <img src={item.image_url ?? '/assets/rug_lifestyle_1.jpg'} alt="" aria-hidden="true" style={{ width: 64, height: 64, objectFit: 'cover' }} />
            <div style={{ flex: 1 }}>
              <strong>{item.product_name}</strong>
              <p className="subtle">
                Qty {item.quantity}
                {item.size_label ? ` · ${item.size_label}` : ''} · {money(item.unit_price)} each
              </p>
            </div>
            <strong>{money(item.line_total)}</strong>
          </div>
        ))}
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
      </div>

      <div className="twocol">
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Progress</h3>
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
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Delivery &amp; Payment</h3>
          <p className="eyebrow">SHIPPING ADDRESS</p>
          <p style={{ lineHeight: 1.8, marginBottom: 16 }}>
            {fullName(order.first_name, order.last_name)}
            <br />
            {order.address_line1}
            {order.address_line2 ? <><br />{order.address_line2}</> : null}
            <br />
            {[order.city, order.province, order.postal_code].filter(Boolean).join(', ')}
            <br />
            {order.country}
          </p>
          <p className="eyebrow">PAYMENT</p>
          <p>
            {order.payment_method} ·{' '}
            <span className={`tag ${statusTone(order.payment_status)}`}>{titleCase(order.payment_status)}</span>
          </p>
          {order.customer_note && (
            <>
              <p className="eyebrow" style={{ marginTop: 16 }}>YOUR NOTE</p>
              <p>{order.customer_note}</p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export function AccountWishlist() {
  const wishlist = useWishlist()
  const [products, setProducts] = useState<ProductFull[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    void fetchProductsByIds(wishlist.ids).then((list) => {
      if (!active) return
      setProducts(list)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    return () => {
      active = false
    }
  }, [wishlist.ids])

  return (
    <>
      <h2 style={{ marginBottom: 18 }}>Wishlist</h2>
      {loading ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : products.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          message="Tap the heart on any rug to keep it here for later."
          actionLabel="Browse rugs"
          actionTo="/shop"
        />
      ) : (
        <div className="gridprod three">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </>
  )
}

export function AccountDetails() {
  const { profile, updateProfile, manageAccount } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [busy, setBusy] = useState(false)


  useEffect(() => {
    if (profile) setForm({ first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone })
  }, [profile])

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateProfile(form)
      toast.success('Your details have been saved.')
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setBusy(false)
    }
  }


  return (
    <>
      <h2 style={{ marginBottom: 18 }}>My Details</h2>
      <form className="card" onSubmit={saveProfile} style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 18 }}>Personal information</h3>
        <div className="formtwocol">
          <label className="field">
            First Name
            <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} required />
          </label>
          <label className="field">
            Last Name
            <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} required />
          </label>
        </div>
        <label className="field">
          Email Address
          <input value={profile?.email ?? ''} disabled />
          <span className="subtle">Use Manage Account Security below to update your sign-in email.</span>
        </label>
        <label className="field">
          Phone
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </label>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? <Spinner label="Saving" /> : 'Save Changes'}
        </button>
      </form>

      <div className="card"><h3 style={{marginBottom:14}}>Account Security</h3><p style={{marginBottom:20}}>Manage your email, password, connected accounts and security settings securely from your account.</p><button className="btn outline" type="button" onClick={manageAccount}>Manage Account Security</button></div>
    </>
  )
}
