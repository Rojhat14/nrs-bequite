import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sameOrigin } from '@/lib/payment/http'
import { categoryCoverObjectKey, isHomeCategory } from '@/lib/home-category'
import { PRODUCT_IMAGE_BUCKET } from '@/lib/storage/products'

export const runtime = 'nodejs'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function imageMime(bytes: Uint8Array) {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF'
    && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP') return 'image/webp'
  return null
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: 'İstek kaynağı doğrulanamadı.' }, { status: 403 })
  await requireAdmin()
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;') || !request.body) {
    return NextResponse.json({ message: 'Görsel dosyası seçin.' }, { status: 400 })
  }
  try {
    // Bound the stream too; Content-Length can be absent or forged.
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.length
        if (length > MAX_IMAGE_BYTES + 65536) {
          await reader.cancel()
          return NextResponse.json({ message: 'Görsel en fazla 5 MB olabilir.' }, { status: 413 })
        }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData()
    const id = String(form.get('category_id') ?? '').toLowerCase()
    const file = form.get('file')
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) || !(file instanceof File)) {
      return NextResponse.json({ message: 'Home kategorisi ve görsel dosyası seçin.' }, { status: 400 })
    }
    if (!file.size || file.size > MAX_IMAGE_BYTES) return NextResponse.json({ message: 'Görsel 1 bayt–5 MB arasında olmalıdır.' }, { status: 413 })
    const bytes = new Uint8Array(await file.arrayBuffer())
    const mime = imageMime(bytes)
    if (!mime || file.type !== mime) return NextResponse.json({ message: 'Yalnız JPEG, PNG veya WebP görselleri yüklenebilir.' }, { status: 415 })
    const supabase = await createSupabaseServerClient()
    const { data: category, error } = await supabase.from('categories').select('id,name,slug').eq('id', id).maybeSingle()
    if (error || !category || !isHomeCategory(category)) return NextResponse.json({ message: 'Home kategorisi bulunamadı.' }, { status: 404 })
    const key = categoryCoverObjectKey(id)
    const bucket = supabase.storage.from(PRODUCT_IMAGE_BUCKET)
    const { error: uploadError } = await bucket.upload(key, bytes, { contentType: mime, cacheControl: '60', upsert: true })
    if (uploadError) return NextResponse.json({ message: 'Görsel kaydedilemedi. Mevcut görsel depolama izinlerini kontrol edin.' }, { status: 400 })
    revalidatePath('/', 'layout')
    revalidatePath('/admin/categories')
    revalidateTag('storefront-category-covers')
    revalidateTag('storefront-catalog')
    const imageUrl = new URL(bucket.getPublicUrl(key).data.publicUrl)
    imageUrl.searchParams.set('v', String(Date.now()))
    return NextResponse.json({ message: 'Home görseli kaydedildi.', imageUrl: imageUrl.toString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ message: 'Görsel yüklenemedi. Dosyayı kontrol edip tekrar deneyin.' }, { status: 400 })
  }
}
