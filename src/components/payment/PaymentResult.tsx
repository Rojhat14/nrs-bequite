import Link from 'next/link'
import { CheckCircle2, Clock3, MessageCircle, XCircle } from 'lucide-react'
import LegalOrderSummary from '@/components/legal/LegalOrderSummary'
import GarantiReconcileAction from '@/components/payment/GarantiReconcileAction'
import MetaPurchase from '@/components/payment/MetaPurchase'
import { LIVE_CONTROLLED_CATALOG_PRODUCT_ID, LIVE_OBSERVATION_PRODUCT_ID } from '@/lib/payment/garanti/live-observation-product'
import { readAccessiblePaymentOrder } from '@/lib/payment/repository'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import { localePrefix, message } from '@/lib/i18n/messages'

export default async function PaymentResult({ orderId, failure = false }: { orderId?: string; failure?: boolean; failureCode?: string }) {
  const locale = await getRequestLocale()
  const t = (key: Parameters<typeof message>[1]) => message(locale, key)
  const prefix = localePrefix(locale)
  let order: Awaited<ReturnType<typeof readAccessiblePaymentOrder>> = null
  try { if (orderId) order = await readAccessiblePaymentOrder(orderId) } catch { /* unavailable DB grants no access */ }

  const status = order?.status as string | undefined
  const paid = status === 'paid'
  const cancelled = status === 'cancelled' || status === 'canceled'
  const verifiedFailure = status === 'failed' || status === 'payment_failed'
  const unverifiedClosed = status === 'payment_unverified'

  const title = !order
    ? orderId ? t('orderUnavailable') : t('statusChecking')
    : paid ? t('paymentReceived')
      : cancelled ? t('verifiedCancelled')
        : verifiedFailure ? t('paymentCouldNotComplete')
          : t('paymentResultTitle')
  const description = !order ? t('orderAccessUnavailable')
    : paid ? t('paymentReceivedBody')
      : cancelled ? t('verifiedCancelledBody')
        : verifiedFailure ? t('paymentFailureBody') : t('paymentUnknownBody')

  const summary = order?.legal?.order_summary
  // Controlled 3 TRY bank trials are not sales.
  const reportPurchase = paid && Array.isArray(summary?.items) && summary.items.length > 0 && !summary.items.some(item =>
    item.productId === LIVE_OBSERVATION_PRODUCT_ID || item.productId === LIVE_CONTROLLED_CATALOG_PRODUCT_ID)

  const Icon = paid ? CheckCircle2 : verifiedFailure || cancelled ? XCircle : Clock3
  const tone = paid ? 'border-emerald-900/15 bg-emerald-900/[0.035] text-emerald-950'
    : verifiedFailure || cancelled ? 'border-nrs-rosegold/30 bg-nrs-rosegold/[0.06] text-nrs-ink'
      : 'border-nrs-ink/10 bg-nrs-panel/55 text-nrs-ink'

  return <main className="min-h-[calc(100svh-var(--nrs-header-height))] bg-nrs-canvas px-4 pb-16 pt-[calc(var(--nrs-header-height)+2rem)] sm:px-6 sm:pt-[calc(var(--nrs-header-height)+3rem)]">
    <div className="mx-auto max-w-2xl">
      <section aria-live="polite" className={`rounded-sm border p-5 sm:p-8 ${tone}`}>
        <Icon aria-hidden="true" className="mb-5" size={30} strokeWidth={1.5} />
        <p className="text-[10px] uppercase tracking-[0.2em] text-current/60">NRS Bequite Luminous · {t('statusOrder')}</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-current/75">{description}</p>
        {order && <div className="mt-6 border-t border-current/10 pt-4">
          <p className="text-xs uppercase tracking-[0.12em] text-current/55">{t('orderNumber')}</p>
          <p className="mt-1 break-all font-mono text-sm" dir="ltr">{order.id}</p>
        </div>}
      </section>

      {order?.status === 'pending' && <GarantiReconcileAction orderId={order.id} />}
      {reportPurchase && order && summary && <MetaPurchase orderId={order.id} total={summary.total}
        items={summary.items.map(item => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice }))} />}

      {order?.legal?.order_summary && <details className="mt-4 rounded-sm border border-nrs-ink/10 bg-nrs-warm-white px-4 py-2">
        <summary className="flex min-h-11 cursor-pointer items-center font-serif text-lg">{t('orderDetails')}</summary>
        <div className="pb-3 pt-2"><LegalOrderSummary summary={order.legal.order_summary} /></div>
      </details>}

      <nav aria-label={t('orderLinks')} className="mt-6 flex flex-col gap-3 sm:flex-row">
        {order && <Link href={`${prefix}/profile#orders`} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-sm bg-nrs-charcoal px-5 text-sm text-nrs-ivory hover:bg-nrs-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          {paid || cancelled ? t('orderPage') : t('myOrders')}
        </Link>}
        {(cancelled || verifiedFailure) && <Link href={`${prefix}/collections`} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-sm border border-nrs-ink/20 px-5 text-sm text-nrs-ink hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{t('discoverCollection')}</Link>}
        <Link href={`${prefix}/contact`} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm border border-nrs-ink/20 px-5 text-sm text-nrs-ink hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <MessageCircle size={16} /> {t('getHelp')}
        </Link>
      </nav>
      {failure && !order && <p className="mt-4 text-center text-xs leading-5 text-nrs-ink/55">{t('statusNotice')}</p>}
    </div>
  </main>
}
