import type { LegalOrderSummary as Summary } from '@/lib/legal/order-summary'
import Link from 'next/link'
import Image from 'next/image'
import { formatMinor } from '@/lib/i18n/money'
import { formatLocalizedMeasurements } from '@/lib/i18n/measurements'

export default function LegalOrderSummary({ summary, preview = false }: { summary: Summary; preview?: boolean }) {
  const locale = summary.display?.locale || 'tr'
  const rate = summary.display?.currency === 'USD' && summary.display.exchangeRate && summary.display.exchangeRateAt
    ? { usdTry: summary.display.exchangeRate, fetchedAt: summary.display.exchangeRateAt, rateDate: summary.display.exchangeRateDate ?? undefined } : null
  const money = (amount: number) => summary.display
    ? formatMinor(Math.round(amount * 100 / (rate?.usdTry || 1)), locale, rate)
    : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: summary.currency }).format(amount)
  const storedMinor = (minor: number) => summary.display ? formatMinor(minor, locale, rate) : money(minor / 100)
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  return <section aria-label={copy('Sipariş özeti', 'Order summary', 'ملخص الطلب')} className="space-y-5 rounded-sm border border-nrs-ink/15 bg-nrs-panel p-4 sm:p-6 break-words">
    <h2 className="font-serif text-2xl">{preview ? copy('Sipariş ön bilgilendirme özeti', 'Preliminary order summary', 'ملخص معلومات الطلب الأولية') : copy('Sipariş özeti', 'Order summary', 'ملخص الطلب')}</h2>
    {summary.display?.currency === 'USD' && <p className="text-sm text-nrs-ink/65">{copy('USD tutarları sipariş sırasında kullanılan kura göre yaklaşık karşılıktır; tahsilat Türk lirası olarak yapılır.', 'USD amounts are approximate conversions using the rate recorded with this order; payment is collected in Turkish lira.', 'مبالغ الدولار تقديرية وفق سعر الصرف المسجل وقت الطلب؛ ويتم التحصيل بالليرة التركية.')}{summary.display.exchangeRateDate && <> · <bdi dir="ltr">1 USD = {summary.display.exchangeRate?.toFixed(4)} TRY · {summary.display.exchangeRateDate}</bdi></>}</p>}
    {preview && <p className="text-sm text-nrs-ink/65">{copy('Bu özet sipariş talebidir; ödeme veya kesin sipariş onayı değildir. Fiyat, stok ve teslimat bedeli sipariş teyidinde bildirilir.', 'This is an order request, not payment or final order confirmation. Price, stock and delivery charges are confirmed with the order.', 'هذا طلب شراء وليس دفعاً أو تأكيداً نهائياً. تُحدد الأسعار والتوفر ورسوم التوصيل عند تأكيد الطلب.')}</p>}
    <ul className="divide-y divide-nrs-ink/10">
      {summary.items.map((item, index) => <li key={`${item.productId}-${index}`} className="py-3 space-y-1 text-sm">
        {item.image && <Image unoptimized src={item.image} alt={item.name} width={80} height={100} className="h-24 w-20 object-cover" />}
        <p className="font-medium">{item.name}{item.size ? ` — ${copy('Beden', 'Size', 'المقاس')}: ${item.size}` : ''}</p>
        <p className="text-nrs-ink/65">{item.description}</p>
        {item.measurements && <p>{copy('Özel ölçüler', 'Custom measurements', 'المقاسات الخاصة')}: {formatLocalizedMeasurements(item.measurements, locale) || copy('Belirtilmedi', 'Not specified', 'غير محدد')}</p>}
        <p>{locale === 'tr'
          ? `${item.quantity} adet × ${money(item.unitPrice)} = ${money(Math.round(item.unitPrice * 100) * item.quantity / 100)}`
          : `${item.quantity} · ${storedMinor(summary.display?.itemLineMinor[index] ?? Math.round(item.unitPrice * 100) * item.quantity)}`}</p>
        <p className="text-xs text-nrs-ink/60">{copy('Ürün kodu', 'Product code', 'رمز المنتج')}: <bdi dir="ltr">{item.productId}</bdi></p>
        {preview && item.productId !== 'nrs-garanti-live-3try' && <Link href={`/product/${encodeURIComponent(item.productId)}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center underline underline-offset-4">{copy('Ürünün temel özelliklerini incele', 'View product details', 'عرض تفاصيل المنتج')}</Link>}
      </li>)}
    </ul>
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4"><dt>{copy('Ara toplam', 'Subtotal', 'المجموع الفرعي')}</dt><dd>{summary.display ? storedMinor(summary.display.subtotalMinor) : money(summary.subtotal)}</dd></div>
      <div className="flex justify-between gap-4"><dt>{copy('İndirim', 'Discount', 'الخصم')}</dt><dd>{summary.display ? storedMinor(summary.display.discountMinor) : money(summary.discount)}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt>{copy('Kargo / teslimat', 'Shipping / delivery', 'الشحن / التوصيل')}</dt><dd>{summary.shipping === null ? copy('Henüz belirlenmedi; sipariş teyidinde bildirilir', 'To be confirmed with the order', 'يُحدد عند تأكيد الطلب') : summary.display ? storedMinor(summary.display.shippingMinor) : money(summary.shipping)}</dd></div>
      <div className="flex justify-between gap-4 border-t border-nrs-ink/10 pt-2"><dt>{preview ? copy('Mevcut sepet toplamı', 'Current bag total', 'إجمالي الحقيبة الحالي') : copy('KDV dahil toplam', 'Total including VAT', 'الإجمالي شامل ضريبة القيمة المضافة')}</dt><dd>{summary.display ? storedMinor(summary.display.totalMinor) : money(summary.total)}</dd></div>
    </dl>
    {summary.display?.currency === 'USD' && <p className="text-xs text-nrs-ink/60">{copy('Garanti üzerinden tahsil edilecek tutar:', 'Amount to be charged by Garanti:', 'المبلغ الذي سيتم تحصيله عبر Garanti:')} <bdi dir="ltr">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(summary.total)}</bdi></p>}
    <div className="space-y-2 text-sm">
      {summary.orderNote && <p>{copy('Sipariş notu', 'Order note', 'ملاحظة الطلب')}: {summary.orderNote}</p>}
      <p>{copy('Ödeme yöntemi', 'Payment method', 'طريقة الدفع')}: {summary.paymentMethod}</p><p>{copy('Teslimat', 'Delivery', 'التوصيل')}: {summary.deliveryTerms}</p>
      {summary.orderedAt && <p>{copy('Sipariş tarihi', 'Order date', 'تاريخ الطلب')}: <bdi dir="ltr">{new Date(summary.orderedAt).toLocaleString(locale === 'ar' ? 'ar' : locale === 'en' ? 'en-US' : 'tr-TR', { timeZone: 'Europe/Istanbul' })}</bdi></p>}
      <p>{copy('Alıcı', 'Recipient', 'المستلم')}: {summary.buyer.name || copy('Henüz belirtilmedi', 'Not specified', 'غير محدد')}</p>
      {summary.buyer.email && <p>{copy('E-posta', 'Email', 'البريد الإلكتروني')}: <bdi dir="ltr">{summary.buyer.email}</bdi></p>}
      {summary.buyer.phone && <p>{copy('Telefon', 'Phone', 'الهاتف')}: <bdi dir="ltr">{summary.buyer.phone}</bdi></p>}
      <p>{copy('Teslimat adresi', 'Delivery address', 'عنوان التوصيل')}: {summary.buyer.address || copy('Henüz belirtilmedi', 'Not specified', 'غير محدد')}</p>
    </div>
  </section>
}
