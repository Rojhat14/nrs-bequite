import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PRODUCT_IMAGE_BUCKET, productImageObjectKey } from '@/lib/storage/products'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  await requireAdmin()
  const productId = new URL(request.url).searchParams.get('product_id') ?? ''
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(productId)) return NextResponse.json({ message: 'Ürün ID’si geçersiz.' }, { status: 400 })
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('product_images').select('*').eq('product_id', productId).order('sort_order')
  if (error) return NextResponse.json({ message: 'Görseller yüklenemedi.' }, { status: 400 })
  return NextResponse.json({ images: data ?? [] })
}

function detectedMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}

export async function POST(request: Request) {
  await requireAdmin()
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && (!host || new URL(origin).host !== host)) {
    return NextResponse.json({ message: 'İstek kaynağı doğrulanamadı.' }, { status: 403 })
  }
  const supabase = await createSupabaseServerClient()
  const form = await request.formData()
  const file = form.get('file')
  const productId = String(form.get('product_id') ?? '')
  const variant = String(form.get('variant') ?? '')
  const altText = String(form.get('alt_text') ?? '').trim().slice(0, 240)
  const sortOrder = Number(form.get('sort_order') ?? 0)
  const isPrimary = form.get('is_primary') === 'true'

  if (!(file instanceof File)) return NextResponse.json({ message: 'Görsel dosyası seçilmedi.' }, { status: 400 })
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(productId) || !/^(main|front|back|detail|extra-[a-z0-9-]{1,48})$/.test(variant)) {
    return NextResponse.json({ message: 'Ürün veya görsel adı geçersiz.' }, { status: 400 })
  }
  if (file.size < 1 || file.size > 5 * 1024 * 1024) return NextResponse.json({ message: 'Görsel en fazla 5 MB olabilir.' }, { status: 413 })
  if (!Number.isInteger(sortOrder) || sortOrder < 0) return NextResponse.json({ message: 'Görsel sırası geçersiz.' }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = detectedMime(bytes)
  if (!mimeType || mimeType !== file.type || !['image/webp', 'image/jpeg', 'image/png'].includes(mimeType)) {
    return NextResponse.json({ message: 'Yalnızca geçerli WebP, JPEG veya PNG görselleri yüklenebilir.' }, { status: 415 })
  }
  const { data: product, error: productError } = await supabase.from('products').select('id').eq('id', productId).maybeSingle()
  if (productError || !product) return NextResponse.json({ message: 'Ürün bulunamadı veya veritabanı henüz hazır değil.' }, { status: 404 })

  const storageKey = productImageObjectKey(productId, variant, mimeType)
  const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(storageKey, bytes, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: true,
  })
  if (uploadError) return NextResponse.json({ message: 'Görsel yüklenemedi. Storage kurulumu veya yetkisini kontrol edin.' }, { status: 400 })

  const { data: existing, error: readError } = await supabase
    .from('product_images')
    .select('id')
    .eq('product_id', productId)
    .eq('provider', 'supabase')
    .eq('storage_key', storageKey)
    .maybeSingle()
  if (readError) return NextResponse.json({ message: 'Görsel kaydı okunamadı.' }, { status: 400 })

  if (isPrimary) {
    let clearQuery = supabase.from('product_images').update({ is_primary: false }).eq('product_id', productId).eq('is_primary', true)
    if (existing?.id) clearQuery = clearQuery.neq('id', existing.id)
    const { error } = await clearQuery
    if (error) return NextResponse.json({ message: 'Ana görsel güncellenemedi.' }, { status: 400 })
  }

  const publicUrl = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(storageKey).data.publicUrl
  const imagePayload = {
    product_id: productId,
    provider: 'supabase',
    storage_key: storageKey,
    url: publicUrl,
    alt_text: altText || null,
    sort_order: sortOrder,
    is_primary: isPrimary,
  }
  const saveResult = existing?.id
    ? await supabase.from('product_images').update(imagePayload).eq('id', existing.id)
    : await supabase.from('product_images').insert(imagePayload)
  if (saveResult.error) return NextResponse.json({ message: 'Görsel yüklendi ancak ürün kaydı oluşturulamadı. Tekrar deneyin.' }, { status: 400 })

  return NextResponse.json({ message: 'Görsel yüklendi.', storage_key: storageKey })
}
