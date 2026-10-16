import { parseMeasurements, type Measurements, type MeasurementKind } from '@/lib/order-measurements'
export interface LegalOrderSummary {
  items: { productId: string; name: string; description: string; size?: string; variantId?: string; measurementKind?: MeasurementKind; image?: string; measurements?: Measurements; quantity: number; unitPrice: number; normalUnitPrice?: number; discountAmount?: number }[]
  buyer: { name: string; email: string; phone: string; address: string }
  orderNote?: string
  subtotal: number
  discount: number
  campaign?: { id: string; name: string; rateBasisPoints: number; discountAmount: number }
  shipping: number | null
  total: number
  currency: string
  paymentMethod: string
  deliveryTerms: string
  orderedAt?: string
  display?: {
    locale: 'tr' | 'en' | 'ar'
    currency: 'TRY' | 'USD'
    exchangeRate: number | null
    exchangeRateAt: string | null
    exchangeRateDate?: string | null
    subtotalMinor: number
    discountMinor: number
    shippingMinor: number
    totalMinor: number
    itemLineMinor: number[]
  }
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
  if (summary.campaign !== undefined && (!summary.campaign || !text(summary.campaign.id) || !text(summary.campaign.name)
    || !Number.isInteger(summary.campaign.rateBasisPoints) || summary.campaign.rateBasisPoints < 1 || summary.campaign.rateBasisPoints > 10000
    || !money(summary.campaign.discountAmount))) return false
  if (summary.items.some(item => (item.normalUnitPrice !== undefined && !money(item.normalUnitPrice))
    || (item.discountAmount !== undefined && !money(item.discountAmount)))) return false
  if (summary.display !== undefined) {
    const display = summary.display
    if (!display || !['tr', 'en', 'ar'].includes(display.locale) || !['TRY', 'USD'].includes(display.currency)
      || (display.exchangeRate !== null && (!Number.isFinite(display.exchangeRate) || display.exchangeRate <= 0))
      || (display.exchangeRateAt !== null && !Number.isFinite(Date.parse(display.exchangeRateAt)))
      || (display.exchangeRateDate !== undefined && display.exchangeRateDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(display.exchangeRateDate))
      || ![display.subtotalMinor, display.discountMinor, display.shippingMinor, display.totalMinor].every(value => Number.isSafeInteger(value) && value >= 0)
      || !Array.isArray(display.itemLineMinor) || display.itemLineMinor.length !== summary.items.length
      || !display.itemLineMinor.every(value => Number.isSafeInteger(value) && value >= 0)
      || (display.currency === 'USD' && display.exchangeRate === null)
      || (display.currency === 'TRY' && display.locale !== 'tr' && display.exchangeRate !== null)) return false
    const displayLines = display.itemLineMinor.reduce((sum, value) => sum + value, 0)
    if (display.totalMinor !== displayLines + display.shippingMinor
      || display.subtotalMinor - display.discountMinor !== displayLines) return false
  }
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
  const lineDiscounts = value.items.reduce((sum, item) => sum + minor(item.discountAmount ?? 0), 0)
  const regularItemsTotal = value.items.reduce((sum, item) => sum + minor(item.normalUnitPrice ?? item.unitPrice) * item.quantity, 0)
  if (minor(value.discount) > minor(value.subtotal)
    || minor(value.total) !== minor(value.subtotal) - minor(value.discount) + minor(value.shipping)
    || itemsTotal !== minor(value.subtotal) - minor(value.discount)
    || (value.campaign && (regularItemsTotal !== minor(value.subtotal) || lineDiscounts !== minor(value.discount)
      || minor(value.campaign.discountAmount) !== minor(value.discount)))) {
    throw new Error('Sipariş tutarları sözleşme özetiyle tutarlı değil.')
  }
}
