import { ArrowDownRight, Sparkles } from 'lucide-react'
import Icon from './Icon'
import { Link } from 'react-router-dom'
import { Reveal, SectionTitle } from './Primitives'
import type { Banner, Category } from '../../lib/types'

const FALLBACK = '/assets/rug-living-hero.webp'

export function PageBanner({
  eyebrow = 'RUGISTAN HANDMADE RUGS',
  title,
  description,
  image = FALLBACK,
  cta,
  ctaTo,
  editorial = false,
  shop = false,
}: {
  eyebrow?: string
  title: string
  description?: string
  image?: string | null
  cta?: string
  ctaTo?: string
  editorial?: boolean
  shop?: boolean
}) {
  return (
    <div className={`banner${editorial ? ' banner-editorial' : ''}${shop ? ' shop-hero' : ''}`}>
      <img src={image || FALLBACK} alt="" aria-hidden="true" />
      <div className="shade" />
      {shop && <span className="shop-hero-caption">THE ART OF LIVING WELL <span>RUGISTAN / COLLECTION</span></span>}
      <div className="inner">
        <div className="banner-crumb"><Link to="/">Home</Link><span>›</span><span>{title}</span></div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {shop && <span className="shop-hero-rule" aria-hidden="true" />}
        {description && <p>{description}</p>}
        {shop && <><a className="btn shop-hero-cta" href="#rug-catalogue">Explore Rugs <ArrowDownRight size={18} aria-hidden="true" /></a><div className="shop-hero-note"><Sparkles size={16} aria-hidden="true" /><span>Natural textures. Timeless character.</span></div></>}
        {cta && ctaTo && <Link className="btn" to={ctaTo}>{cta} <Icon name="arrow" /></Link>}
      </div>
    </div>
  )
}

export function FeatureRow() {
  const features = [
    ['leaf', '100% Natural Wool', 'Beautiful, lasting materials'],
    ['heart', 'Made by Hand', 'Crafted with patience and care'],
    ['spark', 'Durable & Timeless', 'Artistry for generations'],
    ['truck', 'Shipping Options', 'Confirmed at checkout'],
  ] as const
  return (
    <section className="feature-row">
      {features.map(([icon, title, note]) => (
        <div className="feature" key={title}>
          <div className="icon" aria-hidden="true">
            <Icon name={icon} />
          </div>
          <div>
            <strong>{title}</strong>
            <small>{note}</small>
          </div>
        </div>
      ))}
    </section>
  )
}

export function CategoryTiles({ categories, three = false }: { categories: Category[]; three?: boolean }) {
  if (!categories.length) return null
  return (
    <div className={`tiles ${three ? 'three' : ''}`.trim()}>
      {categories.map((c, index) => (
        <article className="tile" key={c.id}>
          <Link to={`/shop?category=${c.slug}`}>
            <div className="pic">
              <img src={c.image_url || FALLBACK} alt={c.name} loading="lazy" />
              <span className="tile-veil" aria-hidden="true" />
              <span className="tile-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div className="tile-copy">
                <div className="tile-heading"><h3>{c.name}</h3></div>
                {c.description && <p>{c.description}</p>}
                <span className="tilelink">Explore collection <span aria-hidden="true">→</span></span>
              </div>
            </div>
          </Link>
        </article>
      ))}
    </div>
  )
}

export function StoryBand({
  banner,
  reverse = false,
  fallbackImage = '/assets/rug_handmade_blue.jpg',
}: {
  banner?: Banner | null
  reverse?: boolean
  fallbackImage?: string
}) {
  const image = banner?.image_url || fallbackImage
  const copy = (
    <div className="storycopy">
      <div className="eyebrow">{banner?.eyebrow || 'OUR CRAFTSMANSHIP'}</div>
      <h2>{banner?.title || 'A Story of People, Tradition & Craft'}</h2>
      <p>
        {banner?.subtitle ||
          'Every Rugistan piece celebrates handmade textures and the artistry that turns natural fibers into treasured pieces.'}
      </p>
      <div className="craft-values">{([['leaf','Natural materials'],['heart','Made by hand'],['spark','Individual character']] as const).map(([name,label])=><div className="craft-value" key={name}><Icon name={name}/><span>{label}</span></div>)}</div>
      <Link className="btn" to={banner?.link_url || '/our-story'}>
        {banner?.cta_label || 'Discover Our Story'} →
      </Link>
    </div>
  )

  return (
    <div className="storyband">
      {reverse ? copy : image ? <img src={image} alt="" aria-hidden="true" loading="lazy" /> : <div className="craft-photo" role="img" aria-label="Artisan hands weaving a wool rug" />}
      {reverse ? <div className="craft-photo" role="img" aria-label="Artisan hands weaving a wool rug" /> : copy}
    </div>
  )
}

export function LifestyleBand({ banner, fallbackImage = '/assets/blue_rug_interior.jpg' }: { banner?: Banner | null; fallbackImage?: string }) {
  return (
    <div className="lifestyle">
      <img src={banner?.image_url || fallbackImage} alt="" aria-hidden="true" loading="lazy" />
      <div className="text">
        {banner?.eyebrow && <div className="eyebrow">{banner.eyebrow}</div>}
        <h2>{banner?.title || 'Rugs for Every Space'}</h2>
        {banner?.subtitle && <p>{banner.subtitle}</p>}
        <Link className="btn" to={banner?.link_url || '/shop'}>
          {banner?.cta_label || 'Shop Now'} →
        </Link>
      </div>
    </div>
  )
}

/**
 * Rugistan's own design philosophy — brand copy, not customer testimonials.
 * Real customer reviews appear on product pages once they are approved.
 */
export function PhilosophyBand() {
  const items = [
    ['Handmade with intention', 'The beauty of craft is in the small details: texture, balance and natural materials.'],
    ['Warmth in every detail', 'Your home deserves tactile comfort, lasting quality and a considered design.'],
    ['Designed for real spaces', 'Discover color, character and thoughtful materials for your everyday spaces.'],
  ]
  return (
    <section className="section cream center philosophy">
      <div className="eyebrow">A CLOSER LOOK</div>
      <h2>Made to Feel Like Home</h2>
      <p className="subtitle">From quiet textures to expressive patterns, find a rug that fits the way you live.</p>
      <div className="testimonials">
        {items.map(([title, body], index) => (
          <Reveal className="quote" key={title}>
            <span className="quote-number">0{index + 1}</span>
            <h3 style={{ marginBottom: 12 }}>{title}</h3>
            <p>{body}</p>
            <strong>RUGISTAN DESIGN PHILOSOPHY</strong>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export function InstagramStrip({ images, handle }: { images: string[]; handle?: string }) {
  if (!images.length) return null
  return (
    <section className="section wrap journal-gallery">
      <div className="eyebrow">FOLLOW OUR JOURNEY</div>
      <h2 style={{ marginBottom: 24 }}>{handle ? `@${handle}` : 'Rugistan in Real Homes'}</h2>
      <div className="gallery">
        {images.slice(0, 6).map((src, i) => (
          <img key={`${src}-${i}`} src={src} alt="" aria-hidden="true" loading="lazy" />
        ))}
      </div>
    </section>
  )
}

export function ProcessSteps({ steps }: { steps: [string, string, string][] }) {
  return (
    <div className="steps">
      {steps.map(([num, title, body]) => (
        <Reveal className="step" key={num}>
          <b>{num}</b>
          <div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

export { SectionTitle }
