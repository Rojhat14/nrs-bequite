'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateInventory } from '@/app/admin/(protected)/actions'
import type { ProductRow, ProductVariantRow } from '@/lib/admin/types'
import { LOW_STOCK_THRESHOLD } from '@/lib/admin/config'

export default function InventoryTable({ variants, products }: { variants: ProductVariantRow[]; products: ProductRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const productMap = new Map(products.map((product) => [product.id, product]))

  async function save(form: FormData) {
    const id = String(form.get('id') ?? '')
    setBusyId(id)
    setNotice(null)
    const result = await updateInventory(form)
    setBusyId(null)
    setNotice(result.message)
    if (result.ok) router.refresh()
  }

  return <div>
    {notice && <p role="status" className="mb-4 border border-[#E4DED2] bg-white p-3 text-sm text-[#5D4929]">{notice}</p>}
    <div className="overflow-x-auto border border-[#E4DED2] bg-white">
      <table className="w-full min-w-[850px] border-collapse text-left">
        <thead className="bg-[#FAF9F6]"><tr className="border-b border-[#E4DED2] text-[9px] uppercase tracking-[0.14em] text-[#777165]"><th className="p-3">Ürün</th><th className="p-3">Beden</th><th className="p-3">SKU</th><th className="p-3">Mevcut stok</th><th className="p-3">Durum</th><th className="p-3">Kaydet</th></tr></thead>
        <tbody className="divide-y divide-[#F0ECE5]">
          {variants.map((variant) => {
            const product = productMap.get(variant.product_id)
            const stockState = variant.stock_quantity === 0 ? 'Tükendi' : variant.stock_quantity <= LOW_STOCK_THRESHOLD ? 'Düşük stok' : 'Stokta'
            return <tr key={variant.id}>
              <td className="p-3"><span className="block text-sm">{product?.name ?? 'Ürün'}</span><span className="font-mono text-[10px] text-[#9A9385]">{variant.product_id}</span></td>
              <td className="p-3 text-sm">{variant.size || 'Bedensiz'}</td><td className="p-3 font-mono text-xs">{variant.sku || '—'}</td>
              <td colSpan={3} className="p-0"><form action={save} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 p-2"><input type="hidden" name="id" value={variant.id} /><input type="hidden" name="product_id" value={variant.product_id} /><input name="stock_quantity" aria-label="Stok miktarı" type="number" min="0" step="1" defaultValue={variant.stock_quantity} className="admin-field" /><span className={`text-xs ${variant.stock_quantity === 0 ? 'text-rose-800' : variant.stock_quantity <= LOW_STOCK_THRESHOLD ? 'text-amber-800' : 'text-emerald-800'}`}>{stockState}</span><button disabled={busyId === variant.id} className="admin-secondary">{busyId === variant.id ? 'Kaydediliyor…' : 'Stoku güncelle'}</button></form></td>
            </tr>
          })}
          {variants.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-sm text-[#9A9385]">Stok göstermek için önce ürün düzenleme ekranından beden varyantı ekleyin.</td></tr>}
        </tbody>
      </table>
    </div>
    <p className="mt-3 text-xs leading-5 text-[#8A8479]">Bu ekran `product_variants` stoklarını günceller. Mevcut storefront checkout akışı ve `products.in_stock` alanı değiştirilmez.</p>
  </div>
}
