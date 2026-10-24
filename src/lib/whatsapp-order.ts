import type { Measurements } from '@/lib/order-measurements'
import { SHIPPING_MINOR } from '@/lib/delivery-policy'
import { allocateDisplayMinor, displayCurrency, type DisplayRate } from '@/lib/i18n/money'
import type { Locale } from '@/lib/i18n/messages'
import { formatLocalizedMeasurements } from '@/lib/i18n/measurements'
export interface WhatsappOrderItem {
  id: string
  slug?: string
  name: string
  measurements?: Measurements
  size?: string
  quantity: number
  unitPrice: number
  compareAtPrice?: number | null
  currency?: string
}

export interface OrderCustomer {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  district?: string
  orderNote?: string
  orderId?: string
}
export interface WhatsappDisplay { locale: Locale; rate: DisplayRate | null }

export function whatsappSelectionError({ requiresSize, selected, stock, quantity }: {
  requiresSize: boolean; selected: boolean; stock?: number; quantity: number
}) {
  if (requiresSize && !selected) return 'Lütfen beden seçiniz.'
  if (!Number.isInteger(quantity) || quantity < 1) return 'Lütfen geçerli bir adet seçiniz.'
  if (stock !== undefined && (stock < 1 || quantity > stock)) return 'Seçilen adet için yeterli stok bulunmuyor.'
  return null
}

export function formatOrderPrice(amount: number, currency = 'TRY') {
  return `${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${currency === 'TRY' ? 'TL' : currency}`
}

// Display estimates only: this message neither creates nor pays for an order.
export function buildWhatsappOrderMessage(items: WhatsappOrderItem[], _displayedTotal?: number, customer?: OrderCustomer, display: WhatsappDisplay = { locale: 'tr', rate: null }) {
  if (!items.length) return null
  const copy = (tr: string, en: string, ar: string) => display.locale === 'ar' ? ar : display.locale === 'en' ? en : tr
  const currency = displayCurrency(display.locale, display.rate)
  const displayMoney = (minor: number) => new Intl.NumberFormat(display.locale === 'ar' ? 'ar' : display.locale === 'en' ? 'en-US' : 'tr-TR', { style: 'currency', currency }).format(minor / 100)
  const lines = [copy('Merhaba NRS,', 'Hello NRS,', 'مرحباً NRS،'), items.length === 1
    ? copy('Aşağıdaki ürün için sipariş vermek istiyorum.', 'I would like to order the item below.', 'أرغب في طلب المنتج أدناه.')
    : copy('Aşağıdaki ürünler için sipariş vermek istiyorum.', 'I would like to order the items below.', 'أرغب في طلب المنتجات أدناه.'), '']
  items.forEach((item, index) => {
    const unitMinorTry = Math.round(item.unitPrice * 100)
    const unitMinorDisplay = allocateDisplayMinor([unitMinorTry], display.locale, display.rate)[0]
    const lineMinorDisplay = allocateDisplayMinor([unitMinorTry * item.quantity], display.locale, display.rate)[0]
    lines.push(`${index + 1}. ${item.name}`, `${copy('Ürün kodu', 'Product code', 'رمز المنتج')}: ${item.id}`)
    lines.push(`${copy('Ürün bağlantısı', 'Product link', 'رابط المنتج')}: https://nrsbequiteluminous.com${display.locale === 'tr' ? '' : `/${display.locale}`}/product/${encodeURIComponent(item.slug || item.id)}`)
    if (item.measurements && Object.keys(item.measurements).length) lines.push(`${copy('Ölçüler', 'Measurements', 'القياسات')}: ${formatLocalizedMeasurements(item.measurements, display.locale)}`)
    if (item.size) lines.push(`${copy('Beden', 'Size', 'المقاس')}: ${item.size}`)
    lines.push(`${copy('Adet', 'Quantity', 'الكمية')}: ${item.quantity}`, `${copy('Birim fiyat', 'Unit price', 'سعر الوحدة')}: ${displayMoney(unitMinorDisplay)}`,
      `${copy('Ara toplam', 'Line total', 'المجموع الفرعي')}: ${displayMoney(lineMinorDisplay)}`, '')
  })
  {
    const itemNormalLines = items.map(item => Math.round(item.unitPrice * 100) * item.quantity)
    const displayedSubtotalLines = allocateDisplayMinor(itemNormalLines, display.locale, display.rate)
    const displayedSaleLines = displayedSubtotalLines
    const displayedSubtotal = displayedSubtotalLines.reduce((sum, value) => sum + value, 0)
    const displayedSale = displayedSaleLines.reduce((sum, value) => sum + value, 0)
    const totalMinor = itemNormalLines.reduce((sum, value) => sum + value, 0) + SHIPPING_MINOR
    const displayedShipping = allocateDisplayMinor([SHIPPING_MINOR], display.locale, display.rate)[0]
    lines.push(`${copy('Ürünler toplamı', 'Products subtotal', 'إجمالي المنتجات')}: ${displayMoney(displayedSubtotal)}`)
    if (SHIPPING_MINOR > 0) lines.push(`${copy('Kargo', 'Shipping', 'الشحن')}: ${displayMoney(displayedShipping)}`)
    lines.push(`${copy('Ödenecek toplam', 'Total due', 'الإجمالي المستحق')}: ${displayMoney(displayedSale + displayedShipping)}`, '')
    if (currency === 'USD') lines.push(`${copy('Garanti BBVA üzerinden tahsil edilecek tutar', 'Amount charged by Garanti BBVA', 'المبلغ الذي سيتم تحصيله عبر Garanti BBVA')}: \u2066${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TRY', currencyDisplay: 'code' }).format(totalMinor / 100)}\u2069`,
      copy('USD tutarları kur karşılığıdır; tahsilat Türk lirası olarak yapılır.', 'USD amounts are exchange-rate equivalents; payment is collected in Turkish lira.', 'مبالغ الدولار تقديرية وفق سعر الصرف؛ ويُحصّل الدفع بالليرة التركية.'), '')
    else if (display.locale !== 'tr' && !display.rate) lines.push(copy('Güncel kur mevcut olmadığından tutarlar TRY gösterilmiştir.', 'Amounts are shown in TRY because a current exchange rate is unavailable.', 'تُعرض المبالغ بالليرة التركية لعدم توفر سعر صرف حديث.'), '')
  }
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim()
  const details = [name && `Ad Soyad: ${name}`, customer?.phone && `Telefon: ${customer.phone}`, customer?.email && `E-posta: ${customer.email}`].filter(Boolean)
  if (details.length) lines.push(copy('Müşteri:', 'Customer:', 'العميل:'), ...details as string[], '')
  if (customer?.address) lines.push(`${copy('Teslimat', 'Delivery', 'التوصيل')}: ${[customer.address, customer.district, customer.city].filter(Boolean).join(', ')}`)
  if (customer?.orderNote) lines.push(`${copy('Sipariş notu', 'Order note', 'ملاحظة الطلب')}: ${customer.orderNote}`)
  if (customer?.orderId) lines.push(`${copy('Kayıtlı sipariş talebi', 'Saved order request', 'طلب الشراء المسجل')}: ${customer.orderId}`)
  lines.push(`${copy('Ödeme yöntemi', 'Payment method', 'طريقة الدفع')}: ${copy('Havale / EFT', 'Bank transfer', 'تحويل بنكي')}`, '', copy('Sipariş bilgilerimi ve IBAN bilgilerini paylaşabilir misiniz?', 'Could you share the order details and bank transfer information?', 'هل يمكنكم إرسال تفاصيل الطلب ومعلومات التحويل البنكي؟'), '', copy('Teşekkürler.', 'Thank you.', 'شكراً لكِ.'))
  return lines.join('\n')
}
