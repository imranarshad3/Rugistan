import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { setCurrency } from '../lib/format'
import type { Category, PaymentSettings, RugCareSettings, StoreSettings } from '../lib/types'

const DEFAULT_STORE: StoreSettings = {
  name: 'Rugistan',
  tagline: 'HANDMADE RUGS',
  email: '',
  phone: '',
  whatsapp: '',
  location: '',
  currency: 'USD',
  currency_symbol: '$',
  timezone: 'Asia/Karachi',
  logo_url: '',
  favicon_url: '',
  announcement: [],
  social: { instagram: '', pinterest: '', facebook: '' },
}

const DEFAULT_PAYMENTS: PaymentSettings = { offline_methods: [], gateways: [] }
const DEFAULT_CARE: RugCareSettings = { tips: [], faqs: [] }

type StoreApi = {
  store: StoreSettings
  payments: PaymentSettings
  care: RugCareSettings
  contactNotes: Record<string, string>
  categories: Category[]
  ready: boolean
  reload: () => Promise<void>
}

const Ctx = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoreSettings>(DEFAULT_STORE)
  const [payments, setPayments] = useState<PaymentSettings>(DEFAULT_PAYMENTS)
  const [care, setCare] = useState<RugCareSettings>(DEFAULT_CARE)
  const [contactNotes, setContactNotes] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [ready, setReady] = useState(false)

  const reload = useCallback(async () => {
    const [settingsRes, catRes] = await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    ])

    const rows = settingsRes.data ?? []
    const pick = (key: string) => rows.find((r) => r.key === key)?.value as Record<string, unknown> | undefined

    const nextStore = { ...DEFAULT_STORE, ...(pick('store') ?? {}) } as StoreSettings
    setStore(nextStore)
    setCurrency(nextStore.currency, nextStore.currency_symbol)
    setPayments({ ...DEFAULT_PAYMENTS, ...(pick('payments') ?? {}) } as PaymentSettings)
    setCare({ ...DEFAULT_CARE, ...(pick('rug_care') ?? {}) } as RugCareSettings)
    setContactNotes((pick('contact_page') ?? {}) as Record<string, string>)
    setCategories(catRes.data ?? [])
    setReady(true)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    document.title = `${store.name} · Premium Handmade Rugs`
    if (store.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = store.favicon_url
    }
  }, [store.name, store.favicon_url])

  const value = useMemo<StoreApi>(
    () => ({ store, payments, care, contactNotes, categories, ready, reload }),
    [store, payments, care, contactNotes, categories, ready, reload],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
