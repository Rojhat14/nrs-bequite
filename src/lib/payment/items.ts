import type { CheckoutItem } from './types'

// UUIDs are case-insensitive in PostgreSQL. Reject duplicate variants before
// sorting; separate measurement sets must never be merged into one order line.
export function canonicalCheckoutItems(items: CheckoutItem[]): CheckoutItem[] {
  const seen = new Set<string>()
  const canonical = items.map(item => {
    const variantId = item.variantId.toLowerCase()
    if (seen.has(variantId)) throw new Error('Aynı varyant birden fazla sipariş satırında bulunamaz.')
    seen.add(variantId)
    return { ...item, variantId }
  })
  // Fixed lexical UUID order, independent of host locale and cart insertion order.
  return canonical.sort((a, b) => a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0)
}
