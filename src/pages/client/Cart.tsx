import { useMoney } from '../../lib/currency'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import ProductCard from '../../components/client/ProductCard'
import { PageBanner, SectionTitle } from '../../components/client/Sections'
import { EmptyState, QuantityPicker, Spinner } from '../../components/client/Primitives'
import type { ProductFull } from '../../lib/types'

export type AppliedPromo = { code: string; discount: number }

const PROMO_KEY = 'rugistan.promo.v1'

export function readStoredPromo(): AppliedPromo | null {
  try {
    const raw = sessionStorage.getItem(PROMO_KEY)
    return raw ? (JSON.parse(raw) as AppliedPromo) : null
  } catch {
    return null
  }
}

export function storePromo(promo: AppliedPromo | null) {
  try {
    if (promo) sessionStorage.setItem(PROMO_KEY, JSON.stringify(promo))
    else sessionStorage.removeItem(PROMO_KEY)
  } catch {
    /* ignore unavailable storage */
  }
}

export default function Cart() {
  const money = useMoney()
  const cart = useCart()
  const toast = useToast()
  const [suggestions, setSuggestions] = useState<ProductFull[]>([])
  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState<AppliedPromo | null>(() => readStoredPromo())
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    void fetchProducts({ perPage: 4, sort: 'featured' }).then((r) => setSuggestions(r.products)).catch(() => setSuggestions([]))
  }, [])

  // A promo stops being valid if the basket drops below its minimum.
  useEffect(() => {
    if (!promo) return
    if (cart.subtotal <= 0) {
      setPromo(null)
      storePromo(null)
    }
  }, [cart.subtotal, promo])

  async function applyPromo() {
    const code = promoInput.trim()
    if (!code) return
    setChecking(true)
    const { data, error } = await supabase.rpc('validate_promo', { p_code: code, p_subtotal: cart.subtotal })
    setChecking(false)
    const result = data as { valid?: boolean; reason?: string; code?: string; discount?: number } | null
    if (error || !result?.valid) {
      toast.error(result?.reason ?? 'That promo code could not be applied.')
      return
    }
    const applied = { code: result.code!, discount: Number(result.discount ?? 0) }
    setPromo(applied)
    storePromo(applied)
    setPromoInput('')
    toast.success(`${applied.code} applied — ${money(applied.discount)} off.`)
  }

  const total = Math.max(cart.subtotal - (promo?.discount ?? 0), 0)

  return (
    <>
      <PageBanner title="Your Cart" description="Beautiful rugs. A more meaningful home." image="/assets/rug_lifestyle_1.jpg" />

      <section className="section wrap">
        {cart.error && <div className="notice error" role="alert">{cart.error} <button className="linkbtn" type="button" onClick={() => void cart.reload()}>Try again</button></div>}
        {cart.loading ? (
          <div className="carttable">
            {Array.from({ length: 2 }, (_, i) => (
              <div className="skeleton" key={i} style={{ height: 125, marginBottom: 18 }} />
            ))}
          </div>
        ) : cart.lines.length === 0 ? (
          <EmptyState
            title="Your cart is empty"
            message="Browse the collection and add a handmade rug to get started."
            actionLabel="Shop all rugs"
            actionTo="/shop"
          />
        ) : (
          <div className="cartgrid">
            <div className="carttable">
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 15px' }}>
                <strong>Product</strong>
                <strong>Total</strong>
              </div>

              {cart.lines.map((line) => (
                <div className="cartitem" key={`${line.productId}-${line.variantId ?? 'base'}`}>
                  <Link to={`/rug/${line.product.slug}`}>
                    <img src={line.product.images[0]?.url ?? '/assets/rug_lifestyle_1.jpg'} alt={line.product.name} />
                  </Link>
                  <div>
                    <h3>
                      <Link to={`/rug/${line.product.slug}`}>{line.product.name}</Link>
                    </h3>
                    <p>
                      {[line.product.material, line.variant?.label].filter(Boolean).join(' · ')}
                    </p>
                    <p>{money(line.unitPrice)} each</p>
                    <button type="button" className="linkbtn" onClick={() => void cart.remove(line)}>
                      Remove
                    </button>
                  </div>
                  <div className="cartqty">
                    <QuantityPicker
                      value={line.quantity}
                      max={line.available}
                      onChange={(next) => void cart.setQuantity(line, next)}
                    />
                    {line.quantity >= line.available && (
                      <div className="subtle" style={{ marginTop: 6 }}>
                        Max stock reached
                      </div>
                    )}
                  </div>
                  <div className="price lineprice">{money(line.lineTotal)}</div>
                </div>
              ))}

              <div style={{ marginTop: 29 }}>
                <h3>Have a promo code?</h3>
                {promo ? (
                  <div className="notice success" style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                    <span>
                      <strong>{promo.code}</strong> applied — {money(promo.discount)} off.
                    </span>
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => {
                        setPromo(null)
                        storePromo(null)
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="promo">
                    <label className="sr-only" htmlFor="promo">
                      Promo code
                    </label>
                    <input
                      id="promo"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder="Enter promo code"
                    />
                    <button type="button" className="btn" onClick={applyPromo} disabled={checking || !promoInput.trim()}>
                      {checking ? <Spinner /> : 'Apply'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <aside className="summary">
              <h3>Order Summary</h3>
              <div className="sumrow">
                <span>
                  Subtotal ({cart.count} item{cart.count === 1 ? '' : 's'})
                </span>
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
                <span>Calculated at checkout</span>
              </div>
              <div className="sumrow total">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>
              <Link className="btn full" to="/checkout">
                Proceed to Checkout →
              </Link>
              <div className="secure">♧ &nbsp; Your details are sent over an encrypted connection</div>
              <div className="secure">♡ &nbsp; Carefully crafted natural materials</div>
            </aside>
          </div>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="section wrap cream">
          <SectionTitle eyebrow="YOU MAY ALSO LIKE" title="Complete Your Space" linkTo="/shop" />
          <div className="gridprod">
            {suggestions.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
