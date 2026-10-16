'use client'

import { type Item, parsePrice, useCart } from '@/store/useCart'
import { buildWhatsappOrderMessage, type OrderCustomer } from '@/lib/whatsapp-order'
import { whatsappUrl } from '@/lib/storefront-config'
import BankTransferInfo from '@/components/BankTransferInfo'
import Link from 'next/link'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import { useLocale } from '@/context/LocaleContext'

export default function CartWhatsappOrder({ items, total, customer, compact = false }: { items: Item[]; total: number; customer?: OrderCustomer; compact?: boolean }) {
  const { locale, rate } = useLocale()
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const catalogPricesSynced = useCart(state => state.catalogPricesSynced)
  const priceUpdateNotice = useCart(state => state.priceUpdateNotice)
  if (!items.length) return null
  const message = buildWhatsappOrderMessage(items.map(item => ({
    id: item.id, slug: item.slug, name: item.title, size: item.size, measurements: item.measurements, quantity: item.quantity, unitPrice: parsePrice(item.price), compareAtPrice: item.compareAtPrice == null ? null : Number(item.compareAtPrice),
  })), total, customer, { locale, rate })
  const href = whatsappUrl(message || undefined)
  if (!catalogPricesSynced) return <p role="status" className="text-xs text-nrs-ink/60">{copy('Sepet fiyatları güncel katalogdan kontrol ediliyor…', 'Checking current catalogue prices…', 'جارٍ التحقق من أسعار الكتالوج الحالية…')}</p>
  if (compact) return href ? <>
    {priceUpdateNotice && <p role="status" className="mb-2 text-xs text-nrs-ink/60">{copy('Sepetinizdeki ürün fiyatları güncellendi. Güncel toplamı kontrol edin.', 'Prices in your bag have changed. Please review the current total.', 'تغيرت أسعار المنتجات في حقيبتك. يُرجى مراجعة الإجمالي الحالي.')}</p>}
    <a href={href} target="_blank" rel="noopener noreferrer"
    aria-label={copy('WhatsApp üzerinden sipariş talebi gönderin', 'Send an order request via WhatsApp', 'أرسلي طلب شراء عبر واتساب')}
    className="inline-flex min-h-10 items-center gap-2 text-xs text-nrs-ink/60 underline decoration-nrs-ink/25 underline-offset-4 hover:text-nrs-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
    <WhatsAppIcon /> {copy('WhatsApp ile sipariş talebi', 'Order request via WhatsApp', 'طلب شراء عبر واتساب')}
    </a>
  </> : <p role="status" className="text-xs text-nrs-ink/60">WhatsApp siparişi şu anda kullanılamıyor.</p>
  return <div className="space-y-3">
    {priceUpdateNotice && <p role="status" className="text-xs text-nrs-ink/60">{copy('Sepetinizdeki ürün fiyatları güncellendi. Güncel toplamı kontrol edin.', 'Prices in your bag have changed. Please review the current total.', 'تغيرت أسعار المنتجات في حقيبتك. يُرجى مراجعة الإجمالي الحالي.')}</p>}
    {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={copy('Sepetinizdeki ürünler için WhatsApp üzerinden sipariş talebi gönderin', 'Send an order request for your bag via WhatsApp', 'أرسلي طلباً للمنتجات في حقيبتك عبر واتساب')}
      className="flex min-h-12 w-full items-center justify-center gap-3 bg-[#25D366] px-4 py-4 text-center text-xs uppercase tracking-widest text-nrs-ink transition-colors hover:bg-[#20bd5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      <WhatsAppIcon />
      {copy('WhatsApp ile sipariş talebi', 'Request via WhatsApp', 'طلب عبر واتساب')}
    </a> : <p role="status" className="text-sm text-nrs-ink/65">{copy('WhatsApp siparişi şu anda kullanılamıyor.', 'WhatsApp ordering is currently unavailable.', 'الطلب عبر واتساب غير متاح حالياً.')}</p>}
    <p className="text-xs leading-6 text-nrs-ink/65">{copy('Talebi tamamlamak için açılan WhatsApp ekranında mesajınızı gönderin. Bu işlem kart ödemesi veya kesin sipariş onayı değildir. Ürün, teslimat ve ödeme şartları sipariş teyidinde kesinleştirilir.', 'Send your message in the WhatsApp window to complete the request. This does not take a card payment or confirm an order. Product, delivery and payment terms are confirmed with the order.', 'أرسلي رسالتك في نافذة واتساب لإكمال الطلب. لا تتم بهذه الخطوة عملية دفع بالبطاقة ولا تأكيد نهائي للطلب. تُحدد تفاصيل المنتجات والتوصيل والدفع عند تأكيد الطلب.')}</p>
    <p className="flex flex-wrap gap-x-4 gap-y-2 text-xs leading-6 text-nrs-ink/65">
      <Link className="underline" href="/mesafeli-satis-sozlesmesi">{copy('Mesafeli Satış Sözleşmesi', 'Distance Sales Agreement', 'اتفاقية البيع عن بُعد')}</Link>
      <Link className="underline" href="/on-bilgilendirme-formu">{copy('Ön Bilgilendirme Formu', 'Preliminary Information Form', 'نموذج المعلومات المسبقة')}</Link>
      <Link className="underline" href="/iade-ve-degisim">{copy('İade ve Değişim', 'Returns and exchanges', 'الإرجاع والاستبدال')}</Link>
      <Link className="underline" href="/kargo-ve-teslimat">{copy('Kargo ve Teslimat', 'Shipping and delivery', 'الشحن والتوصيل')}</Link>
    </p>
    <BankTransferInfo />
  </div>
}
