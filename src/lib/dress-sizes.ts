/** Verified active TRY catalog products in category "Elbiseler" that are
 * dresses. Jumpsuits and the kimono in the same category are intentionally
 * absent. The database variant rows remain the source of size IDs and stock. */
export const NUMERIC_DRESS_PRODUCT_IDS = new Set([
  'noir-crystal-collar-saten-elbise',
  'burgundy-embroidered-kalem-elbise',
  '11111222',
  'slate-cepli-dugmeli-maxi-gomlek-elbise',
  'azure-geometrik-desenli-dugmeli-maxi-elbise',
  'noir-bros-detayli-kruvaze-uzun-elbise',
  'noir-cicek-aplikeli-gipeli-maksi-siyah-elbise',
  'scarlet-dik-yaka-v-dekolteli-kirmizi-midi-elbise',
  'elysian-asimetrik-yaka-drape-katmanli-kahve-midi-elbise',
  'scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise',
  'etoile-bros-detayli-uzun-siyah-ceket-elbise',
])

export const NUMERIC_DRESS_SIZES = ['32', '34', '36', '38', '40', '42', '44'] as const
export const MADE_TO_ORDER_DRESS_IDS = NUMERIC_DRESS_PRODUCT_IDS

export function isNumericDressProduct(product: { id: string; category: string }) {
  // Product ID is authoritative here because category labels are localized in
  // the storefront. The allowlist contains real dresses only; jumpsuits and
  // the kimono from the same category are deliberately excluded.
  return NUMERIC_DRESS_PRODUCT_IDS.has(product.id)
}

export type DressVariantOption = { id: string; label: string; size?: string; stock: number }

export function isMadeToOrderDressVariant(productId: string, fulfillmentMode: unknown, size: unknown) {
  return fulfillmentMode === 'made_to_order'
    && MADE_TO_ORDER_DRESS_IDS.has(productId)
    && typeof size === 'string'
    && NUMERIC_DRESS_SIZES.includes(size as (typeof NUMERIC_DRESS_SIZES)[number])
}

const ALPHA_SIZE_ORDER = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

/** Keep legacy sizes in a predictable order until the catalogue has verified
 * numeric size-to-variant mappings. This changes presentation only. */
export function sortActualVariantOptions(actual: DressVariantOption[]): DressVariantOption[] {
  return [...actual].sort((a, b) => {
    const aNumeric = /^\d+$/.test(a.size ?? '') ? Number(a.size) : null
    const bNumeric = /^\d+$/.test(b.size ?? '') ? Number(b.size) : null
    if (aNumeric !== null && bNumeric !== null) return aNumeric - bNumeric
    if (aNumeric !== null) return -1
    if (bNumeric !== null) return 1
    const aRank = ALPHA_SIZE_ORDER.indexOf((a.size ?? '').toUpperCase())
    const bRank = ALPHA_SIZE_ORDER.indexOf((b.size ?? '').toUpperCase())
    if (aRank >= 0 && bRank >= 0) return aRank - bRank
    if (aRank >= 0) return -1
    if (bRank >= 0) return 1
    return (a.size ?? a.label).localeCompare(b.size ?? b.label, 'tr')
  })
}

/** Return standardized numeric choices only after real rows exist for each
 * size. Never creates an ID or a stock count. */
export function numericDressVariantOptions(actual: DressVariantOption[]): DressVariantOption[] | null {
  // Do not switch a product over while the migration is partial: that could
  // hide sellable legacy inventory. Use this view only when every numeric size
  // has a real catalogue variant row (stock may legitimately be zero).
  if (!NUMERIC_DRESS_SIZES.every(size => actual.some(variant => variant.size === size))) return null
  return NUMERIC_DRESS_SIZES.map(size => actual.find(variant => variant.size === size) ?? { id: '', label: size, size, stock: 0 })
}
