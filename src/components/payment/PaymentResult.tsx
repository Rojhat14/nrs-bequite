import Link from 'next/link'
import { CheckCircle2, Clock3, MessageCircle, XCircle } from 'lucide-react'
import LegalOrderSummary from '@/components/legal/LegalOrderSummary'
import GarantiReconcileAction from '@/components/payment/GarantiReconcileAction'
import { readAccessiblePaymentOrder } from '@/lib/payment/repository'

export default async function PaymentResult({ orderId, failure = false }: { orderId?: string; failure?: boolean; failureCode?: string }) {
  let order: Awaited<ReturnType<typeof readAccessiblePaymentOrder>> = null
  try { if (orderId) order = await readAccessiblePaymentOrder(orderId) } catch { /* unavailable DB grants no access */ }

  const status = order?.status as string | undefined
  const paid = status === 'paid'
  const cancelled = status === 'cancelled' || status === 'canceled'
  const verifiedFailure = status === 'failed' || status === 'payment_failed'
  const unverifiedClosed = status === 'payment_unverified'

  const title = !order
    ? orderId ? 'Sipariş bilgisi görüntülenemiyor' : 'Ödeme durumu kontrol ediliyor'
    : paid ? 'Ödemeniz alındı.'
      : cancelled ? 'Siparişiniz iptal edildi'
        : verifiedFailure ? 'Ödeme tamamlanamadı'
          : unverifiedClosed ? 'Ödeme sonucu'
          : 'Ödeme sonucu'
  const description = !order
    ? 'Sipariş bilgilerine erişim doğrulanamadı. Hesabınızdaki siparişler bölümünden kontrol edebilir veya bize ulaşabilirsiniz.'
    : paid ? 'Ödemeniz doğrulandı. Siparişinizin ayrıntılarına hesabınızdan ulaşabilirsiniz.'
      : cancelled ? 'Siparişiniz uygulamada iptal edildi olarak doğrulandı. Yeni bir alışverişe başlayabilirsiniz.'
      : verifiedFailure ? 'Siparişiniz alınmadı. Lütfen tekrar deneyin.'
          : 'Ödeme sonucu henüz netleşmedi. Lütfen daha sonra tekrar kontrol edin.'

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
        {order && <div className="mt-6 border-t border-current/10 pt-4">
          <p className="text-xs uppercase tracking-[0.12em] text-current/55">Sipariş numarası</p>
          <p className="mt-1 break-all font-mono text-sm">{order.id}</p>
        </div>}
      </section>

      {order?.status === 'pending' && <GarantiReconcileAction orderId={order.id} />}

      {order?.legal?.order_summary && <details className="mt-4 rounded-sm border border-nrs-ink/10 bg-nrs-warm-white px-4 py-2">
        <summary className="flex min-h-11 cursor-pointer items-center font-serif text-lg">Sipariş ayrıntıları</summary>
        <div className="pb-3 pt-2"><LegalOrderSummary summary={order.legal.order_summary} /></div>
      </details>}

      <nav aria-label="Sonraki adımlar" className="mt-6 flex flex-col gap-3 sm:flex-row">
        {order && <Link href="/profile#orders" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-sm bg-nrs-charcoal px-5 text-sm text-nrs-ivory hover:bg-nrs-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          {paid || cancelled ? 'Sipariş ayrıntılarına git' : 'Siparişlerime git'}
        </Link>}
        {(cancelled || verifiedFailure) && <Link href="/collections" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-sm border border-nrs-ink/20 px-5 text-sm text-nrs-ink hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Koleksiyonu keşfet</Link>}
        <Link href="/contact" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm border border-nrs-ink/20 px-5 text-sm text-nrs-ink hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <MessageCircle size={16} /> Yardım alın
        </Link>
      </nav>
      {failure && !order && <p className="mt-4 text-center text-xs leading-5 text-nrs-ink/55">Bu sayfanın adresi ödeme sonucunu tek başına belirlemez. Sipariş durumu sunucu kaydından okunur.</p>}
    </div>
  </main>
}
