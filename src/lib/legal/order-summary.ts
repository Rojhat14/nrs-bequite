import { parseMeasurements, type Measurements, type MeasurementKind } from '@/lib/order-measurements'
export interface LegalOrderSummary {
  items: { productId: string; name: string; description: string; size?: string; variantId?: string; measurementKind?: MeasurementKind; image?: string; measurements?: Measurements; quantity: number; unitPrice: number }[]
  buyer: { name: string; email: string; phone: string; address: string }
  orderNote?: string
  subtotal: number
  discount: number
  shipping: number | null
  total: number
  currency: string
  paymentMethod: string
  deliveryTerms: string
  orderedAt?: string
}

export interface OrderLegalRecord {
  order_id: string
  contract_accepted: true
  contract_version: string
  pre_information_version: string
  accepted_at: string
  document_hash: string
  summary_hash: string
  order_summary: LegalOrderSummary
}

// Historical summaries are independent of today's product names, prices and stock.
export function isLegalOrderSummary(value: unknown): value is LegalOrderSummary {
  if (!value || typeof value !== 'object') return false
  const summary = value as LegalOrderSummary
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4000
  const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
  if (!Array.isArray(summary.items) || !summary.items.length || summary.items.length > 200) return false
  if (!summary.items.every(item => item && text(item.productId) && text(item.name) && text(item.description)
    && Number.isInteger(item.quantity) && item.quantity > 0 && money(item.unitPrice)
    && (item.size === undefined || text(item.size)))) return false
  try { for (const item of summary.items) parseMeasurements(item.measurements) } catch { return false }
  if (summary.orderNote !== undefined && (typeof summary.orderNote !== 'string' || summary.orderNote.length > 2000)) return false
  if (!summary.buyer || !Object.values({ name: summary.buyer.name, email: summary.buyer.email,
    phone: summary.buyer.phone, address: summary.buyer.address }).every(text)) return false
  if (![summary.subtotal, summary.discount, summary.total].every(money)
    || !(summary.shipping === null || money(summary.shipping))) return false
  if (!/^[A-Z]{3}$/.test(summary.currency) || !text(summary.paymentMethod) || !text(summary.deliveryTerms)) return false
  if (summary.orderedAt !== undefined && (typeof summary.orderedAt !== 'string' || !Number.isFinite(Date.parse(summary.orderedAt)))) return false
  return true
}

export function assertFinalLegalOrderSummary(value: unknown): asserts value is LegalOrderSummary {
  if (!isLegalOrderSummary(value) || value.shipping === null || !value.orderedAt) {
    throw new Error('Ödeme öncesinde ürün, alıcı, sipariş tarihi, teslimat koşulları ve nihai kargo bedeli doğrulanmalıdır.')
  }
  const minor = (amount: number) => Math.round(amount * 100)
  const itemsTotal = value.items.reduce((sum, item) => sum + minor(item.unitPrice) * item.quantity, 0)
  if (minor(value.discount) > minor(value.subtotal)
    || minor(value.total) !== minor(value.subtotal) - minor(value.discount) + minor(value.shipping)
    || itemsTotal !== minor(value.subtotal) - minor(value.discount)) {
    throw new Error('Sipariş tutarları sözleşme özetiyle tutarlı değil.')
  }
}
