import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { CartLine, CartLineView, ProductFull } from '../lib/types'

const STORAGE_KEY = 'rugistan.cart.v1'

function readGuestCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartLine[]
    return Array.isArray(parsed) ? parsed.filter((l) => l?.productId && l.quantity > 0) : []
  } catch {
    return []
  }
}

function writeGuestCart(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  } catch {
    /* storage can be unavailable in private windows — the cart still works for this session */
  }
}

const sameLine = (a: CartLine, b: CartLine) =>
  a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null)

type CartApi = {
  lines: CartLineView[]
  rawLines: CartLine[]
  count: number
  subtotal: number
  loading: boolean
  /** Returns an error message, or null when the rug was added. */
  add: (productId: string, variantId: string | null, quantity?: number) => Promise<string | null>
  setQuantity: (line: CartLine, quantity: number) => Promise<void>
  remove: (line: CartLine) => Promise<void>
  clear: () => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<CartApi | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [lines, setLines] = useState<CartLine[]>(() => readGuestCart())
  const [views, setViews] = useState<CartLineView[]>([])
  const [loading, setLoading] = useState(true)
  const mergedFor = useRef<string | null>(null)

  /* ---------- persistence ---------- */
  const loadFromDb = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('cart_items')
      .select('product_id,variant_id,quantity')
      .eq('user_id', userId)
    return (data ?? []).map((r) => ({
      productId: r.product_id,
      variantId: r.variant_id,
      quantity: r.quantity,
    }))
  }, [])

  const persist = useCallback(
    async (next: CartLine[]) => {
      setLines(next)
      if (!user) {
        writeGuestCart(next)
        return
      }
      await supabase.from('cart_items').delete().eq('user_id', user.id)
      if (next.length) {
        await supabase.from('cart_items').insert(
          next.map((l) => ({
            user_id: user.id,
            product_id: l.productId,
            variant_id: l.variantId,
            quantity: l.quantity,
          })),
        )
      }
    },
    [user],
  )

  /* merge the guest cart into the account cart on sign-in */
  useEffect(() => {
    if (authLoading) return
    let active = true

    ;(async () => {
      if (!user) {
        mergedFor.current = null
        if (active) setLines(readGuestCart())
        return
      }
      if (mergedFor.current === user.id) return
      mergedFor.current = user.id

      const guest = readGuestCart()
      const stored = await loadFromDb(user.id)
      const merged = [...stored]
      for (const g of guest) {
        const hit = merged.find((m) => sameLine(m, g))
        if (hit) hit.quantity += g.quantity
        else merged.push(g)
      }
      writeGuestCart([])
      if (!active) return
      setLines(merged)
      if (guest.length) {
        await supabase.from('cart_items').delete().eq('user_id', user.id)
        if (merged.length) {
          await supabase.from('cart_items').insert(
            merged.map((l) => ({
              user_id: user.id,
              product_id: l.productId,
              variant_id: l.variantId,
              quantity: l.quantity,
            })),
          )
        }
      }
    })()

    return () => {
      active = false
    }
  }, [user, authLoading, loadFromDb])

  /* ---------- resolve lines against live catalogue data ---------- */
  const resolve = useCallback(async (current: CartLine[]) => {
    if (!current.length) {
      setViews([])
      setLoading(false)
      return
    }
    const ids = [...new Set(current.map((l) => l.productId))]
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(id,name,slug), images:product_images(*), variants:product_variants(*)')
      .in('id', ids)
      .eq('status', 'published')

    const products = (data ?? []) as unknown as ProductFull[]
    const next: CartLineView[] = []

    for (const line of current) {
      const product = products.find((p) => p.id === line.productId)
      if (!product) continue
      const variant = line.variantId ? product.variants.find((v) => v.id === line.variantId) ?? null : null
      if (line.variantId && !variant) continue
      const unitPrice = Number(product.price) + Number(variant?.price_delta ?? 0)
      const available = variant ? variant.stock_quantity : product.stock_quantity
      const quantity = Math.max(Math.min(line.quantity, available), 0)
      if (quantity === 0) continue
      next.push({
        ...line,
        quantity,
        product: {
          ...product,
          images: [...product.images].sort((a, b) => a.sort_order - b.sort_order),
          variants: [...product.variants].sort((a, b) => a.sort_order - b.sort_order),
        },
        variant,
        unitPrice,
        lineTotal: unitPrice * quantity,
        available,
      })
    }

    setViews(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    void resolve(lines)
  }, [lines, resolve])

  /* ---------- mutations ---------- */
  const add = useCallback<CartApi['add']>(
    async (productId, variantId, quantity = 1) => {
      const { data: product } = await supabase
        .from('products')
        .select('stock_quantity,status,name')
        .eq('id', productId)
        .maybeSingle()
      if (!product || product.status !== 'published') return 'This rug is no longer available.'

      let available = product.stock_quantity
      if (variantId) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('stock_quantity,is_active')
          .eq('id', variantId)
          .maybeSingle()
        if (!variant || !variant.is_active) return 'That size is no longer available.'
        available = variant.stock_quantity
      }
      if (available <= 0) return 'That size is out of stock.'

      const target: CartLine = { productId, variantId: variantId ?? null, quantity }
      const next = [...lines]
      const hit = next.find((l) => sameLine(l, target))
      const requested = (hit?.quantity ?? 0) + quantity
      if (requested > available) return `Only ${available} left in stock.`

      if (hit) hit.quantity = requested
      else next.push(target)
      await persist(next)
      return null
    },
    [lines, persist],
  )

  const setQuantity = useCallback<CartApi['setQuantity']>(
    async (line, quantity) => {
      const next = lines
        .map((l) => (sameLine(l, line) ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0)
      await persist(next)
    },
    [lines, persist],
  )

  const remove = useCallback<CartApi['remove']>(
    async (line) => {
      await persist(lines.filter((l) => !sameLine(l, line)))
    },
    [lines, persist],
  )

  const clear = useCallback(async () => {
    setLines([])
    writeGuestCart([])
    if (user) await supabase.from('cart_items').delete().eq('user_id', user.id)
  }, [user])

  const reload = useCallback(async () => {
    if (user) setLines(await loadFromDb(user.id))
    else setLines(readGuestCart())
  }, [user, loadFromDb])

  const value = useMemo<CartApi>(
    () => ({
      lines: views,
      rawLines: lines,
      count: views.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: views.reduce((sum, l) => sum + l.lineTotal, 0),
      loading,
      add,
      setQuantity,
      remove,
      clear,
      reload,
    }),
    [views, lines, loading, add, setQuantity, remove, clear, reload],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
