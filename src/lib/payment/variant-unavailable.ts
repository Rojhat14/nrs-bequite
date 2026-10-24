export class CheckoutVariantUnavailableError extends Error {
  readonly code = 'VARIANT_UNAVAILABLE'
  constructor(readonly productId: string) {
    super('Checkout variant unavailable')
    this.name = 'CheckoutVariantUnavailableError'
  }
}

/**
 * A cart line whose product is no longer sold (inactive, removed) or whose
 * chosen size no longer has enough stock. Saved carts (for example in the
 * Instagram in-app browser, which keeps its own storage) can hold such lines
 * long after they were added; checkout must name the line instead of failing
 * with a generic message.
 */
export class CheckoutProductUnavailableError extends Error {
  readonly code = 'PRODUCT_UNAVAILABLE'
  constructor(readonly productId: string, message = 'Ürün veya seçilen beden stokta yok.') {
    super(message)
    this.name = 'CheckoutProductUnavailableError'
  }
}

/**
 * The chosen size is still sold, but the cart asks for more than its stock.
 * Saved carts grow when the same size is added again on a later visit.
 */
export class CheckoutStockLimitError extends Error {
  readonly code = 'STOCK_LIMIT'
  constructor(readonly productId: string, readonly variantId: string, readonly available: number) {
    super('Ürün veya seçilen beden stokta yok.')
    this.name = 'CheckoutStockLimitError'
  }
}
