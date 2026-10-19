export class CheckoutVariantUnavailableError extends Error {
  readonly code = 'VARIANT_UNAVAILABLE'
  constructor(readonly productId: string) {
    super('Checkout variant unavailable')
    this.name = 'CheckoutVariantUnavailableError'
  }
}
