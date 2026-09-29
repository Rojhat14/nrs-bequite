'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { archiveProduct, saveProduct } from '@/app/admin/(protected)/actions'
import type { CategoryRow, CollectionRow, ProductRow, ProductVariantRow } from '@/lib/admin/types'
import { DEFAULT_ADMIN_SETTINGS } from '@/lib/admin/config'
import ProductImageManager from '@/components/admin/ProductImageManager'
import ProductVariantManager from '@/components/admin/ProductVariantManager'

const EMPTY_COLLECTIONS: CollectionRow[] = []
const EMPTY_COLLECTION_IDS: string[] = []

export default function AdminProductForm({ product, categories, collections = EMPTY_COLLECTIONS, selectedCollectionIds = EMPTY_COLLECTION_IDS, variants = [] }: { product?: ProductRow; categories: CategoryRow[]; collections?: CollectionRow[]; selectedCollectionIds?: string[]; variants?: ProductVariantRow[] }) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null)
  const [slug, setSlug] = useState(product?.slug ?? '')
  const [selectedCollections, setSelectedCollections] = useState<string[]>(selectedCollectionIds)

  useEffect(() => {
    setSelectedCollections(selectedCollectionIds)
  }, [product?.id, selectedCollectionIds])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setNotice(null)
    const result = await saveProduct(new FormData(event.currentTarget))
    setNotice({ ok: result.ok, message: result.message })
    setIsSaving(false)
    if (result.ok && result.id) {
      setDirty(false)
      if (!product) router.replace(`/admin/products/${encodeURIComponent(result.id)}`)
      router.refresh()
    }
  }

  async function archive() {
    if (!product || !window.confirm('Bu ürün arşivlensin mi? Ürün ve sipariş geçmişi silinmez.')) return
    const form = new FormData()
    form.set('id', product.id)
    setIsSaving(true)
    const result = await archiveProduct(form)
    setNotice({ ok: result.ok, message: result.message })
    setIsSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} onChange={() => { setDirty(true); setNotice(null) }} className="space-y-6">
        <input type="hidden" name="id" value={product?.id ?? slug} />
        <section className="grid gap-5 border border-[#E4DED2] bg-white p-5 sm:grid-cols-2 sm:p-7">
          <h2 className="font-serif text-xl sm:col-span-2">Temel bilgiler</h2>
          <Field label="Ürün adı" name="name" defaultValue={product?.name} required maxLength={180} />
          <Field label="Slug" name="slug" value={slug} onChange={(event) => { setSlug(event.target.value); setDirty(true) }} required pattern="[a-z0-9]+(-[a-z0-9]+)*" hint="Küçük harf, rakam ve tire kullanın." />
          {!product && <Field label="Ürün ID" name="new_id" value={slug} onChange={(event) => { setSlug(event.target.value); setDirty(true) }} required pattern="[a-z0-9]+(-[a-z0-9]+)*" hint="Mevcut ürün ID’leri değiştirilmeyecek." />}
          {product && <div className="space-y-2"><span className="block text-[10px] uppercase tracking-[0.16em] text-[#777165]">Ürün ID (sabit)</span><p className="border border-[#E4DED2] bg-[#FAF9F6] px-3 py-3 text-sm">{product.id}</p></div>}
          <div className="space-y-2">
            <label htmlFor="category_id" className="block text-[10px] uppercase tracking-[0.16em] text-[#777165]">Kategori</label>
            <select id="category_id" name="category_id" defaultValue={product?.category_id ?? ''} className="admin-field" onChange={() => setDirty(true)}>
              <option value="">Kategori seçin</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.slug}</option>)}
            </select>
          </div>
          <fieldset className="space-y-3 border border-[#E4DED2] bg-[#FAF9F6] p-4 sm:col-span-2 sm:p-5">
            <legend className="px-1 font-serif text-lg">Koleksiyonlar</legend>
            <p className="text-xs text-[#777165]">Ürün birden fazla koleksiyonda yer alabilir.</p>
            {collections.length > 0 ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection) => <label key={collection.id} className="flex cursor-pointer items-center gap-3 border border-[#E4DED2] bg-white px-3 py-3 text-sm focus-within:ring-2 focus-within:ring-[#9B835B]">
                <input
                  type="checkbox"
                  name="collection_ids"
                  value={collection.id}
                  checked={selectedCollections.includes(collection.id)}
                  onChange={(event) => {
                    setDirty(true)
                    const isChecked = event.currentTarget.checked
                    setSelectedCollections((current) => isChecked
                      ? [...current, collection.id]
                      : current.filter((id) => id !== collection.id))
                  }}
                  className="size-4 accent-[#8A744F]"
                />
                <span>{collection.name}</span>
              </label>)}
            </div> : <p className="border border-dashed border-[#D8D0C3] bg-white/70 p-3 text-sm text-[#777165]">Aktif koleksiyon bulunmuyor.</p>}
          </fieldset>
          <div className="space-y-2"><label htmlFor="description" className="block text-[10px] uppercase tracking-[0.16em] text-[#777165]">Açıklama</label><textarea id="description" name="description" defaultValue={product?.description ?? ''} rows={5} className="admin-field resize-y" /></div>
          <Field label="Fiyat" name="price_amount" type="number" defaultValue={product?.price_amount ?? ''} min="0.01" step="0.01" required />
          <Field label="Karşılaştırma fiyatı" name="compare_at_price" type="number" defaultValue={product?.compare_at_price ?? ''} min="0" step="0.01" />
          <Field label="Para birimi" name="currency" defaultValue={product?.currency ?? DEFAULT_ADMIN_SETTINGS.currency} maxLength={3} required />
          <Field label="Kumaş" name="fabric" defaultValue={product?.fabric ?? ''} />
          <Field label="Bakım bilgisi" name="care" defaultValue={product?.care ?? ''} />
          <div className="space-y-2"><label htmlFor="status" className="block text-[10px] uppercase tracking-[0.16em] text-[#777165]">Durum</label><select id="status" name="status" defaultValue={product?.status ?? DEFAULT_ADMIN_SETTINGS.defaultProductStatus} className="admin-field"><option value="draft">Taslak</option><option value="active">Aktif</option><option value="archived">Arşivlendi</option></select></div>
          <div className="space-y-2"><label htmlFor="in_stock" className="block text-[10px] uppercase tracking-[0.16em] text-[#777165]">Eski storefront stok bayrağı</label><select id="in_stock" name="in_stock" defaultValue={String(product?.in_stock ?? false)} className="admin-field"><option value="false">Stokta yok</option><option value="true">Stokta</option></select><p className="text-[10px] text-[#9A9385]">Checkout davranışı değiştirilmez. Variant stokları ayrı yönetilir.</p></div>
          {notice && <p role={notice.ok ? 'status' : 'alert'} className={`text-sm sm:col-span-2 ${notice.ok ? 'text-emerald-800' : 'text-rose-800'}`}>{notice.message}</p>}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" disabled={isSaving} className="admin-primary">{isSaving ? 'Kaydediliyor…' : product ? 'Değişiklikleri kaydet' : 'Ürün oluştur'}</button>
            {product?.status !== 'archived' && product && <button type="button" disabled={isSaving} onClick={archive} className="admin-secondary text-rose-800">Ürünü arşivle</button>}
          </div>
        </section>
      </form>

      {product && <>
        <ProductImageManager productId={product.id} />
        <ProductVariantManager productId={product.id} initialVariants={variants} />
      </>}
      {!product && <p className="border border-dashed border-[#D8D0C3] bg-white/50 p-4 text-xs leading-5 text-[#777165]">Önce ürünü kaydedin. Ardından görsel yükleme ve beden/varyant stok yönetimi açılır.</p>}
      {dirty && <span className="sr-only" aria-live="polite">Kaydedilmemiş değişiklikler var.</span>}
    </div>
  )
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const { label, hint, ...inputProps } = props
  const id = inputProps.id ?? inputProps.name
  return <div className="space-y-2"><label htmlFor={id} className="block text-[10px] uppercase tracking-[0.16em] text-[#777165]">{label}</label><input {...inputProps} id={id} className="admin-field" />{hint && <p className="text-[10px] text-[#9A9385]">{hint}</p>}</div>
}
