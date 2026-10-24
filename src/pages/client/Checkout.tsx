import { useMoney, useCurrency } from '../../lib/currency'
import { money as baseMoney } from '../../lib/format'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, readableError } from '../../lib/supabase'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import { useToast } from '../../context/ToastContext'
import { EmptyState, Spinner } from '../../components/client/Primitives'
import { readStoredPromo, storePromo } from './Cart'
import type { ShippingMethod } from '../../lib/types'

type Form = {
  first_name: string
  last_name: string
  email: string
  phone: string
  address_line1: string
  address_line2: string
  city: string
  province: string
  postal_code: string
  country: string
  note: string
}

const EMPTY: Form = {
  first_name: '', last_name: '', email: '', phone: '',
  address_line1: '', address_line2: '', city: '', province: '',
  postal_code: '', country: '', note: '',
}

const REQUIRED: (keyof Form)[] = ['first_name', 'last_name', 'email', 'address_line1', 'city', 'country']

export default function Checkout() {
  const money = useMoney()
  const displayCurrency = useCurrency()
  const cart = useCart()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, profile } = useAuth()
  const { payments, store } = useStore()

  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [methods, setMethods] = useState<ShippingMethod[]>([])
  const [shippingId, setShippingId] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  const promo = useMemo(() => readStoredPromo(), [])
  const enabledPayments = (payments.offline_methods ?? []).filter((m) => m.enabled)

  useEffect(() => {
    void supabase
      .from('shipping_methods')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const list = data ?? []
        setMethods(list)
        setShippingId((current) => current ?? list[0]?.id ?? null)
      })
  }, [])

  useEffect(() => {
    if (!paymentId && enabledPayments.length) setPaymentId(enabledPayments[0].id)
  }, [enabledPayments, paymentId])

  useEffect(() => {
    if (!profile && !user) return
    setForm((f) => ({
      ...f,
      first_name: f.first_name || profile?.first_name || '',
      last_name: f.last_name || profile?.last_name || '',
      email: f.email || profile?.email || user?.email || '',
      phone: f.phone || profile?.phone || '',
    }))
  }, [profile, user])

  const set = (key: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const shipping = methods.find((m) => m.id === shippingId) ?? null
  const shippingAmount = Number(shipping?.amount ?? 0)
  const discount = promo?.discount ?? 0
  const total = Math.max(cart.subtotal + shippingAmount - discount, 0)
  const selectedPayment = enabledPayments.find((m) => m.id === paymentId)

  function validate() {
    const next: Partial<Record<keyof Form, string>> = {}
    for (const key of REQUIRED) if (!form[key].trim()) next[key] = 'Required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function placeOrder(e: FormEvent) {
    e.preventDefault()
    setFailure('')
    if (!validate()) {
      toast.error('Please complete the highlighted fields.')
      return
    }
    if (!shippingId) {
      setFailure('Please choose a delivery method.')
      return
    }
    if (!selectedPayment) {
      setFailure('This store has no payment method available yet, so orders cannot be placed.')
      return
    }

    setBusy(true)
    const { data, error } = await supabase.rpc('place_order', {
      p_items: cart.lines.map((l) => ({
        product_id: l.productId,
        variant_id: l.variantId,
        quantity: l.quantity,
      })),
      p_contact: {
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
      },
      p_address: {
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        province: form.province,
        postal_code: form.postal_code,
        country: form.country,
      },
      p_shipping_method_id: shippingId,
      p_payment_method: paymentId,
      p_promo_code: promo?.code ?? undefined,
      p_note: form.note,
    })
    setBusy(false)

    if (error) {
      setFailure(readableError(error, 'Your order could not be placed. Please try again.'))
      await cart.reload()
      return
    }

    const result = data as { order_number: string } | null
    storePromo(null)
    await cart.reload()
    toast.success('Order placed. Thank you!')
    navigate(`/order-confirmation/${result?.order_number ?? ''}`, {
      state: { email: form.email, instructions: (data as { payment_instructions?: string })?.payment_instructions },
    })
  }

  if (!cart.loading && cart.lines.length === 0) {
    return (
      <section className="section wrap">
        <EmptyState
          title="There is nothing to check out"
          message="Add a rug to your cart and we’ll take it from there."
          actionLabel="Shop all rugs"
          actionTo="/shop"
        />
      </section>
    )
  }

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/">Home</Link> &nbsp; › &nbsp; <Link to="/cart">Cart</Link> &nbsp; › &nbsp; Checkout
      </div>

      <section className="section wrap" style={{ paddingTop: 15 }}>
        <div className="headrow">
          <div>
            <div className="eyebrow">SECURE CHECKOUT</div>
            <h2>Complete Your Order</h2>
            <p>Just one step closer to your handmade rug.</p>
          </div>
          {!user && (
            <p className="subtitle" style={{ textAlign: 'right' }}>
              Have an account?{' '}
              <Link className="inline-link" to="/login?next=/checkout">
                Sign in
              </Link>{' '}
              to check out faster.
            </p>
          )}
        </div>

        {failure && (
          <div className="notice error" style={{ marginBottom: 18 }}>
            {failure}
          </div>
        )}

        <form className="cartgrid" onSubmit={placeOrder} noValidate>
          <div>
            <div className="form-section">
              <div className="section-title">
                <b>1</b>
                <h3>Shipping Details</h3>
              </div>
              <hr className="hr" />
              <div className="formtwocol">
                <Field label="First Name" error={errors.first_name}>
                  <input value={form.first_name} onChange={set('first_name')} placeholder="First name" autoComplete="given-name" />
                </Field>
                <Field label="Last Name" error={errors.last_name}>
                  <input value={form.last_name} onChange={set('last_name')} placeholder="Last name" autoComplete="family-name" />
                </Field>
                <Field label="Email Address" error={errors.email}>
                  <input type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" autoComplete="email" />
                </Field>
                <Field label="Phone Number">
                  <input value={form.phone} onChange={set('phone')} placeholder="Phone number" autoComplete="tel" />
                </Field>
              </div>
              <Field label="Street Address" error={errors.address_line1}>
                <input value={form.address_line1} onChange={set('address_line1')} placeholder="Address" autoComplete="address-line1" />
              </Field>
              <Field label="Apartment, suite (optional)">
                <input value={form.address_line2} onChange={set('address_line2')} placeholder="Apartment, suite" autoComplete="address-line2" />
              </Field>
              <div className="formtwocol">
                <Field label="City" error={errors.city}>
                  <input value={form.city} onChange={set('city')} placeholder="City" autoComplete="address-level2" />
                </Field>
                <Field label="Province / State">
                  <input value={form.province} onChange={set('province')} placeholder="Province" autoComplete="address-level1" />
                </Field>
                <Field label="Postal Code">
                  <input value={form.postal_code} onChange={set('postal_code')} placeholder="Postal code" autoComplete="postal-code" />
                </Field>
                <Field label="Country" error={errors.country}>
                  <input value={form.country} onChange={set('country')} placeholder="Country" autoComplete="country-name" />
                </Field>
              </div>
              <Field label="Order notes (optional)">
                <textarea
                  value={form.note}
                  onChange={set('note')}
                  placeholder="Delivery instructions or anything we should know"
                  style={{ height: 90 }}
                />
              </Field>
            </div>

            <div className="form-section">
              <div className="section-title">
                <b>2</b>
                <h3>Delivery Method</h3>
              </div>
              <hr className="hr" />
              {methods.length === 0 ? (
                <p className="notice">No delivery methods have been configured yet. Please contact us to complete your order.</p>
              ) : (
                methods.map((m) => (
                  <label className={`radio-row ${shippingId === m.id ? 'selected' : ''}`} key={m.id}>
                    <span>
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingId === m.id}
                        onChange={() => setShippingId(m.id)}
                      />
                      <strong>{m.name}</strong>
                      {m.description && <span className="subtle" style={{ display: 'block', marginLeft: 26 }}>{m.description}</span>}
                    </span>
                    <span>{Number(m.amount) === 0 ? 'Free' : money(m.amount)}</span>
                  </label>
                ))
              )}
            </div>

            <div className="form-section">
              <div className="section-title">
                <b>3</b>
                <h3>Payment Method</h3>
              </div>
              <hr className="hr" />
              {enabledPayments.length === 0 ? (
                <div className="notice error">
                  No payment provider has been configured for this store yet, so orders cannot be completed online.
                  Please <Link className="inline-link" to="/contact">contact us</Link> to arrange your purchase.
                </div>
              ) : (
                <>
                  {enabledPayments.map((m) => (
                    <label className={`radio-row ${paymentId === m.id ? 'selected' : ''}`} key={m.id}>
                      <span>
                        <input type="radio" name="payment" checked={paymentId === m.id} onChange={() => setPaymentId(m.id)} />
                        <strong>{m.label}</strong>
                      </span>
                      <span className="subtle">
                        {m.marks_as === 'awaiting_confirmation' ? 'Payment confirmed by our team' : 'Pay on delivery'}
                      </span>
                    </label>
                  ))}
                  {selectedPayment?.instructions && <p className="notice" style={{ marginTop: 14 }}>{selectedPayment.instructions}</p>}
                  {(payments.gateways ?? []).length === 0 && (
                    <p className="subtle" style={{ marginTop: 14 }}>
                      Card payments will appear here once a payment gateway is connected in the store settings.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <aside className="summary">
            <h3>Order Summary</h3>
            {cart.lines.map((line) => (
              <div
                key={`${line.productId}-${line.variantId ?? 'base'}`}
                style={{ display: 'flex', gap: 15, padding: '20px 0', borderBottom: '1px solid #dfd1c1' }}
              >
                <img
                  style={{ width: 80, height: 95, objectFit: 'cover' }}
                  src={line.product.images[0]?.url ?? '/assets/rug_lifestyle_1.jpg'}
                  alt=""
                  aria-hidden="true"
                />
                <div>
                  <h3 style={{ fontSize: '1.1875rem' }}>{line.product.name}</h3>
                  <p>
                    Qty {line.quantity}
                    {line.variant ? ` · ${line.variant.label}` : ''}
                  </p>
                  <div className="price" style={{ fontSize: '1.25rem' }}>
                    {money(line.lineTotal)}
                  </div>
                </div>
              </div>
            ))}
            <div className="sumrow">
              <span>Subtotal</span>
              <strong>{money(cart.subtotal)}</strong>
            </div>
            {promo && (
              <div className="sumrow">
                <span>Discount ({promo.code})</span>
                <strong>−{money(promo.discount)}</strong>
              </div>
            )}
            <div className="sumrow">
              <span>Shipping</span>
              <strong>{shipping ? (shippingAmount === 0 ? 'Free' : money(shippingAmount)) : 'Select a method'}</strong>
            </div>
            <div className="sumrow total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            {displayCurrency.code !== store.currency && !displayCurrency.error && <p className="checkout-currency-note">Estimated display total in {displayCurrency.code}. Your order will be charged {baseMoney(total)} in {store.currency}.</p>}
            <button className="btn full" type="submit" disabled={busy || enabledPayments.length === 0 || methods.length === 0}>
              {busy ? <Spinner label="Placing order" /> : 'Place Order Securely →'}
            </button>
            <p className="subtle" style={{ marginTop: 15 }}>
              Prices, stock and totals are confirmed on our server when the order is placed.
            </p>
          </aside>
        </form>
      </section>
    </>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className={`field ${error ? 'invalid' : ''}`.trim()}>
      {label}
      {children}
      {error && <span className="err">{error}</span>}
    </label>
  )
}
