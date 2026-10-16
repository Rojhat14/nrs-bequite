'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoryRow, CollectionRow } from '@/lib/admin/types'
import { deleteCategory, saveCategory, saveCollectionTranslations } from '@/app/admin/(protected)/actions'
import Link from 'next/link'
import Image from 'next/image'
import { HOME_CATEGORY_IMAGE, isHomeCategory } from '@/lib/home-category'
import HomeCategoryCover from './HomeCategoryCover'

const canonicalSlugs = ['dresses', 'tops', 'blazers', 'bottoms', 'suits', 'sale', 'bedding', 'accessories']

export default function AdminCategoryManager({ categories, productCounts, homeCoverUrl = HOME_CATEGORY_IMAGE, homeOnly = false, collections = [] }: { categories: CategoryRow[]; productCounts: Record<string, number>; homeCoverUrl?: string; homeOnly?: boolean; collections?: CollectionRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const homeCategory = categories.find(isHomeCategory)

  async function save(form: FormData) {
    setBusy(true)
    setMessage(null)
    const result = await saveCategory(form)
    setMessage({ ok: result.ok, text: result.message })
    setBusy(false)
    if (result.ok) router.refresh()
  }

  async function remove(category: CategoryRow) {
    if (!window.confirm(`“${category.name}” kategorisi silinsin mi?`)) return
    const form = new FormData()
    form.set('id', category.id)
    setBusy(true)
    const result = await deleteCategory(form)
    setMessage({ ok: result.ok, text: result.message })
    setBusy(false)
    if (result.ok) router.refresh()
  }

  async function saveCollection(form: FormData) {
    setBusy(true); setMessage(null)
    const result = await saveCollectionTranslations(form)
    setMessage({ ok: result.ok, text: result.message })
    setBusy(false)
    if (result.ok) router.refresh()
  }

  return <div>
    {message && <p role={message.ok ? 'status' : 'alert'} className={`mb-5 border bg-white p-3 text-sm ${message.ok ? 'border-emerald-200 text-emerald-800' : 'border-rose-200 text-rose-800'}`}>{message.text}</p>}
    <section className="mb-6 space-y-5 border border-[#E4DED2] bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-serif text-2xl">NRS Home · Nevresim</h2><p className="mt-1 text-sm text-[#777165]">Home ürünlerini ve kategori fotoğrafını buradan yönetin.</p></div>
        {homeCategory && homeCategory.is_active && <Link href={`/admin/products/new?category_id=${encodeURIComponent(homeCategory.id)}`} className="admin-primary">Nevresim ürünü ekle</Link>}
      </div>
      {homeCategory ? <>
        {!homeCategory.is_active && <form action={save} className="space-y-3">
          <input type="hidden" name="id" value={homeCategory.id} />
          <input type="hidden" name="name" value={homeCategory.name} />
          <input type="hidden" name="slug" value={homeCategory.slug} />
          <input type="hidden" name="description" value={homeCategory.description ?? ''} />
          <input type="hidden" name="sort_order" value={homeCategory.sort_order} />
          <input type="hidden" name="is_active" value="true" />
          <p className="text-sm text-amber-900">Home kategorisi şu anda pasif.</p>
          <button disabled={busy} className="admin-primary">Home kategorisini aktifleştir</button>
        </form>}
        <HomeCategoryCover categoryId={homeCategory.id} imageUrl={homeCoverUrl} />
      </> : <div className="flex flex-wrap items-center gap-5">
        <Image src={HOME_CATEGORY_IMAGE} alt="Home nevresim koleksiyonu" width={160} height={160} className="h-40 w-40 rounded-sm object-cover" />
        <form action={save} className="space-y-3">
          <input type="hidden" name="name" value="Home" />
          <input type="hidden" name="slug" value="bedding" />
          <input type="hidden" name="description" value="NRS Home nevresim ve ev tekstili koleksiyonu." />
          <input type="hidden" name="sort_order" value="100" />
          <input type="hidden" name="is_active" value="true" />
          <p className="max-w-md text-sm text-[#777165]">Nevresim ürünlerini eklemek için önce Home kategorisini oluşturun.</p>
          <button disabled={busy} className="admin-primary">Home kategorisini oluştur</button>
        </form>
      </div>}
      <a href={HOME_CATEGORY_IMAGE} download className="inline-block text-xs text-[#6B5734] underline">Hazır nevresim fotoğrafını indir</a>
    </section>
    {!homeOnly && <><form action={save} className="mb-6 grid gap-3 border border-[#E4DED2] bg-white p-5 sm:grid-cols-2 xl:grid-cols-6">
      <h2 className="font-serif text-xl sm:col-span-2 xl:col-span-6">Yeni kategori</h2>
      <Field label="Kategori adı" name="name" required />
      <Field label="Slug" name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
      <Field label="Açıklama" name="description" />
      <Field label="Sıra" name="sort_order" type="number" defaultValue="0" required />
      <div className="space-y-2"><label className="block text-[9px] uppercase tracking-widest text-[#777165]">Durum</label><select name="is_active" defaultValue="true" className="admin-field"><option value="true">Aktif</option><option value="false">Pasif</option></select></div>
      <TranslationInputs />
      <button disabled={busy} className="admin-primary self-end">Kategori oluştur</button>
    </form>
    <div className="overflow-x-auto border border-[#E4DED2] bg-white">
      <table className="w-full min-w-[950px] border-collapse text-left">
        <thead className="bg-[#FAF9F6]"><tr className="border-b border-[#E4DED2] text-[9px] uppercase tracking-[0.13em] text-[#777165]"><th className="p-3">Kategori</th><th className="p-3">Slug</th><th className="p-3">Açıklama</th><th className="p-3">Sıra</th><th className="p-3">Aktif</th><th className="p-3">Ürün</th><th className="p-3">İşlem</th></tr></thead>
        <tbody className="divide-y divide-[#F0ECE5]">
          {categories.map((category) => {
            const isCanonical = canonicalSlugs.includes(category.slug)
            return <tr key={category.id}><td colSpan={7} className="p-0"><form action={save} className="grid grid-cols-1 items-center gap-2 p-2 md:grid-cols-2 xl:grid-cols-7">
              <input type="hidden" name="id" value={category.id} />
              <input name="name" aria-label="Kategori adı" required defaultValue={category.name} className="admin-field" />
              <input name="slug" aria-label="Slug" required defaultValue={category.slug} readOnly={isCanonical} className={`admin-field ${isCanonical ? 'bg-[#FAF9F6] text-[#777165]' : ''}`} />
              <input name="description" aria-label="Açıklama" defaultValue={category.description ?? ''} className="admin-field" />
              <input name="sort_order" aria-label="Sıra" type="number" defaultValue={category.sort_order} className="admin-field" />
              <select name="is_active" aria-label="Aktif" defaultValue={String(category.is_active)} className="admin-field"><option value="true">Aktif</option><option value="false">Pasif</option></select>
              <div className="flex flex-col gap-1"><span className="text-xs">{productCounts[category.id] ?? 0} ürün</span><div className="flex gap-2"><button disabled={busy} className="text-xs text-[#6B5734] underline">Kaydet</button><button type="button" disabled={busy || isCanonical} onClick={() => remove(category)} className="text-xs text-rose-800 underline disabled:opacity-40">Sil</button></div></div>
              <TranslationInputs translations={category.translations} />
            </form></td></tr>
          })}
          {categories.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-sm text-[#9A9385]">Henüz kategori yok.</td></tr>}
        </tbody>
      </table>
    </div></>}
    {!homeOnly && collections.length > 0 && <section className="mt-12 space-y-4">
      <div><h2 className="font-serif text-2xl">Koleksiyon çevirileri</h2><p className="mt-1 text-sm text-[#777165]">Çeviriler koleksiyon kimliğine bağlıdır. Türkçe kaynak değişirse eski çeviri güncelliğini kaybeder.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {collections.map(collection => <form key={collection.id} action={saveCollection} className="space-y-4 border border-[#E4DED2] bg-white p-4">
          <input type="hidden" name="id" value={collection.id} />
          <h3 className="font-medium">{collection.name}</h3>
          <TranslationInputs translations={collection.translations} compact />
          <button disabled={busy} className="admin-primary">Çevirileri kaydet</button>
        </form>)}
      </div>
    </section>}
  </div>
}

function TranslationInputs({ translations, compact = false }: { translations?: CategoryRow['translations'] | CollectionRow['translations']; compact?: boolean }) {
  return <fieldset className={`grid gap-3 border-t border-[#E4DED2] pt-3 sm:grid-cols-2 ${compact ? '' : 'sm:col-span-2 xl:col-span-7'}`}>
    {(['en', 'ar'] as const).map(locale => {
      const saved = translations?.[locale]
      const payload = saved?.payload ?? {}
      const status = !saved ? 'Missing' : saved.current ? 'Current' : 'Out of date'
      return <div key={locale} lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-2">
        <p className="text-xs font-medium">{locale === 'en' ? 'English' : 'العربية'} · {status}</p>
        <input name={`translation_${locale}_name`} aria-label={locale === 'en' ? 'Translated name' : 'الاسم المترجم'} defaultValue={String(payload.name ?? '')} placeholder={locale === 'en' ? 'Translated name' : 'الاسم المترجم'} className="admin-field" />
        <textarea name={`translation_${locale}_description`} aria-label={locale === 'en' ? 'Translated description' : 'الوصف المترجم'} defaultValue={String(payload.description ?? '')} placeholder={locale === 'en' ? 'Translated description' : 'الوصف المترجم'} rows={2} className="admin-field resize-y" />
        <label className="flex items-start gap-2 text-[11px] leading-4"><input type="checkbox" name={`translation_${locale}_reviewed`} value="true" className="mt-0.5 size-4 accent-[#8A744F]" /><span>{locale === 'en' ? 'Reviewed against the current Turkish source' : 'تمت مراجعتها مقابل المصدر التركي الحالي'}</span></label>
      </div>
    })}
  </fieldset>
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props
  return <div className="space-y-2"><label htmlFor={input.name} className="block text-[9px] uppercase tracking-widest text-[#777165]">{label}</label><input {...input} id={input.name} className="admin-field" /></div>
}
