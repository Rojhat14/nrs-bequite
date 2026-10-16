import 'server-only'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { DisplayRate } from '@/lib/i18n/money'
import { MAX_RATE_AGE_MS, USD_TRY_RATE_POLICY } from '@/lib/i18n/rate-policy'

const readCurrentRate = unstable_cache(async (): Promise<DisplayRate | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  try {
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await db.from('currency_reference_rates')
      .select('usd_try,fetched_at,rate_date').eq('base_currency', 'USD').eq('quote_currency', 'TRY')
      .order('fetched_at', { ascending: false }).limit(1).maybeSingle()
    if (error || !data) return null
    const fetchedAt = Date.parse(data.fetched_at)
    const rateDate = typeof data.rate_date === 'string' ? data.rate_date : ''
    const sourceDateStart = Date.parse(`${rateDate}T00:00:00.000Z`)
    const usdTry = Number(data.usd_try)
    if (!Number.isFinite(usdTry) || usdTry <= 0 || !Number.isFinite(fetchedAt)
      || !Number.isFinite(sourceDateStart) || Date.now() - fetchedAt < -5 * 60 * 1000
      || Date.now() - sourceDateStart > MAX_RATE_AGE_MS) return null
    return { usdTry, fetchedAt: new Date(fetchedAt).toISOString(), rateDate }
  } catch { return null }
}, ['nrs-currency-reference-rate'], { revalidate: USD_TRY_RATE_POLICY.revalidateSeconds, tags: ['currency-reference-rate'] })

export async function getCurrentUsdTryRate(): Promise<DisplayRate | null> {
  try { return await readCurrentRate() } catch { return null }
}
