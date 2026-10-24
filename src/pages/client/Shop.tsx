import PremiumSelect from '../../components/client/PremiumSelect'
import { useMoney } from '../../lib/currency'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchBanners, fetchFilterFacets, fetchProducts, type ProductSort } from '../../lib/api'
import { useStore } from '../../context/StoreContext'
import ProductCard, { ProductCardSkeleton } from '../../components/client/ProductCard'
import { LifestyleBand, PageBanner } from '../../components/client/Sections'
import { EmptyState } from '../../components/client/Primitives'
import type { Banner, ProductFull } from '../../lib/types'

const PER_PAGE = 12

const PRICE_BANDS = [
  { id: 'under-300', label: 'Under 300', min: null, max: 299.99 },
  { id: '300-500', label: '300 – 500', min: 300, max: 500 },
  { id: 'over-500', label: '500+', min: 500.01, max: null },
]

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'name', label: 'Name A–Z' },
]

type Facets = Awaited<ReturnType<typeof fetchFilterFacets>>

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  const [open, setOpen] = useState(true)
  if (!options.length) return null
  return (
    <section>
      <h4>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span>{title}</span>
          <span className={`chev ${open ? 'open' : ''}`} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6" /></svg>
          </span>
        </button>
      </h4>
      {open &&
        options.map((option) => (
          <label key={option}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />
            {option}
          </label>
        ))}
    </section>
  )
}

export default function Shop() {
  const money = useMoney()
  const [params, setParams] = useSearchParams()
  const { categories } = useStore()
  const [facets, setFacets] = useState<Facets | null>(null)
  const [products, setProducts] = useState<ProductFull[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const list = useCallback((key: string) => params.getAll(key), [params])
  const search = params.get('q') ?? ''
  const sort = (params.get('sort') as ProductSort) || 'featured'
  const page = Math.max(Number(params.get('page') ?? 1), 1)
  const featured = params.get('featured') === '1'
  const priceBand = params.get('price')

  const band = PRICE_BANDS.find((b) => b.id === priceBand)

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params)
      mutate(next)
      if (!next.get('page')) next.delete('page')
      setParams(next, { replace: false })
    },
    [params, setParams],
  )

  const toggle = useCallback(
    (key: string, value: string) => {
      update((next) => {
        const current = next.getAll(key)
        next.delete(key)
        const after = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
        for (const v of after) next.append(key, v)
        next.delete('page')
      })
    },
    [update],
  )

  useEffect(() => {
    void fetchFilterFacets().then(setFacets)
    void fetchBanners().then((map) => setBanner(map.shop_lifestyle ?? map.home_lifestyle ?? null))
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const result = await fetchProducts({
          categories: list('category'),
          sizes: list('size'),
          styles: list('style'),
          materials: list('material'),
          rooms: list('room'),
          minPrice: band?.min ?? null,
          maxPrice: band?.max ?? null,
          search,
          featured,
          sort,
          page,
          perPage: PER_PAGE,
        })
        if (!active) return
        setProducts(result.products)
        setTotal(result.total)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [list, band, search, featured, sort, page])

  const pageCount = Math.max(Math.ceil(total / PER_PAGE), 1)
  const activeChips = useMemo(() => {
    const chips: { key: string; value: string; label: string }[] = []
    for (const key of ['category', 'size', 'style', 'material', 'room'] as const) {
      for (const value of params.getAll(key)) {
        const label = key === 'category' ? categories.find((c) => c.slug === value)?.name ?? value : value
        chips.push({ key, value, label })
      }
    }
    if (band) chips.push({ key: 'price', value: band.id, label: band.label })
    if (search) chips.push({ key: 'q', value: search, label: `“${search}”` })
    if (featured) chips.push({ key: 'featured', value: '1', label: 'Bestsellers' })
    return chips
  }, [params, categories, band, search, featured])

  const first = total === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const last = Math.min(page * PER_PAGE, total)

  return (
    <>
      <PageBanner
        title="Shop All Rugs"
        description="Every handmade rug is a new chapter of comfort, design and craftsmanship."
        image="/assets/rug_lifestyle_1.jpg"
      />

      <section className="section sidebar-layout">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`} aria-label="Product filters">
          <div className="filter-heading">
            <div><span className="filter-kicker">CURATE YOUR SPACE</span><h3>Refine your search</h3></div>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="var(--paper)" /><circle cx="15" cy="17" r="2" fill="var(--paper)" /></svg>
          </div>
          <FilterGroup
            title="Collection"
            options={categories.map((c) => c.name)}
            selected={categories.filter((c) => list('category').includes(c.slug)).map((c) => c.name)}
            onToggle={(name) => {
              const slug = categories.find((c) => c.name === name)?.slug
              if (slug) toggle('category', slug)
            }}
          />
          <FilterGroup title="Size" options={facets?.sizes ?? []} selected={list('size')} onToggle={(v) => toggle('size', v)} />
          <FilterGroup title="Style" options={facets?.styles ?? []} selected={list('style')} onToggle={(v) => toggle('style', v)} />
          <FilterGroup title="Material" options={facets?.materials ?? []} selected={list('material')} onToggle={(v) => toggle('material', v)} />
          <FilterGroup title="Room" options={facets?.rooms ?? []} selected={list('room')} onToggle={(v) => toggle('room', v)} />
          <section>
            <h4>
              <span>Price</span>
            </h4>
            {PRICE_BANDS.map((b) => (
              <label key={b.id}>
                <input
                  type="radio"
                  name="price"
                  checked={priceBand === b.id}
                  onChange={() => update((next) => { next.set('price', b.id); next.delete('page') })}
                />
                {b.label === '500+' ? `${money(500)}+` : b.label.includes('–') ? `${money(300)} – ${money(500)}` : `Under ${money(300)}`}
              </label>
            ))}
          </section>
          {activeChips.length > 0 && (
            <section>
              <button type="button" className="btn outline sm full" onClick={() => setParams(new URLSearchParams())}>
                Clear all filters
              </button>
            </section>
          )}
        </aside>

        <div>
          <div className="sortrow">
            <button
              type="button"
              className="btn outline sm filtertoggle"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              {filtersOpen ? 'Hide filters' : 'Filters'}
            </button>
            <span>
              {loading
                ? 'Loading rugs…'
                : total === 0
                  ? 'No rugs match these filters'
                  : `Showing ${first}–${last} of ${total} rug${total === 1 ? '' : 's'}`}
            </span>
            <PremiumSelect label="Sort by" value={sort} options={SORTS} onChange={value => update(next => { next.set('sort', value); next.delete('page') })} />
          </div>

          {activeChips.length > 0 && (
            <div className="activefilters">
              {activeChips.map((chip) => (
                <button
                  key={`${chip.key}-${chip.value}`}
                  type="button"
                  className="chip"
                  onClick={() =>
                    update((next) => {
                      if (chip.key === 'price' || chip.key === 'q' || chip.key === 'featured') next.delete(chip.key)
                      else {
                        const rest = next.getAll(chip.key).filter((v) => v !== chip.value)
                        next.delete(chip.key)
                        for (const v of rest) next.append(chip.key, v)
                      }
                      next.delete('page')
                    })
                  }
                >
                  {chip.label} <span aria-hidden="true">✕</span>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="gridprod three">
              {Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              title="No rugs match those filters"
              message="Try removing a filter or searching for a different style, colour or size."
              actionLabel="Clear filters"
              onAction={() => setParams(new URLSearchParams())}
            />
          ) : (
            <div className="gridprod three">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <nav className="pagination" aria-label="Pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => update((next) => next.set('page', String(page - 1)))}
                aria-label="Previous page"
              >
                ←
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-current={n === page}
                  onClick={() => update((next) => next.set('page', String(n)))}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => update((next) => next.set('page', String(page + 1)))}
                aria-label="Next page"
              >
                →
              </button>
            </nav>
          )}
        </div>
      </section>

      <LifestyleBand banner={banner} fallbackImage="/assets/rug_lifestyle_1.jpg" />
    </>
  )
}
