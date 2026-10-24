import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase, readableError } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { normaliseCart, sameLine } from '../lib/cart'
import type { CartLine, CartLineView, ProductFull } from '../lib/types'

const STORAGE_KEY = 'rugistan.cart.v1'
function readGuest(): CartLine[] {
  try {
    return normaliseCart(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  } catch {
    return []
  }
}
function writeGuest(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  } catch {
    /* Optional browser persistence. */
  }
}
type CartApi = {
  lines: CartLineView[]
  rawLines: CartLine[]
  count: number
  subtotal: number
  loading: boolean
  error: string | null
  add: (productId: string, variantId: string | null, quantity?: number) => Promise<string | null>
  setQuantity: (line: CartLine, quantity: number) => Promise<void>
  remove: (line: CartLine) => Promise<void>
  clear: () => Promise<void>
  reload: () => Promise<void>
}
const Ctx = createContext<CartApi | null>(null)
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const toast = useToast()
  const userId = user?.id ?? null
  const [lines, setLines] = useState<CartLine[]>(readGuest)
  const [owner, setOwner] = useState<string | null>(null)
  const [views, setViews] = useState<CartLineView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const current = useRef(lines)
  const loadedFor = useRef<string | null>(null)
  const identity = useRef(userId)
  useLayoutEffect(() => {
    identity.current = userId
  }, [userId])
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const commit = useCallback((next: CartLine[]) => {
    current.current = next
    setLines(next)
    setOwner(identity.current)
    loadedFor.current = identity.current
  }, [])
  const sync = useCallback(
    async (next: CartLine[], merge = false): Promise<CartLine[]> => {
      if (!userId) {
        writeGuest(next)
        return next
      }
      const { data, error: failure } = await supabase.rpc('sync_cart', {
        p_lines: next.map((l) => ({
          product_id: l.productId,
          variant_id: l.variantId,
          quantity: l.quantity,
        })),
        p_merge: merge,
      })
      if (failure) throw failure
      return normaliseCart(
        (data as { product_id: string; variant_id: string | null; quantity: number }[]).map((l) => ({
          productId: l.product_id,
          variantId: l.variant_id,
          quantity: l.quantity,
        })),
      )
    },
    [userId],
  )

  useEffect(() => {
    if (authLoading) return
    let active = true
    setLoading(true)
    setViews([])
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        if (!active) return
        const guest = readGuest()
        // Merge is idempotent: StrictMode/remounts cannot double guest quantities.
        const next = userId ? await sync(guest, true) : guest
        if (!active || identity.current !== userId) return
        commit(next)
        if (userId) writeGuest([]) // clear only after a successful server transaction
        setError(null)
      })
      .catch((failure) => {
        if (active) {
          setError(readableError(failure, 'Your cart could not be loaded.'))
          setLoading(false)
        }
      })
    queue.current = task
    return () => {
      active = false
    }
  }, [userId, authLoading, sync, commit])

  useEffect(() => {
    if (authLoading || owner !== userId) return
    let active = true
    setLoading(true)
    void (async () => {
      if (!lines.length) {
        if (active) {
          setViews([])
          setLoading(false)
        }
        return
      }
      const { data, error: failure } = await supabase
        .from('products')
        .select(
          '*, category:categories(id,name,slug), images:product_images(*), variants:product_variants(*)',
        )
        .in('id', [...new Set(lines.map((l) => l.productId))])
        .eq('status', 'published')
      if (failure) throw failure
      const products = data as unknown as ProductFull[]
      const next: CartLineView[] = []
      for (const line of lines) {
        const product = products.find((p) => p.id === line.productId)
        if (!product) continue
        const variant = line.variantId
          ? (product.variants.find((v) => v.id === line.variantId && v.is_active) ?? null)
          : null
        if (line.variantId && !variant) continue
        if (!variant && product.variants.length > 0) continue
        const available = Math.min(10, variant?.stock_quantity ?? product.stock_quantity)
        const quantity = Math.min(line.quantity, available)
        if (quantity < 1) continue
        const unitPrice = Number(product.price) + Number(variant?.price_delta ?? 0)
        next.push({
          ...line,
          quantity,
          product: { ...product, images: [...product.images].sort((a, b) => a.sort_order - b.sort_order) },
          variant,
          available,
          unitPrice,
          lineTotal: quantity * unitPrice,
        })
      }
      if (active) {
        setViews(next)
        setLoading(false)
      }
    })().catch((failure) => {
      if (active) {
        setError(readableError(failure))
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [lines, authLoading, owner, userId])

  const mutate = useCallback(
    (update: (previous: CartLine[]) => Promise<CartLine[]> | CartLine[]): Promise<string | null> => {
      const owner = userId
      const task = queue.current
        .catch(() => {})
        .then(async () => {
          if (identity.current !== owner || loadedFor.current !== owner)
            throw new Error('Your account changed. Please try again.')
          const next = normaliseCart(await update(current.current))
          const stored = await sync(next)
          if (identity.current === owner) {
            commit(stored)
            setError(null)
          }
          return null
        })
        .catch((failure) => {
          const message = readableError(failure)
          if (identity.current === owner) {
            setError(message)
            toast.error(message)
          }
          return message
        })
      queue.current = task
      return task
    },
    [userId, sync, commit, toast],
  )
  const add = useCallback<CartApi['add']>(
    (productId, variantId, quantity = 1) =>
      mutate(async (previous) => {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
          throw new Error('Choose between 1 and 10 rugs.')
        const { data: product, error: failure } = await supabase
          .from('products')
          .select('stock_quantity,status,variants:product_variants(id,stock_quantity,is_active)')
          .eq('id', productId)
          .maybeSingle()
        if (failure) throw failure
        if (!product || product.status !== 'published') throw new Error('This rug is no longer available.')
        const variant = product.variants.find((v) => v.id === variantId && v.is_active)
        if ((variantId && !variant) || (!variantId && product.variants.length > 0))
          throw new Error('Please choose an available size.')
        const target = { productId, variantId, quantity }
        const requested = (previous.find((l) => sameLine(l, target))?.quantity ?? 0) + quantity
        const available = Math.min(10, variant?.stock_quantity ?? product.stock_quantity)
        if (requested > available) throw new Error(`Only ${available} can be added to your cart.`)
        return [...previous.filter((l) => !sameLine(l, target)), { ...target, quantity: requested }]
      }),
    [mutate],
  )
  const setQuantity = useCallback<CartApi['setQuantity']>(
    async (line, quantity) => {
      await mutate((previous) => {
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10)
          throw new Error('Choose between 1 and 10 rugs.')
        return previous.map((l) => (sameLine(l, line) ? { ...l, quantity } : l)).filter((l) => l.quantity > 0)
      })
    },
    [mutate],
  )
  const remove = useCallback<CartApi['remove']>(
    async (line) => {
      await mutate((previous) => previous.filter((l) => !sameLine(l, line)))
    },
    [mutate],
  )
  const clear = useCallback(async () => {
    await mutate(() => [])
  }, [mutate])
  const reload = useCallback(async () => {
    await mutate(async () => {
      if (!userId) return readGuest()
      const { data, error: failure } = await supabase
        .from('cart_items')
        .select('product_id,variant_id,quantity')
        .eq('user_id', userId)
      if (failure) throw failure
      return data.map((l) => ({ productId: l.product_id, variantId: l.variant_id, quantity: l.quantity }))
    })
  }, [userId, mutate])
  const visible = useMemo(() => (owner === userId ? views : []), [owner, userId, views])
  const value = useMemo<CartApi>(
    () => ({
      lines: visible,
      rawLines: owner === userId ? lines : [],
      count: visible.reduce((n, l) => n + l.quantity, 0),
      subtotal: visible.reduce((n, l) => n + l.lineTotal, 0),
      loading: loading || authLoading,
      error,
      add,
      setQuantity,
      remove,
      clear,
      reload,
    }),
    [visible, owner, userId, lines, loading, authLoading, error, add, setQuantity, remove, clear, reload],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
