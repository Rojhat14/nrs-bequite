'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmManualTransfer } from '@/app/admin/(protected)/actions'
export default function ManualTransferForm({ orderId, amount }: { orderId: string; amount: number }) {
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)
  const router = useRouter()
  return <form className="space-y-3 border p-5" action={async form => {
    setBusy(true)
    try { const result=await confirmManualTransfer(form);setMessage(result.message);if(result.ok)router.refresh() }
    finally {setBusy(false)}
  }}>
    <h3 className="font-serif text-xl">Gerçek havale / EFT teyidi</h3>
    <input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="amount" value={amount} />
    <label className="block text-sm">Banka işlem referansı<input name="reference" required minLength={6} maxLength={200} className="admin-field mt-2" /></label>
    <label className="flex gap-3 text-sm"><input name="confirmed" type="checkbox" required />İşletmenin banka hesabında bu siparişin tam tutarının geldiğini kontrol ettim.</label>
    <p className="text-xs">Müşteri dekontu veya WhatsApp mesajı tek başına ödeme kanıtı değildir. Bu işlem kart ödemesi veya banka API doğrulaması değildir. İade ayrıca gerçekleştirilmelidir.</p>
    <button disabled={busy} className="admin-primary">{busy ? 'Kaydediliyor…' : 'Doğrulanan havaleyi kaydet'}</button>
    {message && <p role="status">{message}</p>}
  </form>
}
