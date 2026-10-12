import { NextResponse } from 'next/server'
import { isIP } from 'node:net'
import { paymentAvailable, getPaymentProvider } from '@/lib/payment/provider'
import { sameOrigin, unavailable, boundedText } from '@/lib/payment/http'
import { GarantiProvider } from '@/lib/payment/garanti/adapter'
import { loadGarantiOrder, renewUnsubmittedGarantiHandoff } from '@/lib/payment/garanti/order'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { UUID } from '@/lib/payment/request'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  if (!paymentAvailable()) return unavailable()
  if (!sameOrigin(request)) return new Response('Geçersiz istek.', { status: 403 })
  const provider = getPaymentProvider()
  if (!(provider instanceof GarantiProvider) || !provider.config.observationOnly) return unavailable()
  try {
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new Error('Invalid form.')
    const ids = new URLSearchParams(await boundedText(request)).getAll('orderId')
    if (ids.length !== 1 || !UUID.test(ids[0])) throw new Error('Invalid reference.')
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    const order = await loadGarantiOrder(ids[0])
    if (!user || user.id !== order.userId || order.state !== 'pending' || !order.redirectUrl
      || new URL(order.redirectUrl).searchParams.has('used')) throw new Error('Unauthorized or submitted handoff.')
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    // initiate only signs a URL; it makes no bank request and creates no order.
    const next = await provider.initiate({ ...order, state: 'initiating' }, order.id,
      { customerIp: isIP(ip) === 4 ? ip : '192.168.0.1' })
    await renewUnsubmittedGarantiHandoff(order, next.redirectUrl)
    return NextResponse.redirect(next.redirectUrl, 303)
  } catch { return new Response('Yalnızca bankaya gönderilmemiş kendi test siparişinizin bağlantısı yenilenebilir.', { status: 409, headers: { 'Cache-Control': 'no-store' } }) }
}
