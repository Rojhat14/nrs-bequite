'use client'

import { useEffect } from 'react'
import { trackPurchase } from '@/lib/meta-events'

type PurchaseLine = { productId: string; quantity: number; unitPrice: number }

/** Reports a bank-verified paid order to Meta once per browser. MetaPixel
 * loads on this page only after advertising consent; without it window.fbq
 * never appears and nothing is sent. */
export default function MetaPurchase({ orderId, items, total }: { orderId: string; items: PurchaseLine[]; total: number }) {
  useEffect(() => {
    const key = `nrs-meta-purchase-${orderId}`
    try { if (localStorage.getItem(key)) return } catch { /* storage may be blocked */ }
    let attempts = 0
    const timer = window.setInterval(() => {
      attempts += 1
      if (window.fbq) {
        window.clearInterval(timer)
        trackPurchase(orderId, items, total)
        try { localStorage.setItem(key, '1') } catch { /* storage may be blocked */ }
      } else if (attempts >= 40) window.clearInterval(timer)
    }, 250)
    return () => window.clearInterval(timer)
  }, [orderId, items, total])
  return null
}
