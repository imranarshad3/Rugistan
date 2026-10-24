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
const KEY = 'rugistan.wishlist.v1'
const validId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)
function readLocal(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(value) ? [...new Set(value.filter(validId))].slice(0, 100) : []
  } catch {
    return []
  }
}
function writeLocal(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    /* Optional persistence. */
  }
}
type WishlistApi = {
  ids: string[]
  count: number
  has: (id: string) => boolean
  toggle: (id: string) => Promise<boolean>
  remove: (id: string) => Promise<void>
}
const Ctx = createContext<WishlistApi | null>(null)
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const toast = useToast()
  const userId = user?.id ?? null
  const [ids, setIds] = useState<string[]>(readLocal)
  const [owner, setOwner] = useState<string | null>(null)
  const current = useRef(ids)
  const identity = useRef(userId)
  useLayoutEffect(() => {
    identity.current = userId
  }, [userId])
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const commit = useCallback((next: string[], id: string | null) => {
    current.current = next
    setIds(next)
    setOwner(id)
  }, [])
  useEffect(() => {
    if (loading) return
    let active = true
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        if (!active) return
        const local = readLocal()
        if (!userId) {
          commit(local, null)
          return
        }
        if (local.length) {
          // A removed/unpublished guest item must not prevent the rest from merging.
          const { data: available, error: lookupError } = await supabase
            .from('products')
            .select('id')
            .in('id', local)
            .eq('status', 'published')
          if (lookupError) throw lookupError
          if (available.length) {
            const { error } = await supabase.from('wishlist_items').upsert(
              available.map((p) => ({ user_id: userId, product_id: p.id })),
              { onConflict: 'user_id,product_id' },
            )
            if (error) throw error
          }
        }
        const { data, error } = await supabase
          .from('wishlist_items')
          .select('product_id')
          .eq('user_id', userId)
        if (error) throw error
        if (active && identity.current === userId) {
          commit(
            data.map((r) => r.product_id),
            userId,
          )
          writeLocal([])
        }
      })
      .catch((error) => {
        if (active) toast.error(readableError(error, 'Your wishlist could not be loaded.'))
      })
    queue.current = task
    return () => {
      active = false
    }
  }, [userId, loading, commit, toast])
  const mutate = useCallback(
    (id: string, removeOnly = false): Promise<boolean> => {
      const task = queue.current
        .catch(() => {})
        .then(async () => {
          if (!validId(id) || identity.current !== userId || loading) return false
          const on = !current.current.includes(id)
          if (removeOnly && on) return false
          if (userId) {
            const { error } = on
              ? await supabase
                  .from('wishlist_items')
                  .upsert({ user_id: userId, product_id: id }, { onConflict: 'user_id,product_id' })
              : await supabase.from('wishlist_items').delete().eq('user_id', userId).eq('product_id', id)
            if (error) throw error
          }
          const next = on ? [...current.current, id] : current.current.filter((x) => x !== id)
          if (identity.current === userId) {
            commit(next, userId)
            if (!userId) writeLocal(next)
          }
          return on
        })
        .catch((error) => {
          toast.error(readableError(error))
          return current.current.includes(id)
        })
      queue.current = task
      return task
    },
    [userId, loading, commit, toast],
  )
  const toggle = useCallback((id: string) => mutate(id), [mutate])
  const remove = useCallback(
    async (id: string) => {
      await mutate(id, true)
    },
    [mutate],
  )
  const visible = useMemo(() => (owner === userId ? ids : []), [owner, userId, ids])
  const value = useMemo(
    () => ({
      ids: visible,
      count: visible.length,
      has: (id: string) => visible.includes(id),
      toggle,
      remove,
    }),
    [visible, toggle, remove],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useWishlist() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider')
  return ctx
}
