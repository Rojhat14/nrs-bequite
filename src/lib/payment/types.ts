import type { Measurements } from '@/lib/order-measurements'
import type { LegalOrderSummary, OrderLegalRecord } from '@/lib/legal/order-summary'
import type { LegalAcceptance } from '@/lib/legal/acceptance'

export interface CheckoutItem { productId: string; variantId: string; quantity: number; measurements?: Measurements }
export interface Buyer { firstName: string; lastName: string; email: string; phone: string; address: string; city: string; district: string; postalCode: string; orderNote?: string }
export interface CheckoutRequest extends LegalAcceptance { items: CheckoutItem[]; customer: Buyer; quoteHash: string; idempotencyKey: string }
export interface Quote { summary: LegalOrderSummary; hash: string }
export interface PaymentOrder { id: string; merchantReference: string; amountMinor: number; currency: string; state: 'initiating' | 'pending' | 'paid' | 'failed'; legal: OrderLegalRecord }
export interface PaymentRedirect { redirectUrl: string }
// The adapter must authenticate raw callback bytes, then independently query the
// provider when its protocol requires it. Browser return parameters are NOT proof.
export interface VerifiedPayment {
  eventId: string; merchantId: string; merchantReference: string; transactionId: string
  amountMinor: number; currency: string; status: 'pending' | 'paid' | 'failed'
  threeDS: 'authenticated' | 'not_required' | 'failed'
}
export interface PaymentProvider {
  readonly name: string
  readonly merchantId: string
  readonly allowedRedirectOrigins: readonly string[]
  initiate(order: PaymentOrder, idempotencyKey: string): Promise<PaymentRedirect>
  verifyCallback(rawBody: string, headers: Headers): Promise<VerifiedPayment>
  verifyReturn(rawBody: string, headers: Headers): Promise<VerifiedPayment>
  reconcile(merchantReference: string): Promise<VerifiedPayment>
  callbackResponse(): Response
}
// The database implementations MUST use transactions and row locks. A single
// RPC creates order + items + immutable legal record + stock reservation.
export interface PaymentRepository {
  findExisting(request: CheckoutRequest, userId: string | null, guestHash: string | null): Promise<PaymentOrder | null>
  quote(items: CheckoutItem[], customer: Buyer): Promise<Quote>
  createAtomic(request: CheckoutRequest, userId: string | null, guestHash: string | null, quote: Quote): Promise<{ order: PaymentOrder; created: boolean }>
  storeRedirect(orderId: string, redirect: PaymentRedirect): Promise<void>
  getRedirect(orderId: string): Promise<PaymentRedirect | null>
  finalizeAtomic(payment: VerifiedPayment, provider: string): Promise<void>
}
