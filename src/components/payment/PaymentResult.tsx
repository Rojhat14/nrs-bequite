import Link from 'next/link'
import LegalOrderSummary from '@/components/legal/LegalOrderSummary'
import LegalDocumentContent from '@/components/legal/LegalDocumentContent'
import { getLegalDocument, legalDocumentHref } from '@/lib/legal/documents'
import { readAccessiblePaymentOrder } from '@/lib/payment/repository'
import { garantiObservationOnly, garantiLiveObservationOnly } from '@/lib/payment/garanti/config'
import { readTestDiagnostic } from '@/lib/payment/garanti/diagnostics'
import { testHandoffUnsubmitted } from '@/lib/payment/garanti/order'

export default async function PaymentResult({ orderId, failure = false, failureCode }: { orderId?: string; failure?: boolean; failureCode?: string }) {
  // URL flags (success=true, status=paid, etc.) are deliberately ignored.
  let order: Awaited<ReturnType<typeof readAccessiblePaymentOrder>> = null
  try { if (orderId) order = await readAccessiblePaymentOrder(orderId) } catch { /* unavailable DB grants no access */ }
  const observation = garantiObservationOnly()
  const liveObservation = garantiLiveObservationOnly()
  const diagnostic = observation && order ? await readTestDiagnostic(order.id) : null
  const canRenew = observation && order ? await testHandoffUnsubmitted(order.id) : false
  const testTitle = diagnostic?.outcome === 'verified_failure' ? 'TEST — Banka işlemi başarısız'
    : diagnostic?.outcome === 'unverified_failure' ? 'TEST — Başarısızlık dönüşü, sonuç doğrulanamadı'
    : diagnostic?.outcome === 'verification_pending'
      ? diagnostic.query_stage === 'matched' ? 'TEST — Banka dönüşü ve sorgu eşleşti'
        : diagnostic.query_stage === 'mismatch' ? 'TEST — Banka sorgusu eşleşmedi'
        : 'TEST — Banka dönüşü doğrulandı'
      : diagnostic ? 'TEST — Sonuç doğrulanamadı'
        : orderId && !order ? 'TEST — Sipariş erişimi doğrulanamadı'
          : failure && !orderId ? 'TEST — Banka dönüşü ilişkilendirilemedi' : 'TEST — Gözlem modu'
  const testMessage = diagnostic?.outcome === 'verified_failure'
    ? 'İmzalı banka dönüşü bu test denemesinin başarısız olduğunu bildirdi.'
    : diagnostic?.outcome === 'unverified_failure'
      ? 'Başarısızlık bildiriminin imza veya işlem eşleşmeleri doğrulanamadı. Kesin banka sonucu bilinmiyor.'
      : diagnostic?.outcome === 'verification_pending'
        ? diagnostic.query_stage === 'matched'
          ? 'İmzalı banka dönüşü ile sipariş, tutar, para birimi ve terminal kontrolleri geçti. Banka sorgusunun işlem, tutar ve onay bilgileri de eşleşti; sorgu alanları aşağıda gösteriliyor.'
          : diagnostic.query_stage === 'mismatch'
            ? 'İmzalı banka dönüşü doğrulandı, ancak banka sorgusu aynı işlemin bilgileriyle eşleşmedi. Bu ayrı bir doğrulama sorunudur.'
            : diagnostic.query_stage === 'unavailable'
              ? 'İmzalı banka dönüşü doğrulandı. Banka sorgusu tamamlanamadı; sorgu doğrulaması bekliyor.'
              : 'İmzalı banka dönüşü doğrulandı. Banka sorgusu için henüz tanı kaydı yok.'
        : diagnostic ? 'Banka bildiriminin imzası veya işlem eşleşmeleri doğrulanamadı. Bu ayrı bir doğrulama sorunudur.'
          : orderId && !order
            ? 'Bu siparişe erişim doğrulanamadı. Siparişi oluşturan TEST hesabıyla giriş yapın. Erişim sağlanamaması banka dönüş kaydının olmadığı anlamına gelmez.'
            : failure && !orderId
              ? 'Banka dönüşü ayrıştırılamadı, işlemle ilişkilendirilemedi veya tanı kaydı işlenemedi. Bu teknik dönüş sorunu, gözlem modunun siparişi pending bırakmasından ayrıdır. Yeniden ödeme başlatmayın.'
              : order ? 'Bu sipariş için banka dönüş tanısı henüz bulunmuyor. Gözlem modu politikası ile dönüş kaydının eksikliği ayrı durumlardır.'
                : 'Bu ekranda bir sipariş seçilmedi. Siparişi oluşturan TEST hesabıyla hesabınızdaki sipariş sonucunu açın; burada banka kaydının varlığına ilişkin bir sonuç çıkarılmıyor.'
  const query = diagnostic?.query_evidence
  const checked = (value: boolean | null | undefined) => value === true ? 'doğrulandı' : value === false ? 'eşleşmedi' : 'kontrol edilmedi'
  const safeFailureCode = failureCode && /^GARANTI_[A-Z0-9_]{1,96}$/.test(failureCode) ? failureCode : null
  const failureCopy = safeFailureCode?.startsWith('GARANTI_FAILURE_RETURN_')
    ? 'Garanti’nin başarısızlık dönüşü alındı, ancak imzası doğrulanmadı. Banka sonucu ve tahsilat durumu bu bildirime dayanarak kesinleştirilemez.'
    : 'Garanti dönüşü doğrulanamadı. Sipariş pending kalır; tahsilat ihtimali netleşmeden tekrar ödeme başlatmayın.'
  const paid = order?.status === 'paid'
  return <main className="min-h-screen bg-nrs-canvas px-6 pb-16 pt-[calc(var(--nrs-header-height)+3rem)]">
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif text-3xl">{paid ? (observation ? 'TEST — Sipariş paid' : 'Ödeme doğrulandı') : observation ? testTitle : liveObservation ? (failure ? 'Canlı deneme — banka dönüşü doğrulanmadı' : 'Canlı deneme — incelemede') : order?.status === 'failed' || failure ? 'Ödeme tamamlanamadı' : 'Ödeme durumu doğrulanıyor'}</h1>
      <p className="text-sm leading-7 text-nrs-ink/65">{paid ? (observation ? 'Test veritabanında sipariş paid olarak kayıtlı. Bu durum, tek başına tarayıcı uçtan uca testinin tamamlandığını göstermez.' : 'Siparişinizin ödeme sonucu sunucu tarafından doğrulandı.') : observation ? testMessage : liveObservation ? (failure ? failureCopy : 'Bu kontrollü canlı gözlem siparişi otomatik olarak paid yapmaz. Garanti dönüş imzası ve bağımsız orderinq sonucu sunucu kayıtlarında incelenir. Kartınızdan çekim olmuş olabilir; durumu netleştirmeden yeni ödeme başlatmayın.') : 'Bu ekran tek başına ödeme veya kesin sipariş onayı değildir. Kartınızdan çekim gerçekleşip gerçekleşmediğini bankanızdan kontrol edin. Durum netleşmeden yeniden ödeme yapmayın; bizimle iletişime geçebilirsiniz.'}</p>
      {liveObservation && failure && safeFailureCode && <p role="status" className="border border-nrs-ink/15 p-4 text-sm">Güvenli hata kodu: <code>{safeFailureCode}</code></p>}
      {observation && !paid && <p className="border border-nrs-ink/15 p-4 text-sm leading-7">Test gözlem modu: otomatik sipariş onayı kapalı. Banka kontrolleri geçse bile sipariş pending kalır; bu test politikası bir doğrulama hatası değildir. Bu mod siparişi ödenmiş olarak işaretlemez.</p>}
      {liveObservation && !paid && <p className="border border-nrs-ink/15 p-4 text-sm leading-7">Kontrollü Production gözlem modu: banka sonucu belirsiz veya eşleştirmeleri henüz teyit edilmemiş olsa bile sipariş pending kalır. İmza ya da işlem eşleşmesi geçmezse de sipariş otomatik paid yapılmaz. Durum doğrulanmadan yeniden ödeme başlatmayın.</p>}
      {observation && paid && !diagnostic && <p className="border border-nrs-ink/15 p-4 text-sm leading-7">Bu sipariş için dönüş tanı kaydı bulunmuyor; imza ve banka sorgusu kanıtları bu ekranda gösterilemiyor.</p>}
      {diagnostic && <div className="space-y-2 border border-nrs-ink/15 p-4 text-sm">
        <p>Tanılama verisi: {diagnostic.association === 'verified' ? 'İmza ve işlem eşleşmeleri doğrulandı' : 'Güvenilmeyen / doğrulanmamış banka bildirimi'}</p>
        <p>mdstatus: {diagnostic.mdstatus ?? 'yok'} · response: {diagnostic.response ?? 'yok'} · procreturncode: {diagnostic.procreturncode ?? 'yok'}</p>
        <p>Dönüş imzası: {checked(diagnostic.signature_verified)} · Sipariş: {checked(diagnostic.order_match)} · Tutar: {checked(diagnostic.amount_match)} · Para birimi: {checked(diagnostic.currency_match)} · Terminal: {checked(diagnostic.terminal_match)} · İlk istek: {checked(diagnostic.request_match)}</p>
        {query && <div className="space-y-2"><p>Banka sorgusu: HTTP {query.http} · Status: {query.status ?? 'bilinmiyor'} · ChargeType: {query.charge_type ?? 'bilinmiyor'} · Code: {query.result_code ?? 'yok'}</p>
          <p>Sorgu kimliği: {checked(query.identity_match)} · Tutar: {checked(query.amount_match)} · Onay eşleşmesi: {checked(query.auth_match)}</p>
        </div>}
        {diagnostic.mderrormessage && <p>{diagnostic.mderrormessage}</p>}{diagnostic.errmsg && <p>{diagnostic.errmsg}</p>}
        {!diagnostic.error_text_signed && <p>Hata açıklamaları imzayla doğrulanmış kabul edilmez.</p>}
      </div>}
      {order && <>
        {canRenew && <form method="post" action="/api/payment/garanti/renew">
          <input type="hidden" name="orderId" value={order.id} />
          <button type="submit" className="min-h-11 border border-nrs-ink px-5 py-3 text-sm">Bankaya gönderilmemiş test bağlantısını yenile</button>
        </form>}
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
