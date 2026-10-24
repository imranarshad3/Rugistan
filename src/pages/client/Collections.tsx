import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { fetchBanners, fetchProducts } from '../../lib/api'
import { useStore } from '../../context/StoreContext'
import ProductCard, { ProductCardSkeleton, productCover } from '../../components/client/ProductCard'
import {
  CategoryTiles,
  InstagramStrip,
  PageBanner,
  SectionTitle,
  StoryBand,
} from '../../components/client/Sections'
import type { Banner, ProductFull } from '../../lib/types'

export default function Collections() {
  const { categories } = useStore()
  const [banners, setBanners] = useState<Record<string, Banner>>({})
  const [products, setProducts] = useState<ProductFull[]>([])
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const [map, result] = await Promise.all([fetchBanners(), fetchProducts({ perPage: 4, sort: 'rating' })])
      if (!active) return
      setBanners(map)
      setProducts(result.products)
      setLoading(false)
    })().catch(() => { if (active) { setLoadError(true); setLoading(false) } })
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      {loadError && <div className="notice error" role="alert">We could not load the latest collection. Please refresh and try again.</div>}
      <PageBanner
        title="Collections"
        editorial
        eyebrow="CURATED BY RUGISTAN"
        cta="Explore Our Collections"
        ctaTo="#our-collections"
        description="Curated rug collections combining handmade tradition and thoughtful contemporary design."
        image="/assets/rug-living-hero.webp"
      />

      <section className="section wrap" id="our-collections">
        <SectionTitle
          eyebrow="EXPLORE BY STYLE"
          title="Our Collections"
          description="Distinctive styles, one shared love of craftsmanship."
          linkTo="/shop"
          linkLabel="Explore the collection →"
        />
        <div className="collection-catalog"><CategoryTiles categories={categories} />
        <div className="collection-edits">
          <Link className="collection-edit" to="/shop?room=Bedroom"><div className="edit-photo edit-neutral"/><h3>Bedroom Soft Neutrals</h3><p>Quiet textures and a softer landing for your most restful space.</p><span>Shop Bedroom Rugs →</span></Link>
          <Link className="collection-edit" to="/shop?room=Living%20Room"><img src="/assets/rug_lifestyle_3.jpg" alt="A handmade rug in a living room" loading="lazy"/><h3>Living Room Statements</h3><p>Expressive patterns and natural textures to bring your room together.</p><span>Shop Living Room Rugs →</span></Link>
        </div></div>
      </section>

      <section className="section wrap cream">
        <SectionTitle
          eyebrow="FEATURED COLLECTIONS"
          title="Most Loved Collections"
          description="Textures, colors and patterns made for real homes."
          linkTo="/shop?sort=rating"
        />
        <div className="gridprod">
          {loading
            ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
            : products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      <StoryBand banner={banners.home_story} />

      <InstagramStrip images={products.map(productCover)} />
    </>
  )
}
