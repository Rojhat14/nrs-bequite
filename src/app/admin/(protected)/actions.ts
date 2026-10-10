'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ActionResult, ProductStatus } from '@/lib/admin/types'

function text(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

function validSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function failure(message: string): ActionResult {
  return { ok: false, message }
}

function mapWriteError(error: { code?: string } | null, fallback: string) {
  if (error?.code === '23505') return 'Bu ID, slug, beden veya SKU zaten kullanılıyor.'
  if (error?.code === '23503') return 'Seçilen kategori veya bağlı kayıt bulunamadı.'
  if (error?.code === '23514') return 'Girilen değerlerden biri izin verilen aralıkta değil.'
  if (error?.code === 'PGRST205' || error?.code === '42P01') return 'Veritabanı kurulumu henüz tamamlanmamış.'
  return fallback
}

export async function saveProduct(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const collectionIds = Array.from(
    new Set(
      form
        .getAll('collection_ids')
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  )
  const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
  if (collectionIds.some((collectionId) => !uuidPattern.test(collectionId))) {
    return failure('Koleksiyon seçimi geçersiz.')
  }
  if (collectionIds.length > 0) {
    const { data: activeCollections, error: collectionsError } = await supabase
      .from('collections')
      .select('id')
      .in('id', collectionIds)
      .eq('is_active', true)
    if (collectionsError) return failure(mapWriteError(collectionsError, 'Seçilen koleksiyonlar doğrulanamadı.'))
    if ((activeCollections ?? []).length !== collectionIds.length) {
      return failure('Seçilen koleksiyonlardan biri artık aktif değil veya bulunamadı.')
    }
  }
  const id = text(form, 'id')
  const name = text(form, 'name')
  const slug = text(form, 'slug')
  const amount = Number(text(form, 'price_amount'))
  const compareRaw = text(form, 'compare_at_price')
  const compareAt = compareRaw ? Number(compareRaw) : null
  const status = text(form, 'status') as ProductStatus
  const currency = text(form, 'currency').toUpperCase()
  const categoryId = text(form, 'category_id')
  if (!name || name.length > 180) return failure('Ürün adı zorunlu ve 180 karakterden kısa olmalıdır.')
  if (!id || !validSlug(id)) return failure('Ürün ID’si küçük harf, rakam ve tire içermelidir.')
  if (!slug || !validSlug(slug)) return failure('Slug küçük harf, rakam ve tire içermelidir.')
  if (!Number.isFinite(amount) || amount <= 0) return failure('Fiyat sıfırdan büyük olmalıdır.')
  if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt < 0)) return failure('Karşılaştırma fiyatı geçerli bir sayı olmalıdır.')
  if (!['draft', 'active', 'archived'].includes(status)) return failure('Ürün durumu geçersiz.')
  if (!/^[A-Z]{3}$/.test(currency)) return failure('Para birimi üç harfli ISO kodu olmalıdır.')
  if (categoryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryId)) return failure('Kategori seçimi geçersiz.')

  const payload = {
    id,
    name,
    slug,
    category_id: categoryId || null,
    description: text(form, 'description') || null,
    price_amount: amount,
    currency,
    compare_at_price: compareAt,
    status,
    in_stock: text(form, 'in_stock') === 'true',
    fabric: text(form, 'fabric') || null,
    care: text(form, 'care') || null,
  }
  const { data: existing, error: lookupError } = await supabase.from('products').select('id').eq('id', id).maybeSingle()
  if (lookupError && lookupError.code !== 'PGRST116') return failure(mapWriteError(lookupError, 'Ürün kaydı okunamadı.'))
  if (existing) {
    const { error } = await supabase.from('products').update(payload).eq('id', id)
    if (error) return failure(mapWriteError(error, 'Ürün güncellenemedi.'))
  } else {
    const { error } = await supabase.from('products').insert(payload)
    if (error) return failure(mapWriteError(error, 'Ürün oluşturulamadı.'))
  }
  const { error: clearCollectionsError } = await supabase
    .from('product_collections')
    .delete()
    .eq('product_id', id)
  if (clearCollectionsError) {
    return failure(mapWriteError(clearCollectionsError, 'Ürün koleksiyonları güncellenemedi.'))
  }
  if (collectionIds.length > 0) {
    const { error: collectionInsertError } = await supabase
      .from('product_collections')
      .insert(
        collectionIds.map((collectionId) => ({
          product_id: id,
          collection_id: collectionId,
        }))
      )

    if (collectionInsertError) {
      return failure(mapWriteError(collectionInsertError, 'Ürün koleksiyonları kaydedilemedi.'))
    }
  }
  revalidatePath('/admin')
  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${encodeURIComponent(id)}`)
  return { ok: true, id, message: existing ? 'Ürün güncellendi.' : 'Ürün oluşturuldu.' }
}

export async function duplicateProduct(sourceProductId: string): Promise<ActionResult> {
  await requireAdmin()
  const sourceId = sourceProductId.trim()
  if (!sourceId || sourceId.length > 160) return failure('Ürün seçimi geçersiz.')

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('nrs_duplicate_product', {
    p_source_product_id: sourceId,
  })

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[DUPLICATE PRODUCT] RPC: ERROR', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
    }
    return failure(mapWriteError(error, 'Ürün kopyalanırken bir hata oluştu.'))
  }

  const duplicate = data as { id?: unknown; stages?: unknown } | null
  const id = typeof duplicate?.id === 'string' ? duplicate.id : ''
  if (!id) return failure('Ürün kopyalandı ancak yeni kayıt bilgisi alınamadı.')
  if (process.env.NODE_ENV === 'development' && Array.isArray(duplicate?.stages)) {
    for (const stage of duplicate.stages) {
      if (typeof stage === 'string') console.info(`[DUPLICATE PRODUCT] ${stage}: PASS`)
    }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${encodeURIComponent(sourceId)}`)
  revalidatePath(`/admin/products/${encodeURIComponent(id)}`)
  revalidatePath('/')
  revalidatePath('/collections')
  return { ok: true, id, message: 'Ürün başarıyla kopyalandı.' }
}

export async function archiveProduct(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = text(form, 'id')
  if (!id) return failure('Ürün ID’si eksik.')
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('products').update({ status: 'archived' }).eq('id', id)
  if (error) return failure(mapWriteError(error, 'Ürün arşivlenemedi.'))
  revalidatePath('/admin')
  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${encodeURIComponent(id)}`)
  return { ok: true, id, message: 'Ürün arşivlendi. Sipariş geçmişi korunmuştur.' }
}

export async function saveCategory(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const id = text(form, 'id')
  const name = text(form, 'name')
  const slug = text(form, 'slug')
  const order = Number(text(form, 'sort_order'))
  if (!name || name.length > 120) return failure('Kategori adı zorunludur.')
  if (!validSlug(slug)) return failure('Slug küçük harf, rakam ve tire içermelidir.')
  if (!Number.isInteger(order)) return failure('Sıralama tam sayı olmalıdır.')
  const canonicalSlugs = ['dresses', 'tops', 'blazers', 'bottoms', 'suits', 'sale', 'bedding', 'accessories']
  if (id) {
    const { data: current, error: readError } = await supabase.from('categories').select('slug').eq('id', id).maybeSingle()
    if (readError) return failure(mapWriteError(readError, 'Kategori okunamadı.'))
    if (current && canonicalSlugs.includes(current.slug) && current.slug !== slug) return failure('Mevcut storefront kategorilerinin canonical slug değeri değiştirilemez.')
  }
  const payload = { name, slug, description: text(form, 'description') || null, sort_order: order, is_active: text(form, 'is_active') === 'true' }
  const result = id
    ? await supabase.from('categories').update(payload).eq('id', id)
    : await supabase.from('categories').insert(payload)
  if (result.error) return failure(mapWriteError(result.error, id ? 'Kategori güncellenemedi.' : 'Kategori oluşturulamadı.'))
  revalidatePath('/admin/categories')
  revalidatePath('/admin/products')
  revalidatePath('/admin')
  return { ok: true, message: id ? 'Kategori güncellendi.' : 'Kategori oluşturuldu.' }
}

export async function deleteCategory(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = text(form, 'id')
  if (!id) return failure('Kategori ID’si eksik.')
  const supabase = await createSupabaseServerClient()
  const { data: category, error: categoryError } = await supabase.from('categories').select('slug').eq('id', id).maybeSingle()
  if (categoryError) return failure(mapWriteError(categoryError, 'Kategori okunamadı.'))
  if (category && ['dresses', 'tops', 'blazers', 'bottoms', 'suits', 'sale', 'bedding', 'accessories'].includes(category.slug)) {
    return failure('Storefront’un canonical kategorisi silinemez. İsterseniz pasif duruma alın.')
  }
  const { count, error: countError } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id)
  if (countError) return failure(mapWriteError(countError, 'Kategori ürünleri doğrulanamadı.'))
  if ((count ?? 0) > 0) return failure('Bu kategoriye bağlı ürün var. Önce ürünleri başka kategoriye taşıyın.')
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return failure(mapWriteError(error, 'Kategori silinemedi.'))
  revalidatePath('/admin/categories')
  revalidatePath('/admin/products')
  return { ok: true, message: 'Kategori silindi.' }
}

export async function saveVariant(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const id = text(form, 'id')
  const productId = text(form, 'product_id')
  const size = text(form, 'size')
  const sku = text(form, 'sku').toUpperCase()
  const stock = Number(text(form, 'stock_quantity'))
  if (!productId) return failure('Ürün ID’si eksik.')
  if (!Number.isInteger(stock) || stock < 0) return failure('Stok sıfır veya daha büyük bir tam sayı olmalıdır.')
  if (sku && !/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(sku)) return failure('SKU yalnızca harf, rakam, nokta, tire veya alt çizgi içerebilir.')
  const payload = { product_id: productId, size: size || null, sku: sku || null, stock_quantity: stock, is_active: text(form, 'is_active') === 'true' }
  const result = id
    ? await supabase.from('product_variants').update(payload).eq('id', id).eq('product_id', productId)
    : await supabase.from('product_variants').insert(payload)
  if (result.error) return failure(mapWriteError(result.error, 'Varyant kaydedilemedi. Beden ve SKU benzersiz olmalıdır.'))
  revalidatePath(`/admin/products/${encodeURIComponent(productId)}`)
  revalidatePath('/admin/inventory')
  revalidatePath('/admin')
  return { ok: true, message: id ? 'Varyant güncellendi.' : 'Varyant eklendi.' }
}

export async function deleteVariant(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const productId = text(form, 'product_id')
  const id = text(form, 'id')
  if (!id || !productId) return failure('Varyant bilgisi eksik.')
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('product_variants').delete().eq('id', id).eq('product_id', productId)
  if (error) return failure(mapWriteError(error, 'Varyant silinemedi.'))
  revalidatePath(`/admin/products/${encodeURIComponent(productId)}`)
  revalidatePath('/admin/inventory')
  return { ok: true, message: 'Varyant silindi.' }
}

export async function updateInventory(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = text(form, 'id')
  const productId = text(form, 'product_id')
  const stock = Number(text(form, 'stock_quantity'))
  if (!id || !productId || !Number.isInteger(stock) || stock < 0) return failure('Stok değeri geçersiz.')
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('product_variants').update({ stock_quantity: stock }).eq('id', id).eq('product_id', productId)
  if (error) return failure(mapWriteError(error, 'Stok güncellenemedi.'))
  revalidatePath('/admin/inventory')
  revalidatePath(`/admin/products/${encodeURIComponent(productId)}`)
  revalidatePath('/admin')
  return { ok: true, message: 'Stok güncellendi.' }
}

export async function updateOrderStatus(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const orderId = text(form, 'order_id')
  const status = text(form, 'status')
  const allowed: string[] = ['pending', 'payment_pending', 'processing', 'shipped', 'delivered', 'cancelled']
  if (!orderId || !allowed.includes(status)) return failure('Bu sipariş durumu panelden atanamaz. Ödeme onayı ödeme callback sürecine aittir.')
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('nrs_admin_update_order_status', { p_order_id: orderId, p_status: status })
  if (error) return failure(mapWriteError(error, 'Sipariş durumu güncellenemedi. Gerekli admin veritabanı migration’ını kontrol edin.'))
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${encodeURIComponent(orderId)}`)
  revalidatePath('/admin')
  return { ok: true, message: 'Sipariş durumu güncellendi.' }
}

export async function setImagePrimary(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = text(form, 'id')
  const productId = text(form, 'product_id')
  if (!id || !productId) return failure('Görsel bilgisi eksik.')
  const supabase = await createSupabaseServerClient()
  const { error: clearError } = await supabase.from('product_images').update({ is_primary: false }).eq('product_id', productId).eq('is_primary', true)
  if (clearError) return failure(mapWriteError(clearError, 'Ana görsel değiştirilemedi.'))
  const { error } = await supabase.from('product_images').update({ is_primary: true }).eq('id', id).eq('product_id', productId)
  if (error) return failure(mapWriteError(error, 'Ana görsel değiştirilemedi.'))
  revalidatePath(`/admin/products/${encodeURIComponent(productId)}`)
  revalidatePath('/admin/products')
  return { ok: true, message: 'Ana görsel güncellendi.' }
}

export async function updateImageOrder(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = text(form, 'id')
  const productId = text(form, 'product_id')
  const order = Number(text(form, 'sort_order'))
  if (!id || !productId || !Number.isInteger(order) || order < 0) return failure('Görsel sırası geçersiz.')
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('product_images').update({ sort_order: order }).eq('id', id).eq('product_id', productId)
  if (error) return failure(mapWriteError(error, 'Görsel sırası güncellenemedi.'))
  revalidatePath(`/admin/products/${encodeURIComponent(productId)}`)
  revalidatePath('/admin/products')
  return { ok: true, message: 'Görsel sırası güncellendi.' }
}

export async function updateImageMetadata(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = text(form, 'id')
  const productId = text(form, 'product_id')
  const altText = text(form, 'alt_text').slice(0, 240)
  const order = Number(text(form, 'sort_order'))
  if (!id || !productId || !Number.isInteger(order) || order < 0) return failure('Görsel bilgileri geçersiz.')
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('product_images').update({ alt_text: altText || null, sort_order: order }).eq('id', id).eq('product_id', productId)
  if (error) return failure(mapWriteError(error, 'Görsel bilgileri güncellenemedi.'))
  revalidatePath(`/admin/products/${encodeURIComponent(productId)}`)
  revalidatePath('/admin/products')
  return { ok: true, message: 'Görsel bilgileri kaydedildi.' }
}

export async function deleteProductImage(form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = text(form, 'id')
  const productId = text(form, 'product_id')
  if (!id || !productId) return failure('Görsel bilgisi eksik.')
  const supabase = await createSupabaseServerClient()
  const { data: image, error: readError } = await supabase.from('product_images').select('*').eq('id', id).eq('product_id', productId).maybeSingle()
  if (readError || !image) return failure('Görsel bulunamadı veya silme yetkisi yok.')
  const storageImage = image as unknown as { provider: string; storage_key: string | null }
  if (storageImage.provider === 'supabase' && storageImage.storage_key) {
    const { count, error: referenceError } = await supabase
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'supabase')
      .eq('storage_key', storageImage.storage_key)
      .neq('id', id)
    if (referenceError) return failure('Görsel kullanımı doğrulanamadı; kayıt güvenlik için korundu.')
    if ((count ?? 0) === 0) {
      const { error: storageError } = await supabase.storage.from('product-images').remove([storageImage.storage_key])
      if (storageError) return failure('Görsel dosyası silinemedi; veritabanı kaydı korundu.')
    }
  }
  const { error } = await supabase.from('product_images').delete().eq('id', id).eq('product_id', productId)
  if (error) return failure(mapWriteError(error, 'Görsel kaydı silinemedi.'))
  if (image.is_primary) {
    const { data: nextImage } = await supabase.from('product_images').select('id').eq('product_id', productId).order('sort_order').limit(1).maybeSingle()
    if (nextImage?.id) {
      const { error: promoteError } = await supabase.from('product_images').update({ is_primary: true }).eq('id', nextImage.id).eq('product_id', productId)
      if (promoteError) return failure('Görsel silindi ancak yeni ana görsel seçilemedi. Ürün düzenleme ekranından ana görsel belirleyin.')
    }
  }
  revalidatePath(`/admin/products/${encodeURIComponent(productId)}`)
  revalidatePath('/admin/products')
  revalidatePath('/admin')
  return { ok: true, message: 'Görsel silindi.' }
}


export async function confirmManualTransfer(form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin()
  if (form.get('confirmed') !== 'on' || process.env.ORDER_DATABASE_VERIFIED !== 'true') return { ok: false, message: 'Gerçek banka hesabında tutarı doğrulayın. Sipariş veritabanı hazır olmalıdır.' }
  const id = String(form.get('order_id') || '')
  const amount = Number(form.get('amount'))
  const reference = String(form.get('reference') || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isFinite(amount) || amount <= 0 || reference.length < 6 || reference.length > 200) return { ok: false, message: 'Sipariş, tutar ve banka işlem referansını kontrol edin.' }
  try {
    const { paymentDatabase } = await import('@/lib/payment/repository')
    const { error } = await paymentDatabase().rpc('nrs_confirm_manual_transfer', { p_order_id: id, p_actor: actor.id, p_amount: amount, p_reference: reference })
    if (error) return { ok: false, message: 'Havale onayı kaydedilemedi; siparişin güncel durumunu kontrol edin.' }
    revalidatePath(`/admin/orders/${id}`)
    return { ok: true, message: 'Yetkili tarafından doğrulanan havale kaydedildi; sipariş üretime alınabilir.' }
  } catch { return { ok: false, message: 'Havale onayı kaydedilemedi.' } }
}
