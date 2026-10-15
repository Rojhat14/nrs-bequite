'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useCart } from '@/store/useCart'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function CartPriceSync() {
  const items = useCart(state => state.items)
  const syncCatalogPrices = useCart(state => state.syncCatalogPrices)
  const setCatalogPricesSynced = useCart(state => state.setCatalogPricesSynced)
  const lastRequested = useRef<string | null>(null)
  const productIds = useMemo(() => Array.from(new Set(items.map(item => item.id))).sort(), [items])
  const signature = productIds.join('|')

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
        const supabase = createSupabaseBrowserClient()
        const { data, error } = await supabase.from('products')
          .select('id,price_amount,compare_at_price')
          .in('id', productIds)
          .eq('status', 'active')
          .eq('payment_test_only', false)
        if (error) throw error
        if (current) syncCatalogPrices((data ?? []).map(row => ({
          id: row.id,
          price: Number(row.price_amount),
          compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
        })))
      } catch {
        if (current) setCatalogPricesSynced(false)
      }
    })()

    return () => { current = false }
  }, [productIds, setCatalogPricesSynced, signature, syncCatalogPrices])

  return null
}
