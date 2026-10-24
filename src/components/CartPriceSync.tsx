'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useCart } from '@/store/useCart'
import { useLocale } from '@/context/LocaleContext'
import { useAuth } from '@/context/AuthContext'
import { cartCatalogSyncScope } from '@/lib/cart-catalog-sync'

const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 10_000

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
    let finished = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    // A single failed or hung request used to leave checkout on "checking
    // prices" forever. Each attempt now times out, failures are retried, and
    // the final failure is surfaced so the customer can reload.
    const attempt = async (attemptNumber: number) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const response = await fetch('/api/storefront/cart-products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: productIds }), cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('CART_CATALOG_UNAVAILABLE')
        const result = await response.json() as {
          products: Array<{ id: string; title: string; price: number; compareAtPrice: number | null }>
          variants?: Array<{ id: string; productId: string; size: string | null }>
        }
        if (!current) return
        finished = true
        syncCatalogPrices(result.products, result.variants ?? [], signature)
      } catch {
        if (!current) return
        if (attemptNumber < MAX_ATTEMPTS) {
          retryTimer = setTimeout(() => { void attempt(attemptNumber + 1) }, 1000 * attemptNumber)
          return
        }
        finished = true
        setCatalogPricesSynced(false, signature, true)
      } finally {
        clearTimeout(timeout)
      }
    }
    void attempt(1)

    return () => {
      current = false
      if (retryTimer) clearTimeout(retryTimer)
      // If this run is cancelled before its result is applied (for example the
      // cart array is replaced while the request is in flight), the next run
      // must request again instead of skipping the unchanged signature.
      if (!finished) lastRequested.current = null
    }
  }, [authLoading, locale, productIds, setCatalogPricesSynced, signature, syncCatalogPrices])

  return null
}
