import Link from 'next/link'
import LegalOrderSummary from '@/components/legal/LegalOrderSummary'
import LegalDocumentContent from '@/components/legal/LegalDocumentContent'
import { getLegalDocument, legalDocumentHref } from '@/lib/legal/documents'
import { readAccessiblePaymentOrder } from '@/lib/payment/repository'

export default async function PaymentResult({ orderId, failure = false }: { orderId?: string; failure?: boolean }) {
  // URL flags (success=true, status=paid, etc.) are deliberately ignored.
  let order: Awaited<ReturnType<typeof readAccessiblePaymentOrder>> = null
  try { if (orderId) order = await readAccessiblePaymentOrder(orderId) } catch { /* unavailable DB grants no access */ }
  const paid = order?.status === 'paid'
  return <main className="min-h-screen bg-nrs-canvas px-6 pb-16 pt-[calc(var(--nrs-header-height)+3rem)]">
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif text-3xl">{paid ? 'Ödeme doğrulandı' : order?.status === 'failed' || failure ? 'Ödeme tamamlanamadı' : 'Ödeme durumu doğrulanıyor'}</h1>
      <p className="text-sm leading-7 text-nrs-ink/65">{paid ? 'Siparişinizin ödeme sonucu sunucu tarafından doğrulandı.' : 'Bu ekran tek başına ödeme veya kesin sipariş onayı değildir. Kartınızdan çekim gerçekleşip gerçekleşmediğini bankanızdan kontrol edin. Durum netleşmeden yeniden ödeme yapmayın; bizimle iletişime geçebilirsiniz.'}</p>
      {order && <>
        <p className="break-all text-sm">Sipariş numarası: {order.id} · Ödeme durumu: {order.status}</p>
        <LegalOrderSummary summary={order.legal.order_summary} />
        <p className="text-sm">Sözleşme kabul zamanı: {new Date(order.legal.accepted_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
        {(['contract', 'preInformation'] as const).map(kind => {
          const version = kind === 'contract' ? order.legal.contract_version : order.legal.pre_information_version
          const slug = kind === 'contract' ? 'mesafeli-satis-sozlesmesi' : 'on-bilgilendirme-formu'
          const document = getLegalDocument(slug, version)
          return document ? <details key={kind} className="min-w-0 border border-nrs-ink/15 p-4 sm:p-6">
            <summary className="min-h-11 cursor-pointer font-serif text-lg">{document.title} · {version}</summary>
            <div className="pt-6"><LegalDocumentContent document={document} /></div>
            <Link className="inline-flex min-h-11 items-center underline" href={legalDocumentHref(kind, version)}>Kabul edilen belgeyi aç</Link>
          </details> : <p key={kind}>Kabul edilen belge arşivi yüklenemedi; bizimle iletişime geçin.</p>
        })}
        <p className="text-sm text-nrs-ink/65">Siparişlerinize ve kabul ettiğiniz belgelere hesabınızdan erişebilirsiniz. Yeni misafir kart siparişi desteklenmez; geçmiş bir misafir kaydı varsa güvenli tarayıcı erişimi süresiyle sınırlıdır. Belge talebi için iletişim kanallarımızdan kimlik doğrulamasıyla başvurabilirsiniz.</p>
      </>}
      <div className="flex flex-wrap gap-5 text-sm"><Link href="/contact" className="inline-flex min-h-11 items-center underline">İletişim</Link>
        <Link href="/checkout" className="inline-flex min-h-11 items-center underline">Sepetime dön</Link>
        <Link href="/profile#orders" className="inline-flex min-h-11 items-center underline">Hesabımdaki siparişler ve sözleşmeler</Link></div>
    </div>
  </main>
}
