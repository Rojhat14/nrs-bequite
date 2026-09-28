import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProductImageRow } from '@/lib/admin/types'

export const PRODUCT_IMAGE_BUCKET = 'product-images'

export function getProductImageUrl(supabase: SupabaseClient, image: ProductImageRow | null | undefined) {
  if (!image) return null
  if (image.provider === 'supabase' && image.storage_key) {
    return supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(image.storage_key).data.publicUrl
  }
  return image.url || null
}

export function productImageObjectKey(productId: string, variant: string, mimeType: string) {
  const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg'
  return `${productId}/${variant}.${extension}`
}
