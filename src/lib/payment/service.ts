import 'server-only'
import { isIP } from 'node:net'
import { isoBytes } from './garanti/protocol'
import { UUID, parsePaymentRequest } from './request'
import type { PaymentProvider, PaymentRepository, VerifiedPayment } from './types'
import { PaymentStartError, startStage } from './start-error'

export async function initiatePayment(body: unknown, userId: string | null, guestHash: string | null,
  repository: PaymentRepository, provider: PaymentProvider, context?: { customerIp: string }) {
  const request = await startStage('request', async () => parsePaymentRequest(body))
  if (!userId || guestHash !== null) throw new Error('Kartla ödeme için hesabınıza giriş yapın.')
  if (provider.name === 'garanti-oos' && (!context || isIP(context.customerIp) !== 4)) throw new Error('Müşteri IP adresi doğrulanamadı.')
  if (provider.name === 'garanti-oos' && isoBytes(request.customer.email).length > 64) throw new Error('Banka ödeme adresi doğrulanamadı.')
  const existing = await startStage('lookup', () => repository.findExisting(request, userId, guestHash))
  if (existing) {
    if (provider.initiationMaxAmountMinor != null && existing.amountMinor > provider.initiationMaxAmountMinor) {
      throw new PaymentStartError('START_FAILED', 'lookup', 'Mevcut sipariş kontrollü canlı deneme üst sınırını aşıyor; yeniden ödeme başlatılmadı.')
    }
    if (provider.testObservationOnly && repository.resumeUnsubmittedTest) {
      const redirect = await startStage('handoff', () => repository.resumeUnsubmittedTest!(existing.id, userId, provider, context))
      validateRedirect(redirect.redirectUrl, provider)
      return { orderId: existing.id, ...redirect }
    }
    const redirect = await repository.getRedirect(existing.id)
    if (!redirect || existing.state === 'paid' || existing.state === 'failed') throw new Error('Siparişin ödeme durumunu kontrol edin; tekrar ödeme başlatılmadı.')
    validateRedirect(redirect.redirectUrl, provider)
    return { orderId: existing.id, ...redirect }
  }
  // All prices and stock come from DB; request prices/totals are discarded.
  const quote = await startStage('quote', () => repository.quote(request.items, request.customer))
  if (quote.hash !== request.quoteHash) throw new PaymentStartError('START_FAILED', 'quote', 'Sipariş bilgileri değişti. Özeti yeniden inceleyip onaylayın.')
  if (provider.initiationMaxAmountMinor != null) {
    const totalMinor = Math.round(quote.summary.total * 100)
    if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0 || totalMinor > provider.initiationMaxAmountMinor) {
      throw new PaymentStartError('START_FAILED', 'quote', 'Canlı deneme üst sınırını aşan sipariş için ödeme başlatılamaz.')
    }
  }
  const { order, created } = await startStage('create_rpc', () => repository.createAtomic(request, userId, guestHash, quote))
  if (!created) {
    const redirect = await repository.getRedirect(order.id)
    // Never initiate a second ambiguous payment after a timeout. Adapter must
    // reconcile the same merchantReference and idempotency key with its bank.
    if (!redirect || order.state === 'paid' || order.state === 'failed') throw new Error('Siparişin ödeme durumunu kontrol edin; tekrar ödeme başlatılmadı.')
    validateRedirect(redirect.redirectUrl, provider)
    return { orderId: order.id, ...redirect }
  }
  const redirect = await startStage('handoff', () => provider.initiate(order, request.idempotencyKey, context))
  validateRedirect(redirect.redirectUrl, provider)
  await startStage('store_redirect', () => repository.storeRedirect(order.id, redirect))
  return { orderId: order.id, ...redirect }
}
function validateRedirect(redirectUrl: string, provider: PaymentProvider) {
  const url = new URL(redirectUrl)
  if (url.protocol !== 'https:' || url.username || url.password || !provider.allowedRedirectOrigins.includes(url.origin)) throw new Error('Geçersiz ödeme yönlendirmesi.')
}
export function validateVerifiedPayment(payment: VerifiedPayment, provider: PaymentProvider) {
  if (provider.settlementDisabled) throw new Error('Observation-only test results cannot settle an order.')
  if (!payment || payment.merchantId !== provider.merchantId || !payment.eventId || !payment.transactionId
    || typeof payment.eventId !== 'string' || typeof payment.transactionId !== 'string'
    || !UUID.test(payment.merchantReference) || !Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0
    || payment.currency !== 'TRY' || !['pending', 'paid', 'failed'].includes(payment.status)
    || !['authenticated', 'not_required', 'failed'].includes(payment.threeDS)
    || (payment.status === 'paid' && payment.threeDS === 'failed')) throw new Error('Payment verification failed.')
}
export async function processPaymentCallback(rawBody: string, headers: Headers, repository: PaymentRepository, provider: PaymentProvider) {
  const verified = await provider.verifyCallback(rawBody, headers)
  validateVerifiedPayment(verified, provider)
  // Transaction also verifies merchant reference, amount, currency, unique event
  // and transaction IDs against stored order. Only then can status become paid.
  await repository.finalizeAtomic(verified, provider.name)
  return verified
}

// Use from the bank adapter's authenticated reconciliation job when callbacks
// are delayed or initiation timed out. Do not expire/release ambiguous stock.
export async function reconcilePayment(merchantReference: string, repository: PaymentRepository, provider: PaymentProvider) {
  const verified = await provider.reconcile(merchantReference)
  validateVerifiedPayment(verified, provider)
  if (verified.merchantReference !== merchantReference) throw new Error('Reconciliation reference mismatch.')
  await repository.finalizeAtomic(verified, provider.name)
}
