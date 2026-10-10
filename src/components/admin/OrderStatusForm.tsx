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

export default function OrderStatusForm({ orderId, status, verifiedPayment = false, paymentState }: { orderId: string; status: string; verifiedPayment?: boolean; paymentState?: string }) {
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

  if (paymentState && !['paid', 'failed'].includes(paymentState)) return <p role="status" className="border border-[#E4DED2] bg-white p-4 text-sm text-[#777165]">Online ödeme sonucu henüz kesinleşmedi. Durum değişikliği ve iptal için sağlayıcı doğrulaması beklenmelidir; stok rezervasyonu korunur.</p>

  if (status === 'paid' && !verifiedPayment) return <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Sipariş durumu: paid.</strong> Doğrulanmış ödeme kaydına erişilemiyor. Ödeme sonucu doğrulanmadan operasyon durumu değiştirilemez.</div>
  if (!['pending', 'payment_pending', 'paid', 'processing', 'shipped'].includes(status)) return <div className="border border-[#E4DED2] bg-white p-4 text-sm text-[#777165]">Bu sipariş durumu burada değiştirilemez. Ödeme/teslimat geçmişi korunur.</div>

  const choices = status === 'paid'
    ? editableStatuses.filter(([value]) => value === 'processing')
    : status === 'pending' || status === 'payment_pending'
    ? editableStatuses.filter(([value]) => value === 'cancelled')
    : status === 'shipped'
      ? editableStatuses.filter(([value]) => (verifiedPayment ? ['delivered'] : ['delivered', 'cancelled']).includes(value))
      : status === 'processing'
        ? editableStatuses.filter(([value]) => (verifiedPayment ? ['shipped', 'delivered'] : ['shipped', 'delivered', 'cancelled']).includes(value))
        : editableStatuses.filter(([value]) => (verifiedPayment ? ['delivered'] : ['delivered', 'cancelled']).includes(value))

  return <form action={submit} className="border border-[#E4DED2] bg-white p-5">
    <input type="hidden" name="order_id" value={orderId} />
    <label htmlFor="order-status" className="mb-2 block text-[9px] uppercase tracking-widest text-[#777165]">Operasyon durumu</label>
    <div className="flex flex-col gap-3 sm:flex-row">
      <select id="order-status" name="status" value={selected} onChange={(event) => setSelected(event.target.value)} className="admin-field">
        <option value={status} disabled>{editableStatuses.find(([value]) => value === status)?.[1] || status.replaceAll('_', ' ')} (mevcut değer)</option>
        {choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button disabled={busy || selected === status} className="admin-primary shrink-0">{busy ? 'Kaydediliyor…' : 'Durumu güncelle'}</button>
    </div>
    {message && <p role="status" className="mt-3 text-sm text-[#5D4929]">{message}</p>}
    <p className="mt-3 text-[10px] leading-5 text-[#8A8479]">Ödenmemiş sipariş yalnızca iptal edilebilir. Doğrulanmış ödeme kaydı korunarak sipariş hazırlığa ve teslimata alınabilir; “paid” veya ödeme kimliği panelden oluşturulamaz. Kart iadesi ayrı banka işlemi gerektirir.</p>
  </form>
}
