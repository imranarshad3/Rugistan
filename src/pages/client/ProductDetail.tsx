import Select from '../../components/ui/Select'
import { isVideoMedia } from '../../lib/productMedia'
import { useMoney } from '../../lib/currency'
import Icon from '../../components/client/Icon'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchProductBySlug, fetchProductReviews, fetchRelatedProducts } from '../../lib/api'
import { supabase, readableError } from '../../lib/supabase'
import { shortDate } from '../../lib/format'
import { useCart } from '../../context/CartContext'
import { useWishlist } from '../../context/WishlistContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import ProductCard from '../../components/client/ProductCard'
import { FeatureRow, SectionTitle } from '../../components/client/Sections'
import { Accordion, EmptyState, QuantityPicker, Spinner, Stars } from '../../components/client/Primitives'
import type { ColorSwatch, ProductFull, Review } from '../../lib/types'

export default function ProductDetail() {
  const money = useMoney()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { add } = useCart()
  const wishlist = useWishlist()
  const toast = useToast()
  const { user, isAdmin, loading: authLoading } = useAuth()

  const [product, setProduct] = useState<ProductFull | null>(null)
  const [related, setRelated] = useState<ProductFull[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const productId = product?.id
  useEffect(() => {
    if (!productId || authLoading || isAdmin) return
    let sessionKey: string
    try {
      sessionKey = sessionStorage.getItem('rugistan_view_session') || crypto.randomUUID()
      sessionStorage.setItem('rugistan_view_session', sessionKey)
    } catch { return }
    // The unique key also deduplicates React StrictMode effects and page reloads.
    void supabase.from('product_views').insert({ product_id: productId, session_key: sessionKey })
      .then(() => undefined)
  }, [productId, authLoading, isAdmin])

  const [activeImage, setActiveImage] = useState(0)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [colorIndex, setColorIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState<'cart' | 'buy' | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setNotFound(false)
    setLoadError(false)
    setProduct(null)
    setRelated([])
    setReviews([])
    setActiveImage(0)
    setQuantity(1)
    ;(async () => {
      const found = await fetchProductBySlug(slug)
      if (!active) return
      if (!found) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setProduct(found)
      const firstSellable = found.variants.find((v) => v.is_active && v.stock_quantity > 0) ?? found.variants.find(v => v.is_active) ?? null
      setVariantId(firstSellable?.id ?? null)
      setLoading(false)
      const [rel, revs] = await Promise.all([
        fetchRelatedProducts(found),
        fetchProductReviews(found.id),
      ])
      if (!active) return
      setRelated(rel)
      setReviews(revs)
    })().catch(() => { if (active) { setLoadError(true); setLoading(false) } })
    return () => {
      active = false
    }
  }, [slug])

  const variant = useMemo(
    () => product?.variants.find((v) => v.id === variantId) ?? null,
    [product, variantId],
  )
  const unitPrice = product ? Number(product.price) + Number(variant?.price_delta ?? 0) : 0
  const available = Math.min(10, variant ? (variant.is_active ? variant.stock_quantity : 0) : (product?.variants.length ? 0 : product?.stock_quantity ?? 0))
  const colors = (product?.colors ?? []) as unknown as ColorSwatch[]

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(q, 1), Math.max(available, 1)))
  }, [available])

  async function addToCart(then: 'stay' | 'checkout') {
    if (!product || busy) return
    setBusy(then === 'stay' ? 'cart' : 'buy')
    const error = await add(product.id, variantId, quantity)
    setBusy(null)
    if (error) {
      toast.error(error)
      return
    }
    if (then === 'checkout') navigate('/checkout')
    else toast.success(`${product.name} added to your cart.`)
  }

  if (loading) {
    return (
      <div className="pd-layout">
        <div>
          <div className="skeleton pd-primary" />
          <div className="thumbrow">
            {Array.from({ length: 5 }, (_, i) => (
              <div className="skeleton" key={i} style={{ height: 122 }} />
            ))}
          </div>
        </div>
        <div>
          <div className="skeleton" style={{ height: 60, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 24, width: '50%', marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 160 }} />
        </div>
      </div>
    )
  }

  if (notFound || !product) {
    return (
      <section className="section wrap">
        <EmptyState
          title={loadError ? "This rug is temporarily unavailable" : "That rug could not be found"}
          message={loadError ? "We could not reach the store. Please refresh and try again." : "It may have sold out or been renamed. Browse the full collection to find something similar."}
          actionLabel="Shop all rugs"
          actionTo="/shop"
        />
      </section>
    )
  }

  const images = product.images.length ? product.images : [{ id: 'f', url: '/assets/rug_lifestyle_1.jpg', alt: product.name } as never]
  const saved = wishlist.has(product.id)

  return (
    <>
      {loadError && <div className="notice error" role="alert">We could not load the latest collection. Please refresh and try again.</div>}
      <div className="breadcrumbs">
        <Link to="/">Home</Link> &nbsp; › &nbsp; <Link to="/shop">All Rugs</Link>
        {product.category && (
          <>
            {' '}
            &nbsp; › &nbsp; <Link to={`/shop?category=${product.category.slug}`}>{product.category.name}</Link>
          </>
        )}
        &nbsp; › &nbsp; {product.name}
      </div>

      <div className="pd-layout">
        <div>
          {isVideoMedia(images[activeImage]?.url ?? "") ? <video key={images[activeImage]?.url} className="pd-primary" src={images[activeImage]?.url} controls playsInline preload="metadata" aria-label={`${product.name} video`} /> : <img className="pd-primary" src={images[activeImage]?.url} alt={product.name} />}
          {images.length > 1 && (
            <div className="thumbrow">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  aria-current={i === activeImage}
                  aria-label={`View ${isVideoMedia(img.url) ? "video" : "photo"} ${i + 1}`}
                  onClick={() => setActiveImage(i)}
                >
                  {isVideoMedia(img.url) ? <span className="pd-video-thumb">▶<small>Video</small></span> : <img src={img.url} alt="" aria-hidden="true" loading="lazy" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-copy">
          <div className="eyebrow">{product.material ? `HANDMADE ${product.material.toUpperCase()} RUG` : 'HANDMADE RUG'}</div>
          <h1>{product.name}</h1>

          <div className="review">
            {product.rating_count > 0 ? (
              <>
                <Stars rating={Number(product.rating_avg)} />
                <span style={{ color: '#655448' }}>
                  {'  '}
                  {Number(product.rating_avg).toFixed(1)} from {product.rating_count} review
                  {product.rating_count === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              <span style={{ color: '#655448' }}>No reviews yet — be the first to review this rug.</span>
            )}
          </div>

          <div className="pd-price">
            {money(unitPrice)}
            {product.compare_at_price && Number(product.compare_at_price) > unitPrice && (
              <del>{money(product.compare_at_price)}</del>
            )}
          </div>

          <p>{product.short_description}</p>
          <hr className="hr" />

          {colors.length > 0 && (
            <>
              <strong>Color: {colors[colorIndex]?.name}</strong>
              <div className="swatches">
                {colors.map((c, i) => (
                  <button
                    key={c.name}
                    type="button"
                    aria-pressed={i === colorIndex}
                    aria-label={c.name}
                    title={c.name}
                    style={{ background: c.hex }}
                    onClick={() => setColorIndex(i)}
                  />
                ))}
              </div>
            </>
          )}

          {product.variants.length > 0 && (
            <>
              <strong style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>Choose a Size</span>
                <Link className="inline-link" to="/page/size-guide">
                  Size Guide ↗
                </Link>
              </strong>
              <div className="size-buttons">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={v.id === variantId}
                    disabled={!v.is_active || v.stock_quantity <= 0}
                    title={v.stock_quantity <= 0 ? 'Out of stock' : `${money(Number(product.price) + Number(v.price_delta))}`}
                    onClick={() => setVariantId(v.id)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <p style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span>Quantity</span>
            <QuantityPicker value={quantity} max={Math.max(available, 1)} onChange={setQuantity} />
            <span className="subtle">
              {available > 0 ? `${available} in stock` : 'Currently out of stock'}
            </span>
          </p>

          <div className="pd-actions">
            <button type="button" className="btn" disabled={available <= 0 || busy !== null} onClick={() => addToCart('stay')}>
              {busy === 'cart' ? <Spinner /> : available <= 0 ? 'Out of Stock' : 'Add to Cart  →'}
            </button>
            <button type="button" className="btn gold" disabled={available <= 0 || busy !== null} onClick={() => addToCart('checkout')}>
              {busy === 'buy' ? <Spinner /> : 'Buy Now'}
            </button>
          </div>

          <button
            type="button"
            className="inline-link"
            style={{ marginTop: 18 }}
            onClick={async () => {
              const on = await wishlist.toggle(product.id)
              toast.notify(on ? 'Saved to your wishlist.' : 'Removed from your wishlist.')
            }}
          >
            <Icon name="heart" /> {saved ? 'Saved to wishlist' : 'Save to wishlist'}
          </button>

          <p style={{ marginTop: 20, fontSize: '0.875rem', color: '#81705f' }}>
            {[product.material, product.weave_technique, 'Shipping calculated at checkout'].filter(Boolean).join('  ·  ')}
          </p>


        </div>
      </div>

      <FeatureRow />
      <section className="section wrap product-editorial">
        <div className="product-craft-visual"><div className="product-craft-caption"><div className="eyebrow">MADE BY HAND</div><h2>The Art of Handwoven Rugs</h2><p>Texture, tradition and the beauty of patient work.</p><Link className="btn outline" to="/our-story">Discover Our Craft →</Link></div></div>
        <div>          <div className="product-information">
            <Accordion title="Product Details" defaultOpen>
              <p>{product.description || product.short_description}</p>
            </Accordion>
            <Accordion title="Materials & Craftsmanship">
              <p>
                {[
                  product.material && `Material: ${product.material}`,
                  product.weave_technique && `Technique: ${product.weave_technique}`,
                  product.dimensions && `Standard size: ${product.dimensions}`,
                  product.color && `Primary colour: ${product.color}`,
                  `SKU: ${product.sku}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </Accordion>
            <Accordion title="Care Instructions">
              <p>
                Vacuum gently without a beater bar, blot spills immediately with a dry cloth, and rotate the rug twice a
                year. Full guidance is on our <Link className="inline-link" to="/rug-care">rug care page</Link>.
              </p>
            </Accordion>
            <Accordion title="Delivery & Returns">
              <p>
                Delivery options and charges are confirmed at checkout based on your address. See{' '}
                <Link className="inline-link" to="/page/shipping-and-returns">shipping &amp; returns</Link> for the full policy.
              </p>
            </Accordion>
          </div><div className="product-legacy"><div className="eyebrow">OUR CRAFTSMANSHIP</div><h3>A Legacy of People, Tradition & Craft</h3><p>Explore the materials, makers and thoughtful details behind our rugs.</p><Link className="btn" to="/our-story">Our Story →</Link></div></div>
      </section>

      <ReviewsSection
        product={product}
        reviews={reviews}
        canReview={Boolean(user)}
        onSubmitted={() => void fetchProductReviews(product.id).then(setReviews)}
      />



      {related.length > 0 && (
        <section className="section wrap">
          <SectionTitle eyebrow="YOU MAY ALSO LIKE" title="Similar Rugs" linkTo="/shop" />
          <div className="gridprod">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function ReviewsSection({
  product,
  reviews,
  canReview,
  onSubmitted,
}: {
  product: ProductFull
  reviews: Review[]
  canReview: boolean
  onSubmitted: () => void
}) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (body.trim().length < 10) {
      toast.error('Please write at least a sentence about the rug.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('reviews').insert({
      product_id: product.id,
      user_id: user.id,
      author_name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Rugistan customer',
      rating,
      title: title.trim(),
      body: body.trim(),
      status: 'pending',
    })
    setBusy(false)
    if (error) {
      toast.error(readableError(error))
      return
    }
    setOpen(false)
    setTitle('')
    setBody('')
    setRating(5)
    toast.success('Thank you — your review has been sent for approval.')
    onSubmitted()
  }

  return (
    <section className="section wrap cream">
      <SectionTitle
        eyebrow="CUSTOMER REVIEWS"
        title={reviews.length ? `${reviews.length} Review${reviews.length === 1 ? '' : 's'}` : 'Reviews'}
        description={
          reviews.length
            ? 'Every review is read and approved by our team before it appears here.'
            : 'No approved reviews for this rug yet.'
        }
      />

      {reviews.length > 0 && (
        <div className="testimonials" style={{ marginTop: 0 }}>
          {reviews.slice(0, 6).map((r) => (
            <div className="quote" key={r.id}>
              <Stars rating={r.rating} />
              {r.title && <h3 style={{ marginTop: 14, fontSize: '1.25rem' }}>{r.title}</h3>}
              <p>{r.body}</p>
              <strong>
                {r.author_name.toUpperCase()} · {shortDate(r.created_at)}
              </strong>
              {r.admin_reply && (
                <p style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #eadfd3', fontSize: '0.875rem' }}>
                  <strong>Rugistan:</strong> {r.admin_reply}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        {!canReview ? (
          <p className="subtitle">
            <Link className="inline-link" to="/login">
              Sign in
            </Link>{' '}
            to write a review for this rug.
          </p>
        ) : !open ? (
          <button type="button" className="btn outline" onClick={() => setOpen(true)}>
            Write a Review
          </button>
        ) : (
          <form className="card" onSubmit={submit} style={{ maxWidth: 620 }}>
            <div className="eyebrow">YOUR REVIEW</div>
            <h3 style={{ marginBottom: 18 }}>Tell us about {product.name}</h3>
            <label className="field">
              Rating
              <Select aria-label="Review rating" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {'★'.repeat(n)} ({n})
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              Headline
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarise your experience" />
            </label>
            <label className="field">
              Your review
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What do you think of the colour, texture and quality?"
                required
              />
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? <Spinner /> : 'Submit Review'}
              </button>
              <button className="btn outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
            <p className="subtle" style={{ marginTop: 14 }}>
              Reviews are published after our team has approved them.
            </p>
          </form>
        )}
      </div>
    </section>
  )
}
