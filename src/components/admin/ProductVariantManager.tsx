'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductVariantRow } from '@/lib/admin/types'
import { deleteVariant, saveVariant } from '@/app/admin/(protected)/actions'

export default function ProductVariantManager({ productId, initialVariants }: { productId: string; initialVariants: ProductVariantRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(form: FormData) {
    setBusy(true)
    setMessage(null)
    const result = await saveVariant(form)
    setMessage({ ok: result.ok, text: result.message })
    setBusy(false)
    if (result.ok) router.refresh()
  }

  async function remove(variant: ProductVariantRow) {
    if (!window.confirm(`“${variant.size || 'Beden yok'}” varyantı silinsin mi?`)) return
    const form = new FormData()
    form.set('id', variant.id)
    form.set('product_id', productId)
    setBusy(true)
    const result = await deleteVariant(form)
    setMessage({ ok: result.ok, text: result.message })
    setBusy(false)
    if (result.ok) router.refresh()
  }

  return (
    <section className="border border-[#E4DED2] bg-white p-5 sm:p-7">
      <div className="mb-5"><p className="text-[9px] uppercase tracking-[0.25em] text-[#9A8358]">Inventory</p><h2 className="mt-1 font-serif text-xl">Beden ve varyant stoku</h2><p className="mt-1 text-xs text-[#8A8479]">Stok miktarı yalnızca varyantlarda tutulur. Buradaki stok storefront checkout akışını değiştirmez.</p></div>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`mb-4 text-sm ${message.ok ? 'text-emerald-800' : 'text-rose-800'}`}>{message.text}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <thead><tr className="border-b border-[#EEE9DF] text-[9px] uppercase tracking-[0.14em] text-[#777165]"><th className="p-3">Beden</th><th className="p-3">SKU</th><th className="p-3">Stok</th><th className="p-3">Durum</th><th className="p-3">İşlem</th></tr></thead>
          <tbody className="divide-y divide-[#F0ECE5]">
            {initialVariants.map((variant) => <tr key={variant.id}>
              <td colSpan={5} className="p-0"><form action={submit} className="grid grid-cols-[1fr_1.3fr_0.7fr_0.8fr_1fr] items-center gap-2 p-2">
                <input type="hidden" name="id" value={variant.id} /><input type="hidden" name="product_id" value={productId} />
                <input name="size" aria-label="Beden" defaultValue={variant.size ?? ''} placeholder="NULL / beden yok" className="admin-field" />
                <input name="sku" aria-label="SKU" defaultValue={variant.sku ?? ''} placeholder="SKU" className="admin-field" />
                <input name="stock_quantity" aria-label="Stok miktarı" type="number" min="0" step="1" required defaultValue={variant.stock_quantity} className="admin-field" />
                <select name="is_active" aria-label="Aktif" defaultValue={String(variant.is_active)} className="admin-field"><option value="true">Aktif</option><option value="false">Pasif</option></select>
                <div className="flex gap-2"><button disabled={busy} className="text-xs text-[#6B5734] underline">Kaydet</button><button type="button" disabled={busy} onClick={() => remove(variant)} className="text-xs text-rose-800 underline">Sil</button></div>
              </form></td>
            </tr>)}
            {initialVariants.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-sm text-[#9A9385]">Henüz beden varyantı yok.</td></tr>}
          </tbody>
        </table>
      </div>
      <form action={submit} className="mt-5 grid gap-3 border-t border-[#EEE9DF] pt-5 sm:grid-cols-[1fr_1.3fr_0.7fr_0.8fr_auto] sm:items-end">
        <input type="hidden" name="product_id" value={productId} />
        <Field label="Yeni beden" name="size" placeholder="S, M, L…" />
        <Field label="SKU (isteğe bağlı)" name="sku" placeholder="NRS-ITEM-M" />
        <Field label="Stok" name="stock_quantity" type="number" min="0" step="1" defaultValue="0" required />
        <div><label htmlFor="new_variant_active" className="mb-2 block text-[9px] uppercase tracking-widest text-[#777165]">Durum</label><select id="new_variant_active" name="is_active" defaultValue="true" className="admin-field"><option value="true">Aktif</option><option value="false">Pasif</option></select></div>
        <button disabled={busy} className="admin-primary">Varyant ekle</button>
      </form>
    </section>
  )
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props
  return <div className="space-y-2"><label htmlFor={input.name} className="block text-[9px] uppercase tracking-widest text-[#777165]">{label}</label><input {...input} id={input.name} className="admin-field" /></div>
}
