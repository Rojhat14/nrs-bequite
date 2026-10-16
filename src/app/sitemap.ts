import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { LEGAL_ROUTES } from '@/lib/legal/documents'
import { isGarantiTestSetup } from '@/lib/payment/garanti/test-setup'

const SITE_URL = 'https://nrsbequiteluminous.com'
const PAGE_SIZE = 500
const LOCALES = ['tr', 'en', 'ar'] as const

export const revalidate = 3600

type SitemapRow = { slug: string; updated_at: string }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // An unconfigured isolated Preview has no catalog to index. Production and
  // configured environments retain the existing catalog validation.
  if (isGarantiTestSetup()) return []
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
      const { data, error } = table === 'products'
        ? await supabase.from('products').select('slug,updated_at').eq('status', 'active')
          .eq('payment_test_only', false).order('slug').range(offset, offset + PAGE_SIZE - 1)
        : await supabase.from(table).select('slug,updated_at').eq('is_active', true)
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
    '/size-guide', '/care-guide', '/faq', ...LEGAL_ROUTES,
  ]
  const entries: MetadataRoute.Sitemap = staticPaths.flatMap(path => LOCALES.map(locale => ({
    url: `${SITE_URL}${locale === 'tr' ? '' : `/${locale}`}${path === '/' ? '' : path}`,
    alternates: { languages: {
      tr: `${SITE_URL}${path}`,
      en: `${SITE_URL}/en${path === '/' ? '' : path}`,
      ar: `${SITE_URL}/ar${path === '/' ? '' : path}`,
      'x-default': `${SITE_URL}${path}`,
    } },
  })))

  for (const [prefix, rows] of [
    ['/category', categories], ['/product', products], ['/collections', collections],
  ] as const) {
    for (const row of rows) {
      if (!row.slug) continue
      const lastModified = new Date(row.updated_at)
      entries.push({
        url: `${SITE_URL}${localePrefixForSitemap('tr')}${prefix}/${encodeURIComponent(row.slug)}`,
        ...(!Number.isNaN(lastModified.getTime()) ? { lastModified } : {}),
      })
      for (const locale of ['en', 'ar'] as const) entries.push({
        url: `${SITE_URL}/${locale}${prefix}/${encodeURIComponent(row.slug)}`,
        ...(Number.isNaN(lastModified.getTime()) ? {} : { lastModified }),
        alternates: { languages: {
          tr: `${SITE_URL}${prefix}/${encodeURIComponent(row.slug)}`,
          en: `${SITE_URL}/en${prefix}/${encodeURIComponent(row.slug)}`,
          ar: `${SITE_URL}/ar${prefix}/${encodeURIComponent(row.slug)}`,
          'x-default': `${SITE_URL}${prefix}/${encodeURIComponent(row.slug)}`,
        } },
      })
    }
  }

  // This public route also exists without a categories row (sale fallback).
  if (!categories.some(category => category.slug === 'sale' || category.slug === 'indirim')) {
    entries.push(...['', '/en', '/ar'].map(prefix => ({ url: `${SITE_URL}${prefix}/category/sale` })))
  }
  if (!categories.some(category => category.slug === 'bedding')) {
    entries.push(...['', '/en', '/ar'].map(prefix => ({ url: `${SITE_URL}${prefix}/category/bedding` })))
  }
  return entries
}

function localePrefixForSitemap(locale: typeof LOCALES[number]) { return locale === 'tr' ? '' : `/${locale}` }
