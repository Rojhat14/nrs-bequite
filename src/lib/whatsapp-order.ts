import { formatMeasurements, type Measurements } from '@/lib/order-measurements'
export interface WhatsappOrderItem {
  id: string
  slug?: string
  name: string
  measurements?: Measurements
  size?: string
  quantity: number
  unitPrice: number
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
export function buildWhatsappOrderMessage(items: WhatsappOrderItem[], total?: number, customer?: OrderCustomer) {
  if (!items.length) return null
  const lines = ['Merhaba NRS,', items.length === 1
    ? 'Aşağıdaki ürün için sipariş vermek istiyorum.'
    : 'Aşağıdaki ürünler için sipariş vermek istiyorum.', '']
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name}`, `Ürün Kodu: ${item.id}`)
    lines.push(`Ürün Linki: https://nrsbequiteluminous.com/product/${encodeURIComponent(item.slug || item.id)}`)
    if (item.measurements && Object.keys(item.measurements).length) lines.push(`Ölçüler: ${formatMeasurements(item.measurements)}`)
    if (item.size) lines.push(`Beden: ${item.size}`)
    lines.push(`Adet: ${item.quantity}`, `Birim Fiyat: ${formatOrderPrice(item.unitPrice, item.currency)}`,
      `Ara toplam: ${formatOrderPrice(Math.round(item.unitPrice * 100) * item.quantity / 100, item.currency)}`, '')
  })
  const currencies = Array.from(new Set(items.map(item => item.currency || 'TRY')))
  if (currencies.length === 1) {
    const amount = total ?? items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity, 0) / 100
    lines.push(`Toplam: ${formatOrderPrice(amount, currencies[0])}`, '')
  }
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim()
  const details = [name && `Ad Soyad: ${name}`, customer?.phone && `Telefon: ${customer.phone}`, customer?.email && `E-posta: ${customer.email}`].filter(Boolean)
  if (details.length) lines.push('Müşteri:', ...details as string[], '')
  if (customer?.address) lines.push(`Teslimat: ${[customer.address, customer.district, customer.city].filter(Boolean).join(', ')}`)
  if (customer?.orderNote) lines.push(`Sipariş notu: ${customer.orderNote}`)
  if (customer?.orderId) lines.push(`Kayıtlı sipariş talebi: ${customer.orderId}`)
  lines.push('Ödeme yöntemi: Havale / EFT', '', 'Sipariş bilgilerimi ve IBAN bilgilerini paylaşabilir misiniz?', '', 'Teşekkürler.')
  return lines.join('\n')
}
