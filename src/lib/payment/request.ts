import { parseMeasurements } from '@/lib/order-measurements'
import type { Buyer, CheckoutItem, CheckoutRequest } from './types'
import { validateLegalAcceptance } from '@/lib/legal/acceptance'
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseCheckoutInput(value: unknown): { items: CheckoutItem[]; customer: Buyer } {
  if (!value || typeof value !== 'object') throw new Error('Geçersiz sepet.')
  const body = value as Record<string, unknown>
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new Error('Geçersiz sepet.')
  const seen = new Set<string>()
  const items = body.items.map(raw => {
    if (!raw || typeof raw !== 'object') throw new Error('Geçersiz ürün.')
    const item = raw as Record<string, unknown>
    if (typeof item.productId !== 'string' || !item.productId.trim() || item.productId.length > 200
      || typeof item.variantId !== 'string' || !UUID.test(item.variantId)
      || typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100
      || seen.has(item.variantId)) throw new Error('Ürün/beden/adet doğrulanamadı.')
    seen.add(item.variantId)
    return { productId: item.productId, variantId: item.variantId, quantity: item.quantity, measurements: parseMeasurements(item.measurements) }
  })
  if (!body.customer || typeof body.customer !== 'object') throw new Error('Müşteri bilgileri eksik.')
  const customer = {} as Buyer
  for (const field of ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'district', 'postalCode'] as const) {
    const text = (body.customer as Record<string, unknown>)[field]
    if (typeof text !== 'string' || text.length > 500 || (field !== 'postalCode' && !text.trim())) throw new Error('Müşteri/teslimat bilgileri eksik.')
    customer[field] = text.trim()
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new Error('Geçerli e-posta girin.')
  const note = (body.customer as Record<string, unknown>).orderNote
  if (note !== undefined && (typeof note !== 'string' || note.length > 2000)) throw new Error('Sipariş notu çok uzun.')
  if (typeof note === 'string') customer.orderNote = note.trim()
  if (!/^[+()\d\s-]{10,25}$/.test(customer.phone)) throw new Error('Geçerli telefon girin.')
  if (!/^\d{5}$/.test(customer.postalCode)) throw new Error('Beş haneli posta kodu girin.')
  return { items, customer }
}
export function parsePaymentRequest(value: unknown): CheckoutRequest {
  const error = validateLegalAcceptance(value)
  if (error) throw new Error(error)
  const input = parseCheckoutInput(value)
  const body = value as CheckoutRequest
  if (!UUID.test(body.idempotencyKey) || !/^[0-9a-f]{64}$/.test(body.quoteHash)) throw new Error('Sipariş teyidi eksik.')
  return { ...input, contractAccepted: true, contractVersion: body.contractVersion,
    preInformationVersion: body.preInformationVersion, quoteHash: body.quoteHash, idempotencyKey: body.idempotencyKey }
}
