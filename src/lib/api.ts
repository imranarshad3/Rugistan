import { supabase } from './supabase'
import type { Banner, Page, ProductFull, Review } from './types'

export const PRODUCT_SELECT =
  '*, category:categories(id,name,slug), images:product_images(*), variants:product_variants(*)'

function normalise(rows: unknown): ProductFull[] {
  return ((rows ?? []) as ProductFull[]).map((p) => ({
    ...p,
    images: [...(p.images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    variants: [...(p.variants ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))
}

function ilikeValue(value: string): string {
  const literal = value.slice(0, 200).replace(/[\\%_]/g, c => '\\' + c)
  return JSON.stringify(`%${literal}%`)
}

export type ProductSort = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'name' | 'rating'

export type ProductQuery = {
  categories?: string[]
  sizes?: string[]
  styles?: string[]
  materials?: string[]
  rooms?: string[]
  minPrice?: number | null
  maxPrice?: number | null
  search?: string
  featured?: boolean
  sort?: ProductSort
  page?: number
  perPage?: number
}

export async function fetchProducts(q: ProductQuery = {}): Promise<{ products: ProductFull[]; total: number }> {
  const perPage = Number.isFinite(q.perPage) ? Math.min(100, Math.max(1, Math.floor(q.perPage!))) : 12
  const page = Number.isFinite(q.page) ? Math.min(10000, Math.max(1, Math.floor(q.page!))) : 1

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .eq('status', 'published')

  if (q.categories?.length) {
    const { data: cats, error: categoryError } = await supabase.from('categories').select('id').in('slug', q.categories)
    if (categoryError) throw categoryError
    const ids = (cats ?? []).map((c) => c.id)
    if (!ids.length) return { products: [], total: 0 }
    query = query.in('category_id', ids)
  }

  if (q.sizes?.length) {
    // Size lives on the variant, so resolve matching products first.
    const { data: variants, error: variantError } = await supabase
      .from('product_variants')
      .select('product_id')
      .in('label', q.sizes)
      .gt('stock_quantity', 0)
      .eq('is_active', true)
    if (variantError) throw variantError
    const ids = [...new Set((variants ?? []).map((v) => v.product_id))]
    if (!ids.length) return { products: [], total: 0 }
    query = query.in('id', ids)
  }

  if (q.styles?.length) query = query.in('style', q.styles)
  if (q.materials?.length) {
    query = query.or(q.materials.map((m) => `material.ilike.${ilikeValue(m)}`).join(','))
  }
  if (q.rooms?.length) query = query.in('room', q.rooms)
  if (typeof q.minPrice === 'number') query = query.gte('price', q.minPrice)
  if (typeof q.maxPrice === 'number') query = query.lte('price', q.maxPrice)
  if (q.featured) query = query.eq('is_featured', true)

  const term = q.search?.trim()
  if (term) {
    const safe = ilikeValue(term)
    query = query.or(
      [
        `name.ilike.${safe}`,
        `short_description.ilike.${safe}`,
        `description.ilike.${safe}`,
        `material.ilike.${safe}`,
        `color.ilike.${safe}`,
        `style.ilike.${safe}`,
        `sku.ilike.${safe}`,
      ].join(','),
    )
  }

  switch (q.sort ?? 'featured') {
    case 'newest': query = query.order('created_at', { ascending: false }); break
    case 'price-asc': query = query.order('price', { ascending: true }); break
    case 'price-desc': query = query.order('price', { ascending: false }); break
    case 'name': query = query.order('name', { ascending: true }); break
    case 'rating': query = query.order('rating_avg', { ascending: false }).order('rating_count', { ascending: false }); break
    default:
      query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false })
  }

  const from = (page - 1) * perPage
  const { data, count, error } = await query.range(from, from + perPage - 1)
  if (error) throw error
  return { products: normalise(data), total: count ?? 0 }
}

export async function fetchProductBySlug(slug: string): Promise<ProductFull | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  return data ? normalise([data])[0] : null
}

export async function fetchProductsByIds(ids: string[]): Promise<ProductFull[]> {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .in('id', ids)
    .eq('status', 'published')
  if (error) throw error
  return normalise(data)
}

export async function fetchRelatedProducts(product: ProductFull, limit = 4): Promise<ProductFull[]> {
  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('status', 'published')
    .neq('id', product.id)
    .limit(limit)
  if (product.category_id) query = query.eq('category_id', product.category_id)
  const { data } = await query
  const found = normalise(data)
  if (found.length >= limit) return found

  const { data: filler } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('status', 'published')
    .neq('id', product.id)
    .limit(limit)
  return [...found, ...normalise(filler).filter((p) => !found.some((f) => f.id === p.id))].slice(0, limit)
}

export async function fetchBanners(): Promise<Record<string, Banner>> {
  const { data } = await supabase
    .from('banners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  const map: Record<string, Banner> = {}
  for (const b of data ?? []) if (!map[b.placement]) map[b.placement] = b
  return map
}

export async function fetchPage(slug: string): Promise<Page | null> {
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function fetchProductReviews(productId: string): Promise<Review[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  return data ?? []
}

/** Distinct values used to build the shop filter rail, taken from live catalogue rows. */
export async function fetchFilterFacets() {
  const [{ data: products }, { data: variants }] = await Promise.all([
    supabase.from('products').select('style,material,room,price').eq('status', 'published'),
    supabase.from('product_variants').select('label,sort_order').eq('is_active', true),
  ])

  const uniq = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))].sort()

  const sizeOrder = new Map<string, number>()
  for (const v of variants ?? []) if (!sizeOrder.has(v.label)) sizeOrder.set(v.label, v.sort_order)

  return {
    sizes: [...sizeOrder.keys()].sort((a, b) => (sizeOrder.get(a) ?? 0) - (sizeOrder.get(b) ?? 0)),
    styles: uniq((products ?? []).map((p) => p.style)),
    materials: uniq((products ?? []).map((p) => p.material)),
    rooms: uniq((products ?? []).map((p) => p.room)),
    maxPrice: Math.max(0, ...(products ?? []).map((p) => Number(p.price))),
  }
}
