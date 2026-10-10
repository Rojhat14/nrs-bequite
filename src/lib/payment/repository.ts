import { SHIPPING_MINOR, DELIVERY_TERMS } from '@/lib/delivery-policy'
import { measurementKind, validateRequiredMeasurements } from '@/lib/order-measurements'
import { getProductImageUrl } from '@/lib/storage/products'
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { prepareOrderLegalRecord } from '@/lib/legal/payment-preflight'
import { assertFinalLegalOrderSummary, type LegalOrderSummary, type OrderLegalRecord } from '@/lib/legal/order-summary'
import type { Buyer, CheckoutItem, CheckoutRequest, PaymentOrder, PaymentRedirect, PaymentRepository, Quote, VerifiedPayment } from './types'
import { requirePaymentDeployment } from './config'
import { UUID } from './request'
import { canonicalCheckoutItems } from './items'
import { GUEST_COOKIE, hashGuestToken } from './access'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export function paymentDatabase() {
  if ((process.env.PAYMENT_DATABASE_VERIFIED !== 'true' && process.env.ORDER_DATABASE_VERIFIED !== 'true') || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Payment DB unavailable.')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } })
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function requestHash(request: CheckoutRequest) {
  return digest({ items: canonicalCheckoutItems(request.items), customer: request.customer,
    quoteHash: request.quoteHash, contractVersion: request.contractVersion, preInformationVersion: request.preInformationVersion })
}
// Exclude volatile quote date; bind all commercial and delivery fields. The final
// order date is assigned on the server when the atomic RPC creates the order.
export function quoteHash(summary: LegalOrderSummary) {
  const { orderedAt: _date, ...commercial } = summary
  void _date
  return digest(commercial)
}
export function createPaymentRepository(manual = false): PaymentRepository {
  if (manual) {
    if (process.env.ORDER_DATABASE_VERIFIED !== 'true') throw new Error('Order database unavailable.')

  } else requirePaymentDeployment()
  const db = paymentDatabase()
  return {
    async findExisting(request, userId, guestHash) {
      const { data, error } = await db.from('payment_orders')
        .select('order_id,user_id,guest_hash,request_hash,provider,merchant_reference,amount_minor,currency,state')
        .eq('idempotency_key', request.idempotencyKey).maybeSingle()
      if (error) throw new Error('Ödeme durumu doğrulanamadı.')
      if (!data) return null
      if (data.user_id !== userId || data.guest_hash !== guestHash || data.request_hash !== requestHash(request) || data.provider !== process.env.PAYMENT_PROVIDER) throw new Error('Sipariş isteği doğrulanamadı.')
      return { id: data.order_id, merchantReference: data.merchant_reference, amountMinor: Number(data.amount_minor), currency: data.currency, state: data.state } as PaymentOrder
    },
    async quote(items: CheckoutItem[], customer: Buyer): Promise<Quote> {
      const sorted = canonicalCheckoutItems(items)
      const [products, variants] = await Promise.all([
        db.from('products').select('id,name,description,price_amount,compare_at_price,currency,status,in_stock,categories(name,slug),product_images(*)').in('id', sorted.map(i => i.productId)),
        db.from('product_variants').select('id,product_id,size,stock_quantity,is_active').in('id', sorted.map(i => i.variantId)),
      ])
      if (products.error || variants.error) throw new Error('Ürün bilgileri doğrulanamadı.')
      let subtotalMinor = 0, saleMinor = 0
      const lines = sorted.map(item => {
        const product = products.data.find(p => p.id === item.productId)
        const variant = variants.data.find(v => v.id === item.variantId && v.product_id === item.productId)
        if (!product || product.status !== 'active' || product.currency !== 'TRY'
          || variant?.is_active !== true || !Number.isSafeInteger(variant.stock_quantity) || variant.stock_quantity < item.quantity) throw new Error('Ürün veya seçilen beden stokta yok.')
        const priceMinor = Math.round(Number(product.price_amount) * 100)
        const compareMinor = product.compare_at_price == null ? priceMinor : Math.round(Number(product.compare_at_price) * 100)
        if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0 || !Number.isSafeInteger(compareMinor)) throw new Error('Ürün fiyatı doğrulanamadı.')
        saleMinor += priceMinor * item.quantity
        subtotalMinor += Math.max(priceMinor, compareMinor) * item.quantity
        const category = Array.isArray(product.categories) ? product.categories[0] : product.categories
        const kind = measurementKind(`${product.name} ${category?.name || ''} ${category?.slug || ''}`)
        const measurements = validateRequiredMeasurements(item.measurements, kind)
        const images = product.product_images || []
        const image = images.find((row: { is_primary?: boolean }) => row.is_primary) || images[0]
        return { measurementKind: kind, ...(image ? { image: getProductImageUrl(db, image) || undefined } : {}), productId: item.productId, variantId: item.variantId, measurements, name: product.name, description: product.description || product.name,
          ...(variant.size ? { size: variant.size } : {}), quantity: item.quantity, unitPrice: priceMinor / 100 }
      })
      const shippingMinor = SHIPPING_MINOR
      const summary: LegalOrderSummary = { items: lines,
        orderNote: customer.orderNote, buyer: { name: `${customer.firstName} ${customer.lastName}`, email: customer.email, phone: customer.phone,
          address: [customer.address, customer.district, customer.city, customer.postalCode].filter(Boolean).join(', ') },
        subtotal: subtotalMinor / 100, discount: (subtotalMinor - saleMinor) / 100, shipping: shippingMinor / 100,
        total: (saleMinor + shippingMinor) / 100, currency: 'TRY', paymentMethod: manual ? 'Havale / EFT — ödeme henüz doğrulanmadı' : 'Online kartla ödeme',
        deliveryTerms: DELIVERY_TERMS, orderedAt: new Date().toISOString() }
      if (![subtotalMinor, saleMinor, shippingMinor, saleMinor + shippingMinor].every(Number.isSafeInteger)) throw new Error('Sipariş tutarı doğrulanamadı.')
      assertFinalLegalOrderSummary(summary)
      return { summary, hash: quoteHash(summary) }
    },
    async createAtomic(request: CheckoutRequest, userId: string | null, guestHash: string | null, quote: Quote) {
      if (!userId || guestHash !== null) throw new Error('Authenticated checkout required.')
      const id = randomUUID()
      const record = prepareOrderLegalRecord(id, request, quote.summary)
      const { data, error } = await db.rpc('nrs_create_payment_order', {
        p_order_id: id, p_user_id: userId, p_guest_hash: guestHash, p_key: request.idempotencyKey,
        p_request_hash: requestHash(request),
        p_items: canonicalCheckoutItems(request.items), p_customer: request.customer, p_legal: record,
        p_provider: process.env.PAYMENT_PROVIDER,
      })
      if (error || !data?.order) throw new Error('Sipariş oluşturulamadı. Sepetinizi kontrol edin.')
      return data as { order: PaymentOrder; created: boolean }
    },
    async storeRedirect(orderId: string, redirect: PaymentRedirect) {
      const { error } = await db.rpc('nrs_store_payment_redirect', { p_order_id: orderId, p_redirect: redirect.redirectUrl })
      if (error) throw new Error('Ödeme durumu kaydedilemedi. Yeniden ödeme başlatmayın; bizimle iletişime geçin.')
    },
    async getRedirect(orderId: string) {
      const { data, error } = await db.from('payment_orders').select('redirect_url').eq('order_id', orderId).maybeSingle()
      if (error) throw new Error('Ödeme durumu yüklenemedi.')
      return data?.redirect_url ? { redirectUrl: data.redirect_url } : null
    },
    async finalizeAtomic(payment: VerifiedPayment, provider: string) {
      const { error } = await db.rpc('nrs_finalize_payment', { p_payment: payment, p_provider: provider })
      if (error) throw new Error('Payment result could not be committed.')
    },
  }
}
export async function readAccessiblePaymentOrder(id: string) {
  if (!UUID.test(id) || process.env.PAYMENT_DATABASE_VERIFIED !== 'true') return null
  // Authentication is validated by Supabase getUser, never client userId.
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  const cookie = (await cookies()).get(GUEST_COOKIE)?.value
  let guestHash: string | null = null
  try { if (cookie) guestHash = hashGuestToken(cookie) } catch { /* invalid cookie grants nothing */ }
  if (!user && !guestHash) return null
  const { data, error } = await paymentDatabase().rpc('nrs_read_payment_order',
    { p_order_id: id, p_user_id: user?.id ?? null, p_guest_hash: guestHash })
  if (error || !data) return null
  return data as { id: string; status: PaymentOrder['state']; legal: OrderLegalRecord }
}
