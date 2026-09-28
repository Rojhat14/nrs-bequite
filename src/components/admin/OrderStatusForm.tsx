'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrderStatus } from '@/app/admin/(protected)/actions'

const editableStatuses = [
  ['pending', 'Bekliyor'],
  ['payment_pending', 'Ödeme bekliyor'],
  ['processing', 'Hazırlanıyor'],
  ['shipped', 'Kargoya verildi'],
  ['delivered', 'Teslim edildi'],
  ['cancelled', 'İptal edildi'],
]

export default function OrderStatusForm({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState(status)

  async function submit(form: FormData) {
    setBusy(true)
    setMessage(null)
    const result = await updateOrderStatus(form)
    setBusy(false)
    setMessage(result.message)
    if (result.ok) router.refresh()
  }

  if (status === 'paid') return <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Ödeme doğrulandı.</strong> “paid” durumu yalnızca ödeme callback/provider akışı tarafından belirlenir. Operasyon durumu değiştirmek için ödeme durumunun ayrıca modellenmesi gerekir.</div>
  if (!['pending', 'payment_pending', 'processing', 'shipped'].includes(status)) return <div className="border border-[#E4DED2] bg-white p-4 text-sm text-[#777165]">Bu sipariş durumu burada değiştirilemez. Ödeme/teslimat geçmişi korunur.</div>

  const choices = status === 'pending' || status === 'payment_pending'
    ? editableStatuses.filter(([value]) => value === 'cancelled')
    : status === 'shipped'
      ? editableStatuses.filter(([value]) => ['delivered', 'cancelled'].includes(value))
      : status === 'processing'
        ? editableStatuses.filter(([value]) => ['shipped', 'delivered', 'cancelled'].includes(value))
        : editableStatuses.filter(([value]) => ['delivered', 'cancelled'].includes(value))

  return <form action={submit} className="border border-[#E4DED2] bg-white p-5">
    <input type="hidden" name="order_id" value={orderId} />
    <label htmlFor="order-status" className="mb-2 block text-[9px] uppercase tracking-widest text-[#777165]">Operasyon durumu</label>
    <div className="flex flex-col gap-3 sm:flex-row">
      <select id="order-status" name="status" value={selected} onChange={(event) => setSelected(event.target.value)} className="admin-field">
        {!editableStatuses.some(([value]) => value === status) && <option value={status}>{status.replaceAll('_', ' ')} (mevcut değer)</option>}
        {choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button disabled={busy || selected === status} className="admin-primary shrink-0">{busy ? 'Kaydediliyor…' : 'Durumu güncelle'}</button>
    </div>
    {message && <p role="status" className="mt-3 text-sm text-[#5D4929]">{message}</p>}
    <p className="mt-3 text-[10px] leading-5 text-[#8A8479]">Mevcut tabloda ödeme ve operasyon durumu aynı kolonda tutuluyor. Bu yüzden ödenmemiş sipariş yalnızca iptal edilebilir; “paid” veya ödeme kimliği panelden değiştirilemez.</p>
  </form>
}
