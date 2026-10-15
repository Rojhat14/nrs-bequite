'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const MIN_CLICK_INTERVAL_MS = 5_000
const UNCERTAIN_COPY = 'Ödeme sonucu henüz netleşmedi. Lütfen daha sonra tekrar kontrol edin.'

export default function GarantiReconcileAction({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const [message, setMessage] = useState('')
  const lastClickAt = useRef(0)

  async function checkStatus() {
    const now = Date.now()
    if (loading || cooldown || now - lastClickAt.current < MIN_CLICK_INTERVAL_MS) return
    lastClickAt.current = now
    setCooldown(true)
    window.setTimeout(() => setCooldown(false), MIN_CLICK_INTERVAL_MS)
    setLoading(true)
    setMessage(UNCERTAIN_COPY)
    try {
      const response = await fetch('/api/account/payments/garanti/reconcile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }), cache: 'no-store',
      })
      const result = await response.json().catch(() => null)
      if (result?.state === 'unverified_closed' || result?.state === 'failed') {
        router.refresh()
      } else {
        setMessage(UNCERTAIN_COPY)
      }
    } catch {
      setMessage(UNCERTAIN_COPY)
    } finally { setLoading(false) }
  }

  return <div className="mt-4">
    <button type="button" onClick={checkStatus} disabled={loading || cooldown}
      className="inline-flex min-h-11 items-center justify-center rounded-sm border border-nrs-ink/20 px-4 text-sm text-nrs-ink hover:bg-nrs-panel disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      {loading ? 'Kontrol ediliyor…' : 'Tekrar kontrol et'}
    </button>
    {message && <p aria-live="polite" className="mt-2 text-sm text-current/70">{message}</p>}
  </div>
}
