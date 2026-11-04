import type { Product } from '@/data/products'

/** The winter check coats announced on the homepage. */
export const WINTER_COATS = [
  'rosa-ekose-kemerli-yun-kasmir-kaban',
  'saffron-tuvit-kruvaze-yun-kasmir-kaban',
  'sapphire-ekose-kemerli-yun-kasmir-kaban',
  'azure-ekose-kruvaze-yun-kasmir-kaban',
] as const

/** Lowest price a shopper can buy one of these coats at right now, read from the
 * catalogue so the homepage can never announce a price checkout will not charge.
 * It states a price only: no earlier price or discount is claimed. */
export function coatStartingPrice(products: Product[]): number | null {
  const prices = products
    .filter(product => (WINTER_COATS as readonly string[]).includes(product.slug || product.id))
    .filter(product => product.inStock && product.priceAmount != null)
    .map(product => product.priceAmount!)
  return prices.length ? Math.min(...prices) : null
}
