import { randomBytes } from 'node:crypto'
import { paymentAvailable, getPaymentProvider } from '@/lib/payment/provider'
import { GarantiProvider } from '@/lib/payment/garanti/adapter'
import { loadGarantiOrder, claimGarantiHandoff } from '@/lib/payment/garanti/order'
import { escapeMarkup } from '@/lib/payment/garanti/protocol'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sameOrigin, unavailable } from '@/lib/payment/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
async function authorized(request: Request) {
  if (!paymentAvailable()) throw new Error('Payment unavailable.')
  const provider = getPaymentProvider()
  if (!(provider instanceof GarantiProvider)) throw new Error('Wrong provider.')
  const url = new URL(request.url)
  if (url.searchParams.get('used') || url.origin !== provider.config.siteOrigin) throw new Error('Used handoff.')
  const token = url.searchParams.get('token') || ''
  const handoff = provider.handoff(token)
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  const order = await loadGarantiOrder(handoff.id)
  const redirect = `${provider.config.siteOrigin}/api/payment/garanti/handoff?token=${token}`
  if (!user || user.id !== order.userId || order.state !== 'pending' || order.redirectUrl !== redirect) throw new Error('Unauthorized handoff.')
  return { provider, order, handoff, redirect }
}
function html(body: string, formOrigin: string, script?: { nonce: string; text: string }) {
  return new Response(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Garanti BBVA ödeme geçişi</title><body>${body}${script ? `<script nonce="${script.nonce}">${script.text}</script>` : ''}</body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      // no-referrer makes native HTML form POSTs send Origin:null, breaking
      // the required same-origin check. strict-origin keeps the actual origin
      // while withholding the signed token/path from both app and bank referrers.
      'Referrer-Policy': 'strict-origin', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action ${formOrigin}; script-src ${script ? `'nonce-${script.nonce}'` : "'none'"}` } })
}
export async function GET(request: Request) {
  if (!paymentAvailable()) return unavailable()
  try {
    const { redirect, provider } = await authorized(request)
    // GET never sends a sale or consumes the token; user explicitly posts once.
    const notice = provider.config.observationOnly ? '<p>Yalnızca Garanti TEST kartı kullanın. Sonuç her durumda doğrulama bekliyor olarak tutulur; sipariş ödenmiş sayılmaz.</p>' : ''
    return html(`<h1>Garanti BBVA ${provider.config.observationOnly ? 'TEST' : 'güvenli ödeme'}</h1>${notice}<p>Kart bilgilerinizi bankanın sayfasında gireceksiniz.</p><form method="post" action="${escapeMarkup(redirect)}"><button type="submit">Banka Ödeme Sayfasına Geç</button></form>`, provider.config.siteOrigin)
  } catch { return new Response('Ödeme geçişi kullanılamıyor. Siparişinizin durumunu kontrol edin.', { status: 409, headers: { 'Cache-Control': 'no-store' } }) }
}
export async function POST(request: Request) {
  if (!paymentAvailable()) return unavailable()
  if (!sameOrigin(request)) return new Response('Geçersiz istek.', { status: 403 })
  try {
    const { provider, order, handoff, redirect } = await authorized(request)
    // Construct and validate before consuming. No password, StoreKey or card fields.
    const inputs = Object.entries(provider.fields(order, handoff.ip)).map(([name, value]) => `<input type="hidden" name="${escapeMarkup(name)}" value="${escapeMarkup(value)}">`).join('')
    await claimGarantiHandoff(order, redirect)
    const nonce = randomBytes(18).toString('base64')
    return html(`<p>Bankanın güvenli ödeme sayfasına yönlendiriliyorsunuz.</p><form id="bank" accept-charset="utf-8" method="post" action="${escapeMarkup(provider.config.formUrl)}">${inputs}<button type="submit">Garanti BBVA’ya Devam Et</button></form>`, new URL(provider.config.formUrl).origin,
      { nonce, text: "document.getElementById('bank').submit()" })
  } catch { return new Response('Ödeme tekrar başlatılmadı. Siparişinizin durumunu kontrol edin.', { status: 409, headers: { 'Cache-Control': 'no-store' } }) }
}
