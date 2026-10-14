'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const orderId = '32ec756b-8fe2-4c9b-aae2-e34a49248ba9'

export default function GarantiReconcileAction() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function checkStatus() {
    if (loading) return
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/account/payments/garanti/reconcile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }), cache: 'no-store',
      })
      const result = await response.json().catch(() => null)
      if (result?.state === 'unverified_closed' || result?.state === 'failed') {
        setMessage('Ödeme durumu güncellendi.')
        router.refresh()
      } else {
        setMessage('Ödeme sonucunuz kontrol ediliyor. Yardım için bizimle iletişime geçebilirsiniz.')
      }
    } catch {
      setMessage('Ödeme sonucunuz kontrol ediliyor. Yardım için bizimle iletişime geçebilirsiniz.')
    } finally { setLoading(false) }
  }

  return <div className="mt-4">
    <button type="button" onClick={checkStatus} disabled={loading}
      className="inline-flex min-h-11 items-center justify-center rounded-sm border border-nrs-ink/20 px-4 text-sm text-nrs-ink hover:bg-nrs-panel disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      {loading ? 'Durum kontrol ediliyor…' : 'Ödeme durumunu kontrol et'}
    </button>
    {message && <p aria-live="polite" className="mt-2 text-sm text-current/70">{message}</p>}
  </div>
}
