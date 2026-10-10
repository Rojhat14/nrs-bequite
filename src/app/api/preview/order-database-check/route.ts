import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Temporary: remove this route after Preview verification, before production.
// Vercel Deployment Protection stays enabled; no bypass tokens or exceptions.
export async function GET() {
  const reply = (status: 'PASS' | 'BLOCKED', category?: string, httpStatus = 200) =>
    NextResponse.json({ status, ...(category ? { category } : {}) }, {
      status: httpStatus, headers: { 'Cache-Control': 'no-store, private' },
    })
  if (process.env.VERCEL_ENV !== 'preview') return reply('BLOCKED', 'PREVIEW_ONLY', 404)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!key || !rawUrl) return reply('BLOCKED', 'CONFIGURATION', 503)
  try {
    const url = new URL(rawUrl)
    if (url.origin !== 'https://moiynemxthkmgpgnfajd.supabase.co' || url.pathname !== '/'
      || url.username || url.password || url.search || url.hash) {
      return reply('BLOCKED', 'PROJECT_MISMATCH', 503)
    }
  } catch { return reply('BLOCKED', 'PROJECT_MISMATCH', 503) }

  try {
    const signal = AbortSignal.timeout(12000)
    let transportStatus = 0
    const db = createClient(rawUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (url, options) => {
        const headers = new Headers(options?.headers)
        // Secret API keys are not JWTs. The installed SDK's REST wrapper can
        // still use them as Bearer fallback; legacy service_role JWTs keep it.
        if (key.startsWith('sb_secret_')) headers.delete('Authorization')
        const response = await fetch(url, {
          ...options, headers, signal, redirect: 'error', cache: 'no-store',
        })
        transportStatus = response.status
        return response
      } },
    })
    const checks = [
      ['products', 'id,name,description,price_amount,compare_at_price,currency,status,in_stock,categories(name,slug),product_images(*)'],
      ['product_variants', 'id,product_id,size,stock_quantity,is_active'],
      ['orders', 'id,user_id,total_amount,status,customer_name,customer_email,customer_phone,shipping_address,shipping_city,shipping_district,shipping_postal_code,manual_request_key,manual_request_hash,manual_paid_at,manual_payment_reference,manual_payment_confirmed_by'],
      ['order_items', 'id,order_id,product_id,quantity,price_at_purchase'],
      ['order_legal_records', 'order_id,contract_accepted,contract_version,pre_information_version,accepted_at,document_hash,summary_hash,order_summary'],
      ['payment_orders', 'order_id'],
      ['admin_users', 'user_id,role,is_active'],
    ] as const
    for (const [table, columns] of checks) {
      transportStatus = 0
      // HEAD additionally prevents response bodies, even if a server ignores limit.
      const { error, status, data } = await db.from(table).select(columns, { head: true }).limit(0)
      // Check raw HTTP too: the client can normalize an empty-body HEAD 404.
      const httpStatus = transportStatus || status
      if (error || httpStatus < 200 || httpStatus >= 300) return reply('BLOCKED', httpStatus === 401 || httpStatus === 403 ? `AUTHORIZATION_${httpStatus}_${table.toUpperCase()}`
        : httpStatus === 400 || httpStatus === 404 ? 'SCHEMA_ACCESS' : 'CONNECTION', 503)
      if (data !== null) return reply('BLOCKED', 'UNEXPECTED_RESPONSE', 503)
    }
    return reply('PASS')
  } catch { return reply('BLOCKED', 'CONNECTION', 503) }
}
