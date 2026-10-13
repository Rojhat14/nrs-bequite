import Link from 'next/link'
import { CheckCircle2, Clock3, MessageCircle, XCircle } from 'lucide-react'
import LegalOrderSummary from '@/components/legal/LegalOrderSummary'
import { readAccessiblePaymentOrder } from '@/lib/payment/repository'
import { readGarantiLiveSingleFinalizeFailure } from '@/lib/payment/garanti/live-diagnostics'
import { garantiObservationOnly, garantiLiveObservationOnly } from '@/lib/payment/garanti/config'
import { readTestDiagnostic } from '@/lib/payment/garanti/diagnostics'

export default async function PaymentResult({ orderId, failure = false }: { orderId?: string; failure?: boolean; failureCode?: string }) {
  let order: Awaited<ReturnType<typeof readAccessiblePaymentOrder>> = null
  try { if (orderId) order = await readAccessiblePaymentOrder(orderId) } catch { /* unavailable DB grants no access */ }

  const observation = garantiObservationOnly()
  const liveObservation = garantiLiveObservationOnly()
  const testDiagnostic = observation && order ? await readTestDiagnostic(order.id) : null
  const liveDiagnostic = liveObservation && order ? await readGarantiLiveSingleFinalizeFailure(order.id) : null
  const signedFailure = liveDiagnostic?.source === 'failure'
    && liveDiagnostic.callback_signature_verified === true
    && liveDiagnostic.order_match === true && liveDiagnostic.amount_match === true
    && liveDiagnostic.currency_match === true && liveDiagnostic.terminal_match === true
    && liveDiagnostic.request_match === true
    && liveDiagnostic.callback_response === 'declined'
    && liveDiagnostic.callback_procreturncode !== '00'
  const status = order?.status as string | undefined
  const paid = status === 'paid'
  const cancelled = status === 'cancelled' || status === 'canceled'
  const verifiedFailure = signedFailure || status === 'failed'
    || testDiagnostic?.outcome === 'verified_failure'

  const title = !order
    ? orderId ? 'Sipariş bilgisi görüntülenemiyor' : 'Ödeme durumu kontrol ediliyor'
    : paid ? 'Ödemeniz alındı'
      : cancelled ? 'Siparişiniz iptal edildi'
        : verifiedFailure ? 'Ödeme tamamlanamadı'
          : 'Ödeme durumu kontrol ediliyor'
  const description = !order
    ? 'Sipariş bilgilerine erişim doğrulanamadı. Hesabınızdaki siparişler bölümünden kontrol edebilir veya bize ulaşabilirsiniz.'
    : paid ? 'Ödemeniz doğrulandı. Siparişinizin ayrıntılarına hesabınızdan ulaşabilirsiniz.'
      : cancelled ? 'Siparişiniz uygulamada iptal edildi olarak doğrulandı. Yeni bir alışverişe başlayabilirsiniz.'
        : signedFailure ? 'Garanti bu ödeme denemesini başarısız olarak bildirdi. Sipariş kaydı beklemede ve banka sorgusu kesin tahsilat ya da iptal durumunu doğrulamadı. Durum netleşene kadar yeniden ödeme başlatmayın.'
          : status === 'failed' ? 'Ödeme tamamlanamadı. Siparişinizin güncel durumunu hesabınızdaki siparişler bölümünden görebilirsiniz.'
            : testDiagnostic?.outcome === 'verified_failure' ? 'TEST bankası bu ödeme denemesini başarısız olarak bildirdi. Bu test sonucu gerçek tahsilat veya kesin iptal kanıtı değildir.'
              : observation ? 'Bu TEST siparişinin banka yanıtı doğrulanıyor. Test gözlem akışında sonuç otomatik olarak paid yapılmaz.'
                : liveObservation ? 'Kontrollü canlı denemenin banka sonucu doğrulanıyor. Tahsilat ihtimali netleşene kadar yeni ödeme başlatmayın.'
                  : 'Banka yanıtı henüz doğrulanmadı. Tahsilat ihtimali netleşene kadar yeniden ödeme başlatmayın; güncel durumu hesabınızdan kontrol edin.'

  const Icon = paid ? CheckCircle2 : verifiedFailure || cancelled ? XCircle : Clock3
  const tone = paid ? 'border-emerald-900/15 bg-emerald-900/[0.035] text-emerald-950'
    : verifiedFailure || cancelled ? 'border-nrs-rosegold/30 bg-nrs-rosegold/[0.06] text-nrs-ink'
      : 'border-nrs-ink/10 bg-nrs-panel/55 text-nrs-ink'

  return <main className="min-h-[calc(100svh-var(--nrs-header-height))] bg-nrs-canvas px-4 pb-16 pt-[calc(var(--nrs-header-height)+2rem)] sm:px-6 sm:pt-[calc(var(--nrs-header-height)+3rem)]">
    <div className="mx-auto max-w-2xl">
      <section aria-live="polite" className={`rounded-sm border p-5 sm:p-8 ${tone}`}>
        <Icon aria-hidden="true" className="mb-5" size={30} strokeWidth={1.5} />
        <p className="text-[10px] uppercase tracking-[0.2em] text-current/60">NRS Bequite Luminous · Sipariş durumu</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-current/75">{description}</p>
        {liveObservation && status === 'pending' && <p className="mt-5 border-t border-current/10 pt-4 text-xs leading-5 text-current/70">Kontrollü canlı deneme: gerçek tahsilat yapılabilir. Banka sonucu netleşmeden yeni ödeme başlatmayın.</p>}
        {observation && status === 'pending' && <p className="mt-5 border-t border-current/10 pt-4 text-xs leading-5 text-current/70">TEST akışıdır; bu ekran tek başına gerçek bir ödeme veya tahsilat anlamına gelmez.</p>}
        {order && <div className="mt-6 border-t border-current/10 pt-4">
          <p className="text-xs uppercase tracking-[0.12em] text-current/55">Sipariş numarası</p>
          <p className="mt-1 break-all font-mono text-sm">{order.id}</p>
        </div>}
      </section>

      {order?.legal?.order_summary && <details className="mt-4 rounded-sm border border-nrs-ink/10 bg-nrs-warm-white px-4 py-2">
        <summary className="flex min-h-11 cursor-pointer items-center font-serif text-lg">Sipariş ayrıntıları</summary>
        <div className="pb-3 pt-2"><LegalOrderSummary summary={order.legal.order_summary} /></div>
      </details>}

      <nav aria-label="Sonraki adımlar" className="mt-6 flex flex-col gap-3 sm:flex-row">
        {order && <Link href="/profile#orders" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-sm bg-nrs-charcoal px-5 text-sm text-nrs-ivory hover:bg-nrs-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          {paid || cancelled ? 'Sipariş ayrıntılarına git' : 'Siparişlerime git'}
        </Link>}
        {cancelled && <Link href="/collections" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-sm border border-nrs-ink/20 px-5 text-sm text-nrs-ink hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Koleksiyonu keşfet</Link>}
        <Link href="/contact" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm border border-nrs-ink/20 px-5 text-sm text-nrs-ink hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <MessageCircle size={16} /> Yardım alın
        </Link>
      </nav>
      {failure && !order && <p className="mt-4 text-center text-xs leading-5 text-nrs-ink/55">Bu sayfanın adresi ödeme sonucunu tek başına belirlemez. Sipariş durumu sunucu kaydından okunur.</p>}
    </div>
  </main>
}
