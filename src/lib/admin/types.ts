export type ProductStatus = 'draft' | 'active' | 'archived'
export type OrderStatus = 'pending' | 'payment_pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

export interface ProductRow {
  id: string
  name: string
  slug: string
  category_id: string | null
  description: string | null
  price_amount: number | string
  currency: string
  compare_at_price: number | string | null
  status: ProductStatus
  in_stock: boolean
  fabric: string | null
  care: string | null
  created_at: string
  updated_at: string
}

export interface CategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CollectionRow {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductImageRow {
  id: string
  product_id: string
  provider: string
  storage_key: string | null
  url: string | null
  alt_text: string | null
  sort_order: number
  is_primary: boolean
  created_at: string
}

export interface ProductVariantRow {
  id: string
  product_id: string
  size: string | null
  sku: string | null
  stock_quantity: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrderRow {
  id: string
  user_id: string | null
  total_amount: number | string
  status: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  shipping_address: string | null
  shipping_address_full: string | null
  shipping_city: string | null
  shipping_district: string | null
  shipping_postal_code: string | null
  payment_id: string | null
  created_at: string
}

export interface OrderItemRow {
  id: string
  order_id: string
  product_id: string
  quantity: number
  price_at_purchase: number | string
}

export interface ProfileRow {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  created_at?: string | null
  [key: string]: unknown
}

export interface WishlistRow {
  id?: string
  user_id: string
  product_id: string
  created_at?: string | null
  [key: string]: unknown
}

export interface ActionResult {
  ok: boolean
  message: string
  id?: string
}

export function displayName(profile: ProfileRow | null | undefined) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  return name || profile?.email || 'İsimsiz müşteri'
}

export function formatMoney(value: number | string | null | undefined, currency = 'TRY') {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(date)
}
