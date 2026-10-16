import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { USD_TRY_RATE_POLICY } from '@/lib/i18n/rate-policy'
import { ECB_PROVIDER, parseEcbRate } from '@/lib/i18n/ecb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
const FETCH_TIMEOUT_MS = USD_TRY_RATE_POLICY.fetchTimeoutMs

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || ''
  const actual = request.headers.get('authorization') || ''
  if (secret.length < 16) return false
  const expectedBytes = Buffer.from(`Bearer ${secret}`)
  const actualBytes = Buffer.from(actual)
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes)
}

export async function GET(request: Request) {
  const noCache = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  if (!authorized(request)) return NextResponse.json({ state: 'unavailable' }, { status: 401, headers: noCache })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ state: 'unavailable' }, { status: 503, headers: noCache })
  const abort = new AbortController()
  const timeout = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(ECB_URL, { signal: abort.signal, cache: 'no-store', headers: { accept: 'application/xml,text/xml' } })
    if (!response.ok) throw new Error('ECB_HTTP_ERROR')
    const xml = await response.text()
    if (xml.length > 100_000 || !xml.includes('<gesmes:Envelope')) throw new Error('ECB_DOCUMENT_INVALID')
    const { usdTry, rateDate } = parseEcbRate(xml)
    const fetchedAt = new Date().toISOString()
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await db.from('currency_reference_rates').upsert({
      base_currency: 'USD', quote_currency: 'TRY', usd_try: usdTry, rate_date: rateDate,
      provider: ECB_PROVIDER, fetched_at: fetchedAt,
    }, { onConflict: 'base_currency,quote_currency,rate_date' })
    if (error) throw new Error('RATE_STORE_FAILED')
    revalidateTag('currency-reference-rate')
    return NextResponse.json({ state: 'updated', base: 'USD', quote: 'TRY', fetchedAt, rateDate }, { headers: noCache })
  } catch {
    return NextResponse.json({ state: 'unavailable' }, { status: 503, headers: noCache })
  } finally { clearTimeout(timeout) }
}
