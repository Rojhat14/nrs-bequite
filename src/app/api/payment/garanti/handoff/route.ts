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
  const styles = `:root{color-scheme:light;--canvas:#F7F3EE;--ink:#171512;--muted:#716b64;--line:#e5ded5;--panel:#fffdfa;--accent:#B88970}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:15px/1.55 Inter,Arial,sans-serif;-webkit-font-smoothing:antialiased}.shell{min-height:100svh;display:grid;place-items:center;padding:24px}.card{width:min(100%,520px);border:1px solid var(--line);background:var(--panel);padding:clamp(22px,6vw,42px);box-shadow:0 20px 60px #1715120b}.brand{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}h1{font:400 clamp(27px,6vw,36px)/1.15 'Playfair Display',Georgia,serif;margin:12px 0 8px;letter-spacing:.01em}.lead{margin:0;color:var(--muted);font-size:14px}.secure{margin:24px 0 18px;padding:14px 15px;border:1px solid var(--line);background:var(--canvas);font-size:13px;line-height:1.6}.items{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}.items li{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid var(--line);font-size:13px}.items span:first-child{min-width:0;overflow-wrap:anywhere}.items span:last-child{white-space:nowrap}.total{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:18px 0 20px;font-size:14px}.total strong{font:400 26px/1.2 'Playfair Display',Georgia,serif;white-space:nowrap}.actions{display:grid;gap:12px}.primary{display:flex;min-height:52px;align-items:center;justify-content:center;width:100%;border:0;background:#1a1917;color:white;padding:12px 18px;font:500 14px Inter,Arial,sans-serif;cursor:pointer}.primary:hover{background:#302d29}.primary:focus-visible,.secondary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.primary:disabled{opacity:.7;cursor:wait}.secondary{display:inline-flex;min-height:44px;align-items:center;justify-content:center;color:var(--muted);font-size:13px;text-underline-offset:4px}.foot{margin:20px 0 0;color:var(--muted);font-size:11px;text-align:center}.spinner{display:inline-block;width:16px;height:16px;margin-right:9px;border:2px solid #ffffff60;border-top-color:white;border-radius:50%;vertical-align:-3px;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:360px){.shell{padding:12px}.card{padding:20px}.total strong{font-size:23px}}`;
  return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#F7F3EE"><title>Güvenli ödeme geçişi · NRS Bequite Luminous</title><style>${styles}</style></head><body>${body}${script ? `<script nonce="${script.nonce}">${script.text}</script>` : ''}</body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      // no-referrer makes native HTML form POSTs send Origin:null, breaking
      // the required same-origin check. strict-origin keeps the actual origin
      // while withholding the signed token/path from both app and bank referrers.
      'Referrer-Policy': 'strict-origin', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action ${formOrigin}; style-src 'unsafe-inline'; script-src ${script ? `'nonce-${script.nonce}'` : "'none'"}` } })
}
export async function GET(request: Request) {
  if (!paymentAvailable()) return unavailable()
  try {
    const { redirect, provider, order } = await authorized(request)
    // GET never sends a sale or consumes the token; user explicitly posts once.
    const notice = provider.config.observationOnly ? '<div class="secure"><strong>TEST ortamı.</strong> Yalnızca Garanti TEST kartını kullanın. Bu deneme otomatik olarak ödenmiş sayılmaz.</div>' : ''
    const liveNotice = provider.config.liveObservationOnly
      ? `<div class="secure"><strong>Kontrollü canlı deneme · gerçek tahsilat yapılabilir.</strong><br>Sipariş tutarı ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(order.amountMinor / 100)}. Tutarı kontrol edin. Sonuç doğrulanana kadar sipariş beklemede kalabilir.</div>` : ''
    const summary = order.legal.order_summary
    const lines = summary.items.map(item => `<li><span>${escapeMarkup(item.name)}${item.size ? ` · ${escapeMarkup(item.size)}` : ''} · ${item.quantity} adet</span><span>${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.unitPrice * item.quantity)}</span></li>`).join('')
    const nonce = randomBytes(18).toString('base64')
    const title = provider.config.observationOnly ? 'TEST ödeme' : provider.config.liveObservationOnly ? 'Kontrollü canlı ödeme' : 'Güvenli ödeme'
    const body = `<main class="shell"><section class="card" aria-labelledby="handoff-title"><p class="brand">NRS Bequite Luminous</p><h1 id="handoff-title">${title}</h1><p class="lead">Ödeme adımına güvenle devam edin.</p>${notice}${liveNotice}<ul class="items" aria-label="Sipariş özeti">${lines}</ul><div class="total"><span>Sipariş toplamı</span><strong>${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(order.amountMinor / 100)}</strong></div><p class="secure">Kart bilgileriniz Garanti BBVA’nın güvenli ödeme sayfasında girilir.</p><form id="handoff" method="post" action="${escapeMarkup(redirect)}"><button id="continue" type="submit" class="primary">Güvenli ödemeye devam et</button></form><a class="secondary" href="/checkout/verify?orderId=${encodeURIComponent(order.id)}">Sipariş özetine dön</a><p class="foot">Güvenli ödeme altyapısı · Garanti BBVA</p></section></main>`
    const script = `document.getElementById('handoff').addEventListener('submit',function(e){const b=document.getElementById('continue');if(b.disabled){e.preventDefault();return}b.disabled=true;b.setAttribute('aria-busy','true');b.textContent='Ödeme sayfasına geçiliyor…'});`
    return html(body, provider.config.siteOrigin, { nonce, text: script })
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
    return html(`<main class="shell"><section class="card" aria-live="polite" aria-busy="true"><p class="brand">NRS Bequite Luminous</p><h1>Güvenli ödeme sayfası açılıyor</h1><p class="lead"><span class="spinner" aria-hidden="true"></span>Garanti BBVA’ya güvenli şekilde aktarılıyorsunuz.</p><p class="foot">Lütfen bu pencereyi kapatmayın.</p><form id="bank" accept-charset="utf-8" method="post" action="${escapeMarkup(provider.config.formUrl)}">${inputs}<button id="bank-submit" class="primary" type="submit">Garanti BBVA’ya devam et</button></form></section></main>`, new URL(provider.config.formUrl).origin,
      { nonce, text: "(()=>{const f=document.getElementById('bank');const b=document.getElementById('bank-submit');let submitted=false;f.addEventListener('submit',e=>{if(submitted){e.preventDefault();return}submitted=true;b.disabled=true;b.textContent='Garanti BBVA’ya aktarılıyor…'});if(!submitted){submitted=true;b.disabled=true;b.textContent='Garanti BBVA’ya aktarılıyor…';f.submit()}})()" })
  } catch { return new Response('Ödeme tekrar başlatılmadı. Siparişinizin durumunu kontrol edin.', { status: 409, headers: { 'Cache-Control': 'no-store' } }) }
}
