// Keep arbitrary legacy image URLs working; optimize only public, allowed sources.
export function canOptimizeImage(src: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (src.startsWith('/') && !src.startsWith('//')) return true
  try {
    const url = new URL(src)
    if (url.protocol !== 'https:' || url.port) return false
    if (url.hostname === 'images.unsplash.com') return true
    return Boolean(supabaseUrl
      && url.hostname === new URL(supabaseUrl).hostname
      && url.pathname.startsWith('/storage/v1/object/public/'))
  } catch {
    return false
  }
}
