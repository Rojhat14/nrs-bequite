import { createClient } from '@supabase/supabase-js'
import { createMetaProductFeed, MetaFeedError } from '@/lib/meta-product-feed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new MetaFeedError('Public Supabase configuration is missing.')
    // Dedicated anonymous client: no cookies, user session or admin credentials.
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    })
    const feed = await createMetaProductFeed(client)
    return new Response(feed.csv, { headers: {
      ...headers, 'Content-Type': 'text/csv; charset=utf-8',
      'X-Meta-Feed-Products': String(feed.included),
      'X-Meta-Feed-Skipped-Images': String(feed.skippedImages),
    } })
  } catch (error) {
    // Log only our controlled diagnostic; never serialize provider errors/keys.
    console.error('[Meta product feed]', error instanceof MetaFeedError ? error.message : 'Unexpected catalog read failure.')
    return Response.json({ error: 'Product feed could not be generated. Please try again later.' }, { status: 500, headers })
  }
}
