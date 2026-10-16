import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { localeFromCookieHeader } from '@/lib/i18n/messages'
import { productSourceHash } from '@/lib/i18n/source-hash'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
  try {
    const body = await request.json() as { ids?: unknown }
    if (!Array.isArray(body.ids) || body.ids.length > 100 || body.ids.some(id => typeof id !== 'string' || id.length > 200)) {
      return NextResponse.json({ error: 'Invalid product list.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const ids = Array.from(new Set(body.ids as string[]))
    if (!ids.length) return NextResponse.json({ products: [] }, { headers: { 'Cache-Control': 'private, no-store' } })
    const locale = localeFromCookieHeader(request.headers.get('cookie'))
    const db = await createSupabaseServerClient()
    const { data, error } = await db.from('products').select('id,name,description,fabric,care,price_amount,compare_at_price')
      .in('id', ids).eq('status', 'active').eq('payment_test_only', false)
    if (error) throw new Error('CATALOG_READ_FAILED')
    const rows = data ?? []
    let translations: { entity_id: string; source_hash: string; payload: Record<string, unknown> }[] = []
    if (locale !== 'tr' && rows.length) {
      const result = await db.from('storefront_translations').select('entity_id,source_hash,payload')
        .eq('entity_type', 'product').eq('locale', locale).in('entity_id', rows.map(row => row.id))
      if (result.error) throw new Error('TRANSLATION_READ_FAILED')
      translations = (result.data ?? []) as typeof translations
    }
    const byId = new Map(translations.map(row => [row.entity_id, row]))
    return NextResponse.json({ products: rows.map(row => {
      const translation = byId.get(row.id)
      const payload = translation?.source_hash === productSourceHash(row) ? translation.payload : null
      return { id: row.id, title: typeof payload?.name === 'string' ? payload.name : row.name,
        price: Number(row.price_amount), compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price) }
    }) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return NextResponse.json({ error: 'Catalog unavailable.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } }) }
}
