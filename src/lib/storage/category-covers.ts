import 'server-only'
import { cache } from 'react'
import { HOME_CATEGORY_IMAGE, categoryCoverObjectKey } from '@/lib/home-category'
import { PRODUCT_IMAGE_BUCKET } from './products'

// Covers use the existing public image bucket and its existing admin policy.
// A public HEAD discovers a cover without adding category columns or listing files.
export const getHomeCategoryCover = cache(async (id: string) => {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!origin || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return HOME_CATEGORY_IMAGE
  try {
    const url = new URL(`/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${categoryCoverObjectKey(id)}`, origin)
    const response = await fetch(url, {
      method: 'HEAD',
      next: { revalidate: 300, tags: ['storefront-category-covers'] },
      redirect: 'error',
      signal: AbortSignal.timeout(2000),
    })
    if (!response.ok || !/^image\/(jpeg|png|webp)(?:;|$)/i.test(response.headers.get('content-type') ?? '')) return HOME_CATEGORY_IMAGE
    // Changing the file changes this URL, avoiding the previous thumbnail cache.
    const version = response.headers.get('etag') || response.headers.get('last-modified')
    if (version) url.searchParams.set('v', version)
    return url.toString()
  } catch { return HOME_CATEGORY_IMAGE }
})
