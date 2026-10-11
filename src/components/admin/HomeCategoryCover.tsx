'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { HOME_CATEGORY_IMAGE } from '@/lib/home-category'
import { canOptimizeImage } from '@/lib/imageOptimization'

export default function HomeCategoryCover({ categoryId, imageUrl }: { categoryId: string; imageUrl: string }) {
  const router = useRouter()
  const [image, setImage] = useState(imageUrl)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { setImage(imageUrl) }, [imageUrl])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const data = new FormData(form)
    const file = data.get('file')
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) {
      setMessage({ ok: false, text: 'En fazla 5 MB boyutunda bir görsel seçin.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/categories/cover', { method: 'POST', body: data })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Görsel yüklenemedi.')
      setImage(result.imageUrl)
      setMessage({ ok: true, text: result.message })
      form.reset()
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Görsel yüklenemedi.' })
    } finally { setBusy(false) }
  }

  return <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
    <Image src={image} alt="Home kategori görseli" width={160} height={160}
      className="h-40 w-40 rounded-sm object-cover" unoptimized={!canOptimizeImage(image)}
      onError={() => { if (image !== HOME_CATEGORY_IMAGE) setImage(HOME_CATEGORY_IMAGE) }} />
    <form onSubmit={upload} className="space-y-3">
      <input type="hidden" name="category_id" value={categoryId} />
      <label htmlFor="home-category-cover" className="block text-sm">Kategori fotoğrafını değiştir</label>
      <input id="home-category-cover" name="file" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} className="admin-field" />
      <p className="text-xs text-[#777165]">JPEG, PNG veya WebP · en fazla 5 MB. Fotoğraf Home sayfasında ve kategori menüsünde görünür.</p>
      <button disabled={busy} className="admin-primary">{busy ? 'Yükleniyor…' : 'Fotoğrafı kaydet'}</button>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-emerald-800' : 'text-rose-800'}`}>{message.text}</p>}
    </form>
  </div>
}
