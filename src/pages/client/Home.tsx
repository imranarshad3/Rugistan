import { useEffect, useState } from 'react'
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

const HERO_FALLBACK = '/assets/rug-living-hero.webp'

export default function Home() {
  const { categories, store } = useStore()
  const [banners, setBanners] = useState<Record<string, Banner>>({})
  const [featured, setFeatured] = useState<ProductFull[]>([])
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
    })()
    return () => {
      active = false
    }
  }, [])

  const hero = banners.home_hero
  const gallery = featured.length
    ? featured.flatMap((p) => p.images.map((i) => i.url)).slice(0, 6)
    : []

  return (
    <>
      <div className="cover hero">
        <img src={hero?.image_url || HERO_FALLBACK} alt="" aria-hidden="true" />
        <div className="shade" />
        <div className="cover-text">
          <div className="eyebrow">{hero?.eyebrow || 'Handmade Rugs for a Brighter Home'}</div>
          <h1>{hero?.title || 'Tradition Woven Into Every Thread.'}</h1>
          <p className="subtitle">
            {hero?.subtitle ||
              'Discover timeless handmade rugs, thoughtfully crafted to bring warmth, beauty, and character into your home.'}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link className="btn" to={hero?.link_url || '/shop'}>
              {hero?.cta_label || 'Shop Collection'} &nbsp; →
            </Link>
            <Link className="btn outline" to="/our-story">
              Our Story
            </Link>
          </div>
          <div className="hero-footnote"><span className="hero-thread" />Natural textures. Individual character. Made by hand.</div>
        </div>
        <span className="hero-edition">THE RUGISTAN COLLECTION · HANDMADE LIVING</span>
      </div>

      <FeatureRow />

      <Reveal as="section" className="section wrap">
        <SectionTitle
          eyebrow="EXPLORE BY STYLE"
          title="Shop by Category"
          description="Discover the perfect rug for your individual space."
          linkTo="/collections"
        />
        <CategoryTiles categories={categories} />
      </Reveal>

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
