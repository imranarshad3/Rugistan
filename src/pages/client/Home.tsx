import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import './home-hero.css'
import { Link } from 'react-router-dom'
import { fetchBanners, fetchProducts } from '../../lib/api'
import { useStore } from '../../context/StoreContext'
import ProductCard, { ProductCardSkeleton, productCover } from '../../components/client/ProductCard'
import {
  CategoryTiles,
  FeatureRow,
  InstagramStrip,
  LifestyleBand,
  PhilosophyBand,
  SectionTitle,
  StoryBand,
} from '../../components/client/Sections'
import { Reveal } from '../../components/client/Primitives'
import type { Banner, ProductFull } from '../../lib/types'

const HERO_TITLE = 'Tradition Woven Into Every Thread.'
const HERO_FALLBACK = '/assets/rug-living-hero.webp'

export default function Home() {
  const { categories, store } = useStore()
  const [banners, setBanners] = useState<Record<string, Banner>>({})
  const [featured, setFeatured] = useState<ProductFull[]>([])
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const [bannerMap, result] = await Promise.all([
        fetchBanners(),
        fetchProducts({ featured: true, perPage: 4, sort: 'featured' }),
      ])
      if (!active) return
      setBanners(bannerMap)
      setFeatured(result.products.length ? result.products : (await fetchProducts({ perPage: 4 })).products)
      setLoading(false)
    })().catch(() => { if (active) { setLoadError(true); setLoading(false) } })
    return () => {
      active = false
    }
  }, [])

  const hero = banners.home_hero
  const heroTitle = hero?.title || HERO_TITLE
  const gallery = featured.length
    ? featured.flatMap((p) => p.images.map((i) => i.url)).slice(0, 6)
    : []

  return (
    <>
      {loadError && <div className="notice error" role="alert">We could not load the latest collection. Please refresh and try again.</div>}
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <div className="eyebrow">{hero?.eyebrow || 'Handmade Rugs for a Brighter Home'}</div>
          <h1 id="home-hero-title">{heroTitle === HERO_TITLE ? <><span>Tradition</span>{' '}<span>Woven Into</span>{' '}<span>Every Thread.</span></> : heroTitle}</h1>
          <p className="home-hero-description">
            {hero?.subtitle ||
              'Discover timeless handmade rugs, thoughtfully crafted to bring warmth, beauty, and character into your home.'}
          </p>
          <div className="home-hero-actions">
            <Link className="btn home-hero-cta" to={hero?.link_url || '/shop'}>
              {hero?.cta_label || 'Shop Collection'} <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link className="home-hero-story" to="/our-story">Our Story <span aria-hidden="true">↗</span></Link>
          </div>
          <p className="home-hero-signature"><span aria-hidden="true" />Natural textures. Individual character. Made by hand.</p>
        </div>
        <figure className="home-hero-figure">
          <div className="home-hero-image">
            <img src={HERO_FALLBACK} srcSet="/assets/rug-living-hero-640.webp 640w, /assets/rug-living-hero-960.webp 960w, /assets/rug-living-hero.webp 1672w" sizes="(max-width: 700px) calc(100vw - 2.5rem), (max-width: 1000px) 44vw, (max-width: 1792px) 54vw, 58rem" width={1672} height={941} fetchPriority="high" alt="A patterned blue rug brings warmth to a sunlit living room with natural wood and linen furnishings" />
          </div>
          <figcaption><span>The art of living well</span><span>Rugistan · Handmade living</span></figcaption>
        </figure>
      </section>

      <FeatureRow />

      {categories.length > 0 && (
        <Reveal as="section" className="section wrap">
          <SectionTitle
            eyebrow="EXPLORE BY STYLE"
            title="Shop by Category"
            description="Discover the perfect rug for your individual space."
            linkTo="/collections"
          />
          <CategoryTiles categories={categories} />
        </Reveal>
      )}

      <section className="section wrap paper">
        <SectionTitle
          eyebrow="BESTSELLERS"
          title="Our Featured Rugs"
          description="Handpicked pieces that blend heritage, quality and modern living."
          linkTo="/shop"
        />
        <div className="gridprod">
          {loading
            ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
            : featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      <StoryBand banner={banners.home_story} />

      <LifestyleBand banner={banners.home_lifestyle} />

      <PhilosophyBand />

      <InstagramStrip
        images={gallery.length ? gallery : featured.map(productCover)}
        handle={store.social?.instagram ? store.name.toLowerCase() : undefined}
      />
    </>
  )
}
