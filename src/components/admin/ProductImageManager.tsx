'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { ProductImageRow } from '@/lib/admin/types'
import { deleteProductImage, setImagePrimary, updateImageMetadata } from '@/app/admin/(protected)/actions'
import { getProductImageUrl } from '@/lib/storage/products'

export default function ProductImageManager({ productId }: { productId: string }) {
  const router = useRouter()
  const [images, setImages] = useState<ProductImageRow[]>([])
  const [variant, setVariant] = useState('main')
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const refreshImages = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/products/images?product_id=${encodeURIComponent(productId)}`)
      if (!response.ok) return
      const payload = await response.json() as { images?: ProductImageRow[] }
      setImages(payload.images ?? [])
    } catch {
      setMessage({ ok: false, text: 'Görsel kayıtları yüklenemedi.' })
    }
  }, [productId])

  useEffect(() => { void refreshImages() }, [refreshImages])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!files.length) return
    setBusy(true)
    setProgress(0)
    setMessage(null)
    let uploaded = 0
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const normalized = await normalizeImage(file)
        const fileVariant = index === 0 ? variant : `extra-${crypto.randomUUID().slice(0, 12)}`
        const form = new FormData()
        form.set('product_id', productId)
        form.set('variant', fileVariant)
        form.set('file', normalized)
        form.set('alt_text', productId)
        form.set('sort_order', String(images.length + index))
        form.set('is_primary', String(fileVariant === 'main' || (images.length === 0 && index === 0)))
        await uploadWithProgress(form, (percent) => setProgress(Math.round(((index + percent / 100) / files.length) * 100)))
        uploaded += 1
      }
      setFiles([])
      setMessage({ ok: true, text: `${uploaded} görsel yüklendi.` })
      router.refresh()
      await refreshImages()
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Görsel yüklenemedi.' })
    } finally {
      setBusy(false)
    }
  }

  async function runAction(action: (form: FormData) => Promise<{ ok: boolean; message: string }>, form: FormData) {
    setBusy(true)
    setMessage(null)
    const result = await action(form)
    setMessage({ ok: result.ok, text: result.message })
    if (result.ok) {
      await refreshImages()
      router.refresh()
    }
    setBusy(false)
  }

  function formFor(image: ProductImageRow) {
    const form = new FormData()
    form.set('id', image.id)
    form.set('product_id', productId)
    return form
  }

  return (
    <section className="border border-[#E4DED2] bg-white p-5 sm:p-7">
      <div className="mb-5"><p className="text-[9px] uppercase tracking-[0.25em] text-[#9A8358]">Media library</p><h2 className="mt-1 font-serif text-xl">Ürün görselleri</h2><p className="mt-1 text-xs text-[#8A8479]">WebP, JPEG veya PNG · en fazla 5 MB. JPEG/PNG mümkünse tarayıcıda WebP’ye dönüştürülür.</p></div>
      <form onSubmit={upload} className="grid gap-3 border-b border-[#EEE9DF] pb-5 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <div className="space-y-2"><label htmlFor="image-variant" className="block text-[10px] uppercase tracking-[0.14em] text-[#777165]">Görsel alanı</label><select id="image-variant" value={variant} onChange={(event) => setVariant(event.target.value)} className="admin-field"><option value="main">Ana</option><option value="front">Ön</option><option value="back">Arka</option><option value="detail">Detay</option></select></div>
        <div className="space-y-2"><label htmlFor="product-images" className="block text-[10px] uppercase tracking-[0.14em] text-[#777165]">Dosyalar</label><input id="product-images" type="file" accept="image/webp,image/jpeg,image/png" multiple disabled={busy} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="block w-full text-xs file:mr-3 file:border file:border-[#D8D0C3] file:bg-white file:px-3 file:py-2 file:text-xs" /></div>
        <button type="submit" disabled={busy || files.length === 0} className="admin-primary">{busy ? `Yükleniyor %${progress}` : 'Yükle'}</button>
        {busy && <progress value={progress} max="100" aria-label="Görsel yükleme ilerlemesi" className="h-1 w-full sm:col-span-3" />}
      </form>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-4 text-sm ${message.ok ? 'text-emerald-800' : 'text-rose-800'}`}>{message.text}</p>}
      {images.length === 0 ? <p className="py-8 text-center text-sm text-[#9A9385]">Henüz veritabanında görsel yok.</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((image) => {
          const url = getProductImageUrl(supabase, image)
          return <article key={image.id} className="border border-[#EEE9DF] p-3">
            {url ? <Image src={url} alt={image.alt_text ?? ''} width={800} height={600} unoptimized className="aspect-[4/3] w-full bg-[#F5F3EE] object-cover" /> : <div className="aspect-[4/3] bg-[#F5F3EE]" />}
            <form action={(form) => runAction(updateImageMetadata, form)} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={image.id} /><input type="hidden" name="product_id" value={productId} />
              <label className="block text-[9px] uppercase tracking-widest text-[#777165]">Alt metin</label><input name="alt_text" defaultValue={image.alt_text ?? ''} className="admin-field" />
              <label className="block text-[9px] uppercase tracking-widest text-[#777165]">Sıra</label><input name="sort_order" type="number" min="0" defaultValue={image.sort_order} className="admin-field" />
              <button disabled={busy} className="text-xs text-[#6B5734] underline underline-offset-4">Alt metin ve sırayı kaydet</button>
            </form>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEE9DF] pt-3">
              <span className="text-[10px] uppercase text-[#777165]">{image.provider}{image.is_primary ? ' · Ana görsel' : ''}</span>
              {!image.is_primary && <button type="button" disabled={busy} onClick={() => runAction(setImagePrimary, formFor(image))} className="text-xs text-[#6B5734] underline">Ana yap</button>}
              <button type="button" disabled={busy} onClick={() => { if (window.confirm('Bu görsel silinsin mi?')) runAction(deleteProductImage, formFor(image)) }} className="text-xs text-rose-800 underline">Sil</button>
            </div>
          </article>
        })}
      </div>}
    </section>
  )
}

async function normalizeImage(file: File): Promise<File> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Görsel 5 MB sınırını aşamaz.')
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error('Yalnızca WebP, JPEG veya PNG seçin.')
  if (file.type === 'image/webp') return file
  const image = await createImageBitmap(file)
  const scale = Math.min(1, 2400 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Görsel dönüştürücü başlatılamadı.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('WebP dönüştürme başarısız oldu.')), 'image/webp', 0.86))
  return blob.type === 'image/webp' ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' }) : file
}

function uploadWithProgress(form: FormData, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/admin/products/images')
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)) }
    request.onload = () => {
      let result: { message?: string }
      try { result = JSON.parse(request.responseText) as { message?: string } } catch { reject(new Error('Sunucu yanıtı okunamadı.')); return }
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error(result.message ?? 'Görsel yüklenemedi.'))
    }
    request.onerror = () => reject(new Error('Ağ bağlantısı kurulamadı.'))
    request.send(form)
  })
}
