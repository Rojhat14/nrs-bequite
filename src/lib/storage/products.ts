import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProductImageRow } from '@/lib/admin/types'

export const PRODUCT_IMAGE_BUCKET = 'product-images'

export function getProductImageUrl(supabase: SupabaseClient, image: ProductImageRow | null | undefined) {
  if (!image) return null
  if (image.provider === 'supabase' && image.storage_key) {
    const publicUrl = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(image.storage_key).data.publicUrl
    // Uploads store a versioned copy of the same URL so a replaced image gets
    // a new address (and a fresh optimized/CDN copy). Older rows have none.
    return image.url?.startsWith(`${publicUrl}?v=`) ? image.url : publicUrl
  }
  return image.url || null
}

export function productImageObjectKey(productId: string, variant: string, mimeType: string) {
  const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg'
  return `${productId}/${variant}.${extension}`
}

export function versionedProductImageUrl(publicUrl: string, version = Date.now()) {
  return `${publicUrl}?v=${version}`
}
