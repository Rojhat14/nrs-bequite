import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const SITE_URL = 'https://nrsbequiteluminous.com'
const PAGE_SIZE = 500

export const revalidate = 3600

type SitemapRow = { slug: string; updated_at: string }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Sitemap requires public Supabase configuration.')
  }

  // No cookies or service-role key: only the anonymous public catalog is eligible.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  async function getRows(table: 'products' | 'categories' | 'collections') {
    const rows: SitemapRow[] = []
    // Paginate to avoid silently truncating the catalog at the API row limit.
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const query = supabase.from(table).select('slug,updated_at')
      const { data, error } = await (table === 'products'
        ? query.eq('status', 'active')
        : query.eq('is_active', true))
        .order('slug').range(offset, offset + PAGE_SIZE - 1)
      // Throw rather than cache a partial sitemap; ISR retains the last good result.
      if (error) throw new Error(`Sitemap could not load public ${table}.`)
      rows.push(...(data ?? []) as SitemapRow[])
      if (!data || data.length < PAGE_SIZE) return rows
    }
  }

  const [products, categories, collections] = await Promise.all([
    getRows('products'), getRows('categories'), getRows('collections'),
  ])
  const staticPaths = [
    '/', '/collections', '/curated', '/about', '/contact',
    '/shipping', '/returns', '/size-guide', '/care-guide', '/faq',
  ]
  const entries: MetadataRoute.Sitemap = staticPaths.map(path => ({ url: `${SITE_URL}${path}` }))

  for (const [prefix, rows] of [
    ['/category', categories], ['/product', products], ['/collections', collections],
  ] as const) {
    for (const row of rows) {
      if (!row.slug) continue
      const lastModified = new Date(row.updated_at)
      entries.push({
        url: `${SITE_URL}${prefix}/${encodeURIComponent(row.slug)}`,
        ...(!Number.isNaN(lastModified.getTime()) ? { lastModified } : {}),
      })
    }
  }

  // This public route also exists without a categories row (sale fallback).
  if (!categories.some(category => category.slug === 'sale' || category.slug === 'indirim')) {
    entries.push({ url: `${SITE_URL}/category/sale` })
  }
  return entries
}
