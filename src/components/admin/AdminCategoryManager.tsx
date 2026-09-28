'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoryRow } from '@/lib/admin/types'
import { deleteCategory, saveCategory } from '@/app/admin/(protected)/actions'

const canonicalSlugs = ['dresses', 'tops', 'blazers', 'bottoms', 'suits', 'sale', 'bedding', 'accessories']

export default function AdminCategoryManager({ categories, productCounts }: { categories: CategoryRow[]; productCounts: Record<string, number> }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

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

  return <div>
    {message && <p role={message.ok ? 'status' : 'alert'} className={`mb-5 border bg-white p-3 text-sm ${message.ok ? 'border-emerald-200 text-emerald-800' : 'border-rose-200 text-rose-800'}`}>{message.text}</p>}
    <form action={save} className="mb-6 grid gap-3 border border-[#E4DED2] bg-white p-5 sm:grid-cols-2 xl:grid-cols-6">
      <h2 className="font-serif text-xl sm:col-span-2 xl:col-span-6">Yeni kategori</h2>
      <Field label="Kategori adı" name="name" required />
      <Field label="Slug" name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
      <Field label="Açıklama" name="description" />
      <Field label="Sıra" name="sort_order" type="number" defaultValue="0" required />
      <div className="space-y-2"><label className="block text-[9px] uppercase tracking-widest text-[#777165]">Durum</label><select name="is_active" defaultValue="true" className="admin-field"><option value="true">Aktif</option><option value="false">Pasif</option></select></div>
      <button disabled={busy} className="admin-primary self-end">Kategori oluştur</button>
    </form>
    <div className="overflow-x-auto border border-[#E4DED2] bg-white">
      <table className="w-full min-w-[950px] border-collapse text-left">
        <thead className="bg-[#FAF9F6]"><tr className="border-b border-[#E4DED2] text-[9px] uppercase tracking-[0.13em] text-[#777165]"><th className="p-3">Kategori</th><th className="p-3">Slug</th><th className="p-3">Açıklama</th><th className="p-3">Sıra</th><th className="p-3">Aktif</th><th className="p-3">Ürün</th><th className="p-3">İşlem</th></tr></thead>
        <tbody className="divide-y divide-[#F0ECE5]">
          {categories.map((category) => {
            const isCanonical = canonicalSlugs.includes(category.slug)
            return <tr key={category.id}><td colSpan={7} className="p-0"><form action={save} className="grid grid-cols-[1.1fr_1fr_1.5fr_0.5fr_0.7fr_0.45fr_1fr] items-center gap-2 p-2">
              <input type="hidden" name="id" value={category.id} />
              <input name="name" aria-label="Kategori adı" required defaultValue={category.name} className="admin-field" />
              <input name="slug" aria-label="Slug" required defaultValue={category.slug} readOnly={isCanonical} className={`admin-field ${isCanonical ? 'bg-[#FAF9F6] text-[#777165]' : ''}`} />
              <input name="description" aria-label="Açıklama" defaultValue={category.description ?? ''} className="admin-field" />
              <input name="sort_order" aria-label="Sıra" type="number" defaultValue={category.sort_order} className="admin-field" />
              <select name="is_active" aria-label="Aktif" defaultValue={String(category.is_active)} className="admin-field"><option value="true">Aktif</option><option value="false">Pasif</option></select>
              <div className="flex flex-col gap-1"><span className="text-xs">{productCounts[category.id] ?? 0} ürün</span><div className="flex gap-2"><button disabled={busy} className="text-xs text-[#6B5734] underline">Kaydet</button><button type="button" disabled={busy || isCanonical} onClick={() => remove(category)} className="text-xs text-rose-800 underline disabled:opacity-40">Sil</button></div></div>
            </form></td></tr>
          })}
          {categories.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-sm text-[#9A9385]">Henüz kategori yok.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props
  return <div className="space-y-2"><label htmlFor={input.name} className="block text-[9px] uppercase tracking-widest text-[#777165]">{label}</label><input {...input} id={input.name} className="admin-field" /></div>
}
