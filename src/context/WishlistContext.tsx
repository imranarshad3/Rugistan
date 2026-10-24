import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'rugistan.wishlist.v1'

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* ignore unavailable storage */
  }
}

type WishlistApi = {
  ids: string[]
  count: number
  has: (productId: string) => boolean
  toggle: (productId: string) => Promise<boolean>
  remove: (productId: string) => Promise<void>
}

const Ctx = createContext<WishlistApi | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [ids, setIds] = useState<string[]>(() => readLocal())

  useEffect(() => {
    if (loading) return
    let active = true

    ;(async () => {
      if (!user) {
        if (active) setIds(readLocal())
        return
      }
      const local = readLocal()
      if (local.length) {
        await supabase
          .from('wishlist_items')
          .upsert(local.map((id) => ({ user_id: user.id, product_id: id })), { onConflict: 'user_id,product_id' })
        writeLocal([])
      }
      const { data } = await supabase.from('wishlist_items').select('product_id').eq('user_id', user.id)
      if (active) setIds((data ?? []).map((r) => r.product_id))
    })()

    return () => {
      active = false
    }
  }, [user, loading])

  const toggle = useCallback<WishlistApi['toggle']>(
    async (productId) => {
      const on = !ids.includes(productId)
      const next = on ? [...ids, productId] : ids.filter((id) => id !== productId)
      setIds(next)
      if (user) {
        if (on) await supabase.from('wishlist_items').insert({ user_id: user.id, product_id: productId })
        else await supabase.from('wishlist_items').delete().eq('user_id', user.id).eq('product_id', productId)
      } else {
        writeLocal(next)
      }
      return on
    },
    [ids, user],
  )

  const remove = useCallback<WishlistApi['remove']>(
    async (productId) => {
      if (ids.includes(productId)) await toggle(productId)
    },
    [ids, toggle],
  )

  const value = useMemo<WishlistApi>(
    () => ({ ids, count: ids.length, has: (id) => ids.includes(id), toggle, remove }),
    [ids, toggle, remove],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWishlist() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider')
  return ctx
}
