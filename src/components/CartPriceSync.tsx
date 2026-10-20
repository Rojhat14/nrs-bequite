'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useCart } from '@/store/useCart'
import { useLocale } from '@/context/LocaleContext'
import { useAuth } from '@/context/AuthContext'
import { cartCatalogSyncScope } from '@/lib/cart-catalog-sync'

export default function CartPriceSync() {
  const items = useCart(state => state.items)
  const syncCatalogPrices = useCart(state => state.syncCatalogPrices)
  const setCatalogPricesSynced = useCart(state => state.setCatalogPricesSynced)
  const { locale } = useLocale()
  const { user, loading: authLoading } = useAuth()
  const lastRequested = useRef<string | null>(null)
  const productIds = useMemo(() => Array.from(new Set(items.map(item => item.id))).sort(), [items])
  const signature = cartCatalogSyncScope(locale, user?.id ?? null, productIds)

  useEffect(() => {
    if (authLoading) return
    if (signature === lastRequested.current) return
    lastRequested.current = signature
    setCatalogPricesSynced(false, signature)
    if (!productIds.length) {
      syncCatalogPrices([], [], signature)
      return
    }

    let current = true
    void (async () => {
      try {
        const response = await fetch('/api/storefront/cart-products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: productIds }), cache: 'no-store' })
        if (!response.ok) throw new Error('CART_CATALOG_UNAVAILABLE')
        const result = await response.json() as {
          products: Array<{ id: string; title: string; price: number; compareAtPrice: number | null }>
          variants?: Array<{ id: string; productId: string; size: string | null }>
        }
        if (current) syncCatalogPrices(result.products, result.variants ?? [], signature)
      } catch {
        if (current) setCatalogPricesSynced(false, signature)
      }
    })()

    return () => { current = false }
  }, [authLoading, locale, productIds, setCatalogPricesSynced, signature, syncCatalogPrices])

  return null
}
