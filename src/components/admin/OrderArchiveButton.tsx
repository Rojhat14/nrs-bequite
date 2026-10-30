'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { archiveUnpaidCancelledOrders, setOrderArchived } from '@/app/admin/(protected)/actions'

/** Hides an unpaid cancelled order from the working list (or restores it).
 * Orders are never deleted: legal and payment records must be kept. */
export function OrderArchiveButton({ orderId, archived, compact = false }: { orderId: string; archived: boolean; compact?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  async function run() {
    if (!archived && !window.confirm('Bu iptal edilmiş sipariş listeden kaldırılsın mı? Kayıt silinmez, Arşiv sekmesinden geri alınabilir.')) return
    setBusy(true)
    const form = new FormData()
    form.set('order_id', orderId)
    form.set('archived', String(!archived))
    const result = await setOrderArchived(form)
    setBusy(false)
    setMessage(result.ok ? null : result.message)
    if (result.ok) router.refresh()
  }
  return <span className="inline-flex flex-col gap-1">
    <button type="button" onClick={run} disabled={busy}
      className={compact ? 'text-xs text-rose-800 underline disabled:opacity-50' : archived ? 'admin-secondary' : 'admin-secondary text-rose-800'}>
      {busy ? '…' : archived ? 'Listeye geri al' : 'Listeden kaldır'}
    </button>
    {message && <span role="alert" className="text-[11px] text-rose-800">{message}</span>}
  </span>
}

export function ArchiveCancelledOrdersButton({ count }: { count: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  async function run() {
    if (!window.confirm(`${count} ödenmemiş iptal sipariş listeden kaldırılsın mı? Kayıtlar silinmez, Arşiv sekmesinden geri alınabilir.`)) return
    setBusy(true)
    const result = await archiveUnpaidCancelledOrders()
    setBusy(false)
    setMessage(result.message)
    if (result.ok) router.refresh()
  }
  return <span className="inline-flex flex-wrap items-center gap-3">
    <button type="button" onClick={run} disabled={busy || count === 0} className="admin-secondary text-rose-800 disabled:opacity-50">
      {busy ? 'Kaldırılıyor…' : `Ödenmemiş iptalleri listeden kaldır (${count})`}
    </button>
    {message && <span role="status" className="text-xs text-[#5D4929]">{message}</span>}
  </span>
}
