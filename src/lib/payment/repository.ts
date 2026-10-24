import { SHIPPING_MINOR, DELIVERY_TERMS } from '@/lib/delivery-policy'
import { measurementKind, validateOptionalMeasurements } from '@/lib/order-measurements'
import { getProductImageUrl } from '@/lib/storage/products'
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { prepareOrderLegalRecord } from '@/lib/legal/payment-preflight'
import { assertFinalLegalOrderSummary, type LegalOrderSummary, type OrderLegalRecord } from '@/lib/legal/order-summary'
import type { Buyer, CheckoutDisplayContext, CheckoutItem, CheckoutRequest, PaymentOrder, PaymentRedirect, PaymentRepository, Quote, VerifiedPayment } from './types'
import { requirePaymentDeployment } from './config'
import { UUID } from './request'
import { canonicalCheckoutItems } from './items'
import { GUEST_COOKIE, hashGuestToken } from './access'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { garantiLiveObservationOnly, garantiLiveSingleFinalizeArmed, garantiObservationOnly } from './garanti/config'
import { PaymentStartError } from './start-error'
import { GarantiProvider } from './garanti/adapter'
import { CheckoutProductUnavailableError, CheckoutStockLimitError, CheckoutVariantUnavailableError } from './variant-unavailable'
import { isMadeToOrderDressVariant } from '@/lib/dress-sizes'
import { isLiveObservationProduct, isLiveSingleFinalizeCheckout } from './garanti/live-observation-product'
import { allocateDisplayMinor, displayCurrency } from '@/lib/i18n/money'
import { productSourceHash } from '@/lib/i18n/source-hash'

// Stock taken by payment attempts that are still open (initiating/pending).
// Read only to explain a stock shortage; any error just means "unknown".
async function heldByUnfinishedPayments(db: ReturnType<typeof paymentDatabase>, variantId: string): Promise<number> {
  try {
    const reservations = await db.from('payment_stock_reservations').select('order_id,quantity,released').in('variant_id', [variantId])
    if (reservations.error) return 0
    const open = ((reservations.data ?? []) as { order_id: string; quantity: number; released: boolean }[]).filter(row => row.released === false)
    if (!open.length) return 0
    const orders = await db.from('payment_orders').select('order_id,state').in('order_id', open.map(row => row.order_id))
    if (orders.error) return 0
    const unfinished = new Set(((orders.data ?? []) as { order_id: string; state: string }[])
      .filter(row => row.state === 'initiating' || row.state === 'pending').map(row => row.order_id))
    return open.filter(row => unfinished.has(row.order_id)).reduce((sum, row) => sum + (Number.isSafeInteger(row.quantity) ? row.quantity : 0), 0)
  } catch { return 0 }
}

export function paymentDatabase() {
  if ((process.env.PAYMENT_DATABASE_VERIFIED !== 'true' && process.env.ORDER_DATABASE_VERIFIED !== 'true') || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Payment DB unavailable.')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key,
    { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url, options) => {
        const headers = new Headers(options?.headers)
        // The SDK's REST fallback treats this non-JWT key as Bearer too.
        // This isolated server client uses secret keys only through apikey.
        if (key.startsWith('sb_secret_')) headers.delete('Authorization')
        return fetch(url, { ...options, headers })
      } } })
}
export async function saveGarantiLiveSingleFinalizeEvidence(orderId: string, evidence: Record<string, unknown>) {
  const { error } = await paymentDatabase().rpc('nrs_store_garanti_live_single_finalize_evidence', {
    p_order_id: orderId, p_evidence: { ...evidence, order_id: orderId },
  })
  if (error) throw new Error('Verified payment evidence could not be stored.')
}
export async function saveGarantiLiveSingleFinalizeFailure(orderId: string, source: 'success' | 'failure',
  stage: string, safeCode: string, diagnostic: Record<string, unknown> = {}) {
  const { error } = await paymentDatabase().rpc('nrs_record_garanti_live_single_finalize_failure_v2', {
    p_order_id: orderId, p_source: source, p_failure_stage: stage, p_safe_code: safeCode, p_diagnostic: diagnostic,
  })
  if (error) throw new Error('Controlled live failure diagnostic could not be stored.')
}
export async function saveGarantiPaymentReturnDiagnostic(orderId: string, source: 'success' | 'failure',
  stage: string, safeCode: string, diagnostic: Record<string, unknown>) {
  const { error } = await paymentDatabase().rpc('nrs_record_garanti_payment_return_diagnostic', {
    p_order_id: orderId, p_source: source, p_failure_stage: stage, p_safe_code: safeCode, p_diagnostic: diagnostic,
  })
  if (error) throw new Error('Safe Garanti callback diagnostic could not be stored.')
}
export async function saveGarantiVerifiedPaymentEvidence(payment: VerifiedPayment, evidence: Record<string, unknown>) {
  if (payment.verificationMode !== 'PROD' || payment.status !== 'paid'
    || evidence.order_id !== payment.merchantReference || evidence.signature_verified !== true) {
    throw new Error('Verified Garanti payment evidence is incomplete.')
  }
  const boundEvidence = {
    ...evidence, order_id: payment.merchantReference, event_id: payment.eventId,
    transaction_id: payment.transactionId, merchant_id: payment.merchantId,
    amount_minor: payment.amountMinor, currency: payment.currency, verification_mode: payment.verificationMode,
  }
  const { error } = await paymentDatabase().rpc('nrs_store_garanti_verified_payment_evidence', {
    p_order_id: payment.merchantReference, p_evidence: boundEvidence,
  })
  if (error) throw new Error('Verified Garanti payment evidence could not be stored.')
}
const GARANTI_ORDERINQ_EVIDENCE_KEYS = new Set([
  'order_id', 'decision', 'reason', 'order_match', 'terminal_match', 'mode_match', 'amount_match',
  'outer_response_code', 'outer_reason_code', 'result_code', 'result_reason_code', 'status', 'charge_type',
  'auth_amount_state', 'auth_code_present', 'bank_reference_present', 'history_http',
  'history_transaction_code', 'history_transaction_reason_code', 'history_result_state', 'history_record_count',
  'history_identity_match', 'callback_signature_verified', 'signature_evidence_present', 'order_currency_match',
  'prov_user_match', 'agent_user_match', 'order_result_present', 'payment_event_count',
  'signed_callback_evidence_count', 'live_finalize_evidence_count',
])
export async function saveGarantiOrderinqReconciliation(orderId: string,
  decision: 'verified_success' | 'verified_failure' | 'pending', reason: string, evidence: Record<string, unknown>) {
  // The RPC intentionally accepts only its reviewed safe schema. The live
  // query object also carries transport metadata such as `http`; project it
  // onto the RPC schema so optional diagnostics cannot silently block writes.
  const safeEvidence = Object.fromEntries(Object.entries(evidence)
    .filter(([key]) => GARANTI_ORDERINQ_EVIDENCE_KEYS.has(key)))
  const { error } = await paymentDatabase().rpc('nrs_record_garanti_orderinq_reconciliation', {
    p_order_id: orderId, p_decision: decision, p_reason: reason, p_evidence: safeEvidence,
  })
  if (error) throw new Error('Garanti reconciliation evidence could not be stored.')
}
export async function closeExpiredGarantiNoRecordOrder(orderId: string, handoffExpiresAt: number) {
  const { data, error } = await paymentDatabase().rpc('nrs_close_expired_garanti_no_record_order', {
    p_order_id: orderId, p_handoff_expires_at: handoffExpiresAt,
  })
  if (error) throw new Error('Unverified expired payment could not be closed.')
  return data as { closed: boolean; idempotent: boolean; reason: string }
}
export async function acquireGarantiReconciliationCronLock(token: string) {
  const { data, error } = await paymentDatabase().rpc('nrs_acquire_garanti_reconciliation_cron_lock', { p_token: token })
  if (error) throw new Error('Garanti reconciliation scheduler lock unavailable.')
  return data === true
}
export async function releaseGarantiReconciliationCronLock(token: string) {
  const { error } = await paymentDatabase().rpc('nrs_release_garanti_reconciliation_cron_lock', { p_token: token })
  if (error) throw new Error('Garanti reconciliation scheduler lock release failed.')
}
export async function listExpiredGarantiPendingOrders(limit: number, olderThan: string) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isFinite(Date.parse(olderThan))) {
    throw new Error('Invalid Garanti reconciliation batch.')
  }
  const { data, error } = await paymentDatabase().from('payment_orders')
    .select('order_id,user_id,redirect_url,updated_at,orders!inner(status)')
    .eq('provider', 'garanti-oos').eq('state', 'pending').eq('currency', 'TRY')
    .eq('orders.status', 'payment_pending').not('redirect_url', 'is', null)
    .like('redirect_url', '%used=1').lt('updated_at', olderThan)
    .order('updated_at', { ascending: true }).limit(limit)
  if (error || !Array.isArray(data)) throw new Error('Garanti reconciliation candidates unavailable.')
  return data as Array<{ order_id: string; user_id: string | null; redirect_url: string; updated_at: string }>
}
export async function readGarantiOrderinqReconciliation(orderId: string) {
  const { data, error } = await paymentDatabase().from('garanti_orderinq_reconciliations')
    .select('decision,reason,evidence,updated_at').eq('order_id', orderId).maybeSingle()
  return error ? null : data
}
// Read only coarse, order-bound proof signals before interpreting a bank
// "record not found" response. Never return transaction IDs or callback values.
export async function readGarantiSettlementEvidence(orderId: string) {
  if (!UUID.test(orderId)) throw new Error('Invalid payment reference.')
  const db = paymentDatabase()
  const [events, returns, liveEvidence, liveFailures] = await Promise.all([
    db.from('payment_events').select('event_id,state').eq('order_id', orderId),
    db.from('garanti_payment_return_diagnostics').select('diagnostic').eq('order_id', orderId),
    db.from('garanti_live_single_finalize_evidence').select('signature_verified').eq('order_id', orderId),
    db.from('garanti_live_single_finalize_failures').select('callback_signature_verified').eq('order_id', orderId),
  ])
  const error = events.error || returns.error || liveEvidence.error || liveFailures.error
  if (error) throw new Error('Order-bound payment evidence unavailable.')
  const verifiedReturnCount = (returns.data || []).filter(row => row.diagnostic?.signature_verified === true).length
  const liveEvidenceCount = (liveEvidence.data || []).filter(row => row.signature_verified === true).length
  const failureEvidenceCount = (liveFailures.data || []).filter(row => row.callback_signature_verified === true).length
  return {
    payment_event_count: (events.data || []).length,
    signed_callback_evidence_count: verifiedReturnCount + failureEvidenceCount,
    live_finalize_evidence_count: liveEvidenceCount,
  }
}
export async function readGarantiLiveSingleFinalizeFailure(orderId: string) {
  if (!garantiLiveObservationOnly() || !UUID.test(orderId)) return null
  const { data, error } = await paymentDatabase().from('garanti_live_single_finalize_failures')
    .select('source,failure_stage,safe_code,callback_signature_verified,callback_signature_result,order_match,amount_match,currency_match,terminal_match,request_match,callback_mdstatus,callback_response,callback_procreturncode,mderrormessage_present,errmsg_present,error_text_signed,error_category,verification_basis,saved_at')
    .eq('order_id', orderId).maybeSingle()
  return error ? null : data
}
export async function finalizeGarantiLiveSinglePayment(payment: VerifiedPayment) {
  const { error } = await paymentDatabase().rpc('nrs_finalize_garanti_live_single_finalize_payment', {
    p_payment: payment, p_provider: 'garanti-oos',
  })
  if (error) throw new Error('Controlled payment result could not be committed.')
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
      if (error) throw new PaymentStartError('START_FAILED', 'lookup', 'Ödeme durumu doğrulanamadı.', error.code)
      // Separate TEST attempts use separate keys/orders. Never fold a new key
      // into another pending order; exact-key ownership/content checks remain.
      if (!data) return null
      if (data.user_id !== userId || data.guest_hash !== guestHash || data.request_hash !== requestHash(request) || data.provider !== process.env.PAYMENT_PROVIDER) throw new Error('Sipariş isteği doğrulanamadı.')
      return { id: data.order_id, merchantReference: data.merchant_reference, amountMinor: Number(data.amount_minor), currency: data.currency, state: data.state } as PaymentOrder
    },
    async resumeUnsubmittedTest(orderId, userId, provider, context) {
      if (manual || !garantiObservationOnly() || !(provider instanceof GarantiProvider) || !provider.config.observationOnly) throw new Error('Test-only resume unavailable.')
      const { loadGarantiOrder } = await import('./garanti/order')
      const stored = await loadGarantiOrder(orderId)
      if (stored.userId !== userId || stored.state !== 'pending' || !stored.redirectUrl) throw new Error('Test order cannot resume.')
      const current = new URL(stored.redirectUrl)
      if (current.searchParams.has('used')) throw new PaymentStartError('TEST_HANDOFF_SUBMITTED', 'handoff', 'Bu test siparişi bankaya gönderilmiş. Sonuç doğrulanmadan tekrar ödeme başlatılmadı.', undefined, orderId)
      const tokens = current.searchParams.getAll('token')
      if (current.origin !== provider.config.siteOrigin || current.pathname !== '/api/payment/garanti/handoff' || tokens.length !== 1) {
        throw new Error('Stored TEST handoff unavailable.')
      }
      try {
        if (provider.handoff(tokens[0]).id !== orderId) throw new Error('TEST handoff order mismatch.')
      } catch {
        // An expired/invalid unsubmitted link can be renewed from the owned
        // order-result page. A duplicate create request must never rotate it:
        // another browser may already be using the currently stored token.
        throw new PaymentStartError('UNRESOLVED_PAYMENT', 'handoff', 'Continue the existing TEST order.', undefined, orderId)
      }
      void context
      return { redirectUrl: stored.redirectUrl }
    },
    async quote(items: CheckoutItem[], customer: Buyer, userId?: string | null, display: CheckoutDisplayContext = { locale: 'tr', rate: null }): Promise<Quote> {
      const sorted = canonicalCheckoutItems(items)
      const [products, variants] = await Promise.all([
        db.from('products').select('id,name,description,fabric,care,price_amount,compare_at_price,currency,status,in_stock,payment_test_only,fulfillment_mode,categories(name,slug),product_images(*)').in('id', sorted.map(i => i.productId)),
        db.from('product_variants').select('id,product_id,size,stock_quantity,is_active').in('id', sorted.map(i => i.variantId)),
      ])
      if (products.error || variants.error) throw new PaymentStartError('START_FAILED', 'quote', 'Ürün bilgileri doğrulanamadı.', (products.error || variants.error)?.code)
      let translations: { entity_id: string; source_hash: string; payload: Record<string, unknown> }[] = []
      if (display.locale !== 'tr' && products.data.length) {
        const result = await db.from('storefront_translations').select('entity_id,source_hash,payload')
          .eq('entity_type', 'product').eq('locale', display.locale).in('entity_id', products.data.map(product => product.id))
        if (result.error) throw new PaymentStartError('START_FAILED', 'quote', 'Ürün çevirileri doğrulanamadı.', result.error.code)
        translations = (result.data ?? []) as typeof translations
      }
      const translationsByProduct = new Map(translations.map(row => [row.entity_id, row]))
      let subtotalMinor = 0, saleMinor = 0
      // The hidden payment-test product is not a sale-open catalog item and
      // its existing single-price authorization must remain unchanged.
      // Explain a stock shortage before building lines (the line builder is
      // synchronous). Stop at the first otherwise-invalid line so the existing
      // product/size errors below keep their order.
      for (const item of sorted) {
        const product = products.data.find(p => p.id === item.productId)
        const variant = variants.data.find(v => v.id === item.variantId && v.product_id === item.productId)
        if (!product || product.status !== 'active' || product.currency !== 'TRY' || !variant || variant.is_active !== true) break
        const madeToOrderDress = isMadeToOrderDressVariant(product.id, product.fulfillment_mode, variant.size)
        if (product.fulfillment_mode === 'made_to_order' && !madeToOrderDress) break
        if (!madeToOrderDress && (!Number.isSafeInteger(variant.stock_quantity) || variant.stock_quantity < item.quantity)) {
          const available = Number.isSafeInteger(variant.stock_quantity) ? Math.max(0, variant.stock_quantity) : 0
          throw new CheckoutStockLimitError(item.productId, item.variantId, available, await heldByUnfinishedPayments(db, item.variantId))
        }
      }
      const lines = sorted.map(item => {
        const product = products.data.find(p => p.id === item.productId)
        const variant = variants.data.find(v => v.id === item.variantId && v.product_id === item.productId)
        if (!product || product.status !== 'active' || product.currency !== 'TRY') throw new CheckoutProductUnavailableError(item.productId)
        if (!variant || variant.is_active !== true) throw new CheckoutVariantUnavailableError(item.productId)
        const madeToOrderDress = isMadeToOrderDressVariant(product.id, product.fulfillment_mode, variant.size)
        if (product.fulfillment_mode === 'made_to_order' && !madeToOrderDress) throw new CheckoutVariantUnavailableError(item.productId)
        if (!madeToOrderDress && (!Number.isSafeInteger(variant.stock_quantity) || variant.stock_quantity < item.quantity)) {
          throw new CheckoutStockLimitError(item.productId, item.variantId, Number.isSafeInteger(variant.stock_quantity) ? Math.max(0, variant.stock_quantity) : 0)
        }
        const translation = translationsByProduct.get(product.id)
        const localized = translation?.source_hash === productSourceHash(product) ? translation.payload : null
        const displayName = typeof localized?.name === 'string' ? localized.name : product.name
        const displayDescription = typeof localized?.description === 'string' ? localized.description : product.description || product.name
        const priceMinor = Math.round(Number(product.price_amount) * 100)
        if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) throw new Error('Ürün fiyatı doğrulanamadı.')
        subtotalMinor += priceMinor * item.quantity
        saleMinor += priceMinor * item.quantity
        const category = Array.isArray(product.categories) ? product.categories[0] : product.categories
        const kind = measurementKind(`${product.name} ${category?.name || ''} ${category?.slug || ''}`)
        const measurements = validateOptionalMeasurements(item.measurements)
        const images = product.product_images || []
        const image = images.find((row: { is_primary?: boolean }) => row.is_primary) || images[0]
        return { measurementKind: kind, ...(image ? { image: getProductImageUrl(db, image) || undefined } : {}), productId: item.productId, variantId: item.variantId,
          ...(Object.keys(measurements).length ? { measurements } : {}), name: displayName, description: displayDescription,
          ...(variant.size ? { size: variant.size } : {}), quantity: item.quantity, unitPrice: priceMinor / 100 }
      })
      const shippingMinor = SHIPPING_MINOR
      const summary: LegalOrderSummary = { items: lines,
        orderNote: customer.orderNote, buyer: { name: `${customer.firstName} ${customer.lastName}`, email: customer.email, phone: customer.phone,
          address: [customer.address, customer.district, customer.city, customer.postalCode].filter(Boolean).join(', ') },
        subtotal: subtotalMinor / 100, discount: 0,
        shipping: shippingMinor / 100,
        total: (saleMinor + shippingMinor) / 100, currency: 'TRY', paymentMethod: manual ? 'Havale / EFT — ödeme henüz doğrulanmadı' : 'Online kartla ödeme',
        deliveryTerms: DELIVERY_TERMS, orderedAt: new Date().toISOString() }
      const totalMinor = saleMinor + shippingMinor
      if (![subtotalMinor, saleMinor, shippingMinor, totalMinor].every(Number.isSafeInteger)) throw new Error('Sipariş tutarı doğrulanamadı.')
      const displayCurrencyCode = displayCurrency(display.locale, display.rate)
      const displayLines = allocateDisplayMinor(lines.map(line => Math.round(line.unitPrice * 100) * line.quantity), display.locale, display.rate)
      const displayedSubtotal = allocateDisplayMinor([subtotalMinor], display.locale, display.rate)[0]
      const displayedShipping = allocateDisplayMinor([shippingMinor], display.locale, display.rate)[0]
      const displayedSale = displayLines.reduce((sum, amount) => sum + amount, 0)
      summary.display = {
        locale: display.locale, currency: displayCurrencyCode,
        exchangeRate: displayCurrencyCode === 'USD' ? display.rate!.usdTry : null,
        exchangeRateAt: displayCurrencyCode === 'USD' ? display.rate!.fetchedAt : null,
        exchangeRateDate: displayCurrencyCode === 'USD' ? display.rate!.rateDate ?? null : null,
        subtotalMinor: displayedSubtotal, discountMinor: displayedSubtotal - displayedSale,
        shippingMinor: displayedShipping, totalMinor: displayedSale + displayedShipping,
        itemLineMinor: displayLines,
      }
      const privateTrial = products.data.some(product => isLiveObservationProduct(product))
      const trialAllowed = privateTrial && !!userId && !manual && process.env.PAYMENT_PROVIDER === 'garanti-oos'
        && isLiveSingleFinalizeCheckout(sorted, saleMinor + shippingMinor)
        && garantiLiveSingleFinalizeArmed(userId, saleMinor + shippingMinor)
      if (privateTrial && !trialAllowed) throw new Error('Private trial product is not available for this checkout.')
      if (!privateTrial && products.data.some(product => product.payment_test_only === true)) {
        throw new Error('Test-only product is not available for this checkout.')
      }
      assertFinalLegalOrderSummary(summary)
      return { summary, hash: quoteHash(summary) }
    },
    async createAtomic(request: CheckoutRequest, userId: string | null, guestHash: string | null, quote: Quote) {
      if ((userId && guestHash !== null) || (!userId && (!guestHash || !/^[0-9a-f]{64}$/.test(guestHash)))) {
        throw new Error('Order access unavailable.')
      }
      const id = randomUUID()
      const record = prepareOrderLegalRecord(id, request, quote.summary)
      const amountMinor = Math.round(quote.summary.total * 100)
      const liveSingleFinalizeArmed = !manual && process.env.PAYMENT_PROVIDER === 'garanti-oos'
        && garantiLiveSingleFinalizeArmed(userId, amountMinor)
      const liveSingleFinalizeItem = isLiveSingleFinalizeCheckout(request.items, amountMinor)
      if (liveSingleFinalizeArmed && !liveSingleFinalizeItem) {
        throw new PaymentStartError('CONTROLLED_ITEM_REQUIRED', 'quote', 'Tek kullanımlık canlı izin bu ürün veya sepet için kullanılamaz.')
      }
      const liveSingleFinalize = liveSingleFinalizeArmed && liveSingleFinalizeItem
      const rpcName = !manual && garantiObservationOnly() ? 'nrs_create_garanti_test_observation_order'
        : liveSingleFinalize ? 'nrs_create_garanti_live_single_finalize_order' : 'nrs_create_payment_order'
      const rpcArgs = {
        p_order_id: id, p_user_id: userId, p_guest_hash: guestHash, p_key: request.idempotencyKey,
        p_request_hash: requestHash(request),
        p_items: canonicalCheckoutItems(request.items), p_customer: request.customer, p_legal: record,
        p_provider: process.env.PAYMENT_PROVIDER,
        ...(liveSingleFinalize ? { p_authorized_user_id: userId } : {}),
      }
      const { data, error } = await db.rpc(rpcName, rpcArgs)
      if (error || !data?.order) {
        // A distinct key cannot create a second TEST order after the single
        // finalize slot has been claimed. Link the same owner back to that
        // order so they can resume its unsubmitted handoff instead of seeing
        // a generic startup error or attempting another checkout.
        if (!manual && userId && garantiObservationOnly() && error?.code === 'P0001'
          && error.message === 'Single TEST finalization order already claimed') {
          let resumeOrderId: string | undefined
          try {
            const { data: allowance, error: allowanceError } = await db.from('garanti_test_single_finalize_allowances')
              .select('order_id').eq('project_ref', 'dzuxhwtbuojnhibzfxqy')
              .eq('site_origin', 'https://nrs-bequite-garanti-test.vercel.app').eq('user_id', userId).maybeSingle()
            const id = !allowanceError && allowance?.order_id
            if (typeof id === 'string' && UUID.test(id)) {
              const { data: existing, error: orderError } = await db.from('payment_orders')
                .select('order_id').eq('order_id', id).eq('user_id', userId)
                .eq('provider', 'garanti-oos').eq('state', 'pending').maybeSingle()
              if (!orderError && existing?.order_id === id) resumeOrderId = id
            }
          } catch { /* No resume link unless ownership and pending state are verified. */ }
          throw new PaymentStartError('UNRESOLVED_PAYMENT', 'create_rpc',
            'An existing single TEST order must be continued.', 'P0001', resumeOrderId)
        }
        throw new PaymentStartError(
          error?.code === 'P0001' && error.message === 'Unresolved payment exists; reconcile before a new attempt' ? 'UNRESOLVED_PAYMENT' : 'START_FAILED',
          'create_rpc', 'Sipariş oluşturulamadı. Sepetinizi kontrol edin.', error?.code)
      }
      return data as { order: PaymentOrder; created: boolean }
    },
    async storeRedirect(orderId: string, redirect: PaymentRedirect) {
      const { error } = await db.rpc('nrs_store_payment_redirect', { p_order_id: orderId, p_redirect: redirect.redirectUrl })
      if (error) throw new PaymentStartError('START_FAILED', 'store_redirect', 'Ödeme durumu kaydedilemedi. Yeniden ödeme başlatmayın; bizimle iletişime geçin.', error.code)
    },
    async getRedirect(orderId: string) {
      const { data, error } = await db.from('payment_orders').select('redirect_url').eq('order_id', orderId).maybeSingle()
      if (error) throw new Error('Ödeme durumu yüklenemedi.')
      return data?.redirect_url ? { redirectUrl: data.redirect_url } : null
    },
    async finalizeAtomic(payment: VerifiedPayment, provider: string, callbackSignatureVerified = false) {
      const callbackPayment = callbackSignatureVerified
        ? { ...payment, callbackSignatureVerified: true }
        : payment
      const { error } = await db.rpc('nrs_finalize_payment', { p_payment: callbackPayment, p_provider: provider })
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
  return data as { id: string; status: PaymentOrder['state'] | 'payment_unverified'; legal: OrderLegalRecord }
}
