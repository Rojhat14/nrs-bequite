export function cartCatalogSyncScope(locale: string, userId: string | null, productIds: string[]) {
  return `${locale}:${userId ?? 'guest'}:${Array.from(new Set(productIds)).sort().join('|')}`
}
