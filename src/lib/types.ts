import type { Database } from './database.types'

type T = Database['public']['Tables']

export type Profile = T['profiles']['Row']
export type Category = T['categories']['Row']
export type Product = T['products']['Row']
export type ProductImage = T['product_images']['Row']
export type ProductVariant = T['product_variants']['Row']
export type ShippingMethod = T['shipping_methods']['Row']
export type PromoCode = T['promo_codes']['Row']
export type Order = T['orders']['Row']
export type OrderItem = T['order_items']['Row']
export type OrderEvent = T['order_events']['Row']
export type Review = T['reviews']['Row']
export type Banner = T['banners']['Row']
export type Page = T['pages']['Row']
export type ContactMessage = T['contact_messages']['Row']
export type OrderStatus = Database['public']['Enums']['order_status']
export type PaymentStatus = Database['public']['Enums']['payment_status']
export type ProductStatus = Database['public']['Enums']['product_status']
export type ReviewStatus = Database['public']['Enums']['review_status']
export type PageStatus = Database['public']['Enums']['page_status']

export type ProductFull = Product & {
  category: Pick<Category, 'id' | 'name' | 'slug'> | null
  images: ProductImage[]
  variants: ProductVariant[]
}

export type OrderFull = Order & {
  items: OrderItem[]
  events: OrderEvent[]
}

export type ColorSwatch = { name: string; hex: string }

export type StoreSettings = {
  name: string
  tagline: string
  email: string
  phone: string
  whatsapp: string
  location: string
  currency: string
  currency_symbol: string
  timezone: string
  logo_url: string
  favicon_url: string
  announcement: string[]
  social: { instagram: string; pinterest: string; facebook: string }
}

export type OfflinePaymentMethod = {
  id: string
  label: string
  enabled: boolean
  marks_as: 'unpaid' | 'awaiting_confirmation'
  instructions: string
}

export type PaymentSettings = {
  offline_methods: OfflinePaymentMethod[]
  gateways: { id: string; label: string; enabled: boolean }[]
}

export type RugCareSettings = {
  tips: { title: string; body: string; image: string }[]
  faqs: { q: string; a: string }[]
}

export type CartLine = {
  productId: string
  variantId: string | null
  quantity: number
}

export type CartLineView = CartLine & {
  product: ProductFull
  variant: ProductVariant | null
  unitPrice: number
  lineTotal: number
  available: number
}
