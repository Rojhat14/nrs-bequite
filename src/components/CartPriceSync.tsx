'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useCart } from '@/store/useCart'
import { useLocale } from '@/context/LocaleContext'

export default function CartPriceSync() {
  const items = useCart(state => state.items)
  const syncCatalogPrices = useCart(state => state.syncCatalogPrices)
  const setCatalogPricesSynced = useCart(state => state.setCatalogPricesSynced)
  const { locale } = useLocale()
  const lastRequested = useRef<string | null>(null)
  const productIds = useMemo(() => Array.from(new Set(items.map(item => item.id))).sort(), [items])
  const signature = `${locale}:${productIds.join('|')}`

  useEffect(() => {
    if (signature === lastRequested.current) return
    lastRequested.current = signature
    setCatalogPricesSynced(false)
    if (!productIds.length) {
      syncCatalogPrices([])
      return
    }

    let current = true
    void (async () => {
      try {
        const response = await fetch('/api/storefront/cart-products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: productIds }), cache: 'no-store' })
        if (!response.ok) throw new Error('CART_CATALOG_UNAVAILABLE')
        const result = await response.json() as { products: Array<{ id: string; title: string; price: number; compareAtPrice: number | null }> }
        if (current) syncCatalogPrices(result.products)
      } catch {
        if (current) setCatalogPricesSynced(false)
      }
    })()

    return () => { current = false }
  }, [locale, productIds, setCatalogPricesSynced, signature, syncCatalogPrices])

  return null
}
