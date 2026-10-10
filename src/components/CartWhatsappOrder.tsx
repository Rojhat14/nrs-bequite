'use client'

import { type Item, parsePrice } from '@/store/useCart'
import { buildWhatsappOrderMessage, type OrderCustomer } from '@/lib/whatsapp-order'
import { whatsappUrl } from '@/lib/storefront-config'
import BankTransferInfo from '@/components/BankTransferInfo'
import Link from 'next/link'
import WhatsAppIcon from '@/components/WhatsAppIcon'

export default function CartWhatsappOrder({ items, total, customer }: { items: Item[]; total: number; customer?: OrderCustomer }) {
  if (!items.length) return null
  const message = buildWhatsappOrderMessage(items.map(item => ({
    id: item.id, slug: item.slug, name: item.title, size: item.size, measurements: item.measurements, quantity: item.quantity, unitPrice: parsePrice(item.price),
  })), total, customer)
  const href = whatsappUrl(message || undefined)
  return <div className="space-y-3">
    {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Sepetinizdeki ürünleri WhatsApp üzerinden sipariş verin"
      className="flex min-h-12 w-full items-center justify-center gap-3 bg-[#25D366] px-4 py-4 text-center text-xs uppercase tracking-widest text-nrs-ink transition-colors hover:bg-[#20bd5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      <WhatsAppIcon />
      WhatsApp&apos;tan Sipariş Ver
    </a> : <p role="status" className="text-sm text-nrs-ink/65">WhatsApp siparişi şu anda kullanılamıyor.</p>}
    <p className="text-xs leading-6 text-nrs-ink/65">Talebi tamamlamak için açılan WhatsApp ekranında mesajınızı gönderin. Bu işlem kart ödemesi veya kesin sipariş onayı değildir. Ürün, teslimat ve ödeme şartları sipariş teyidinde kesinleştirilir.</p>
    <p className="flex flex-wrap gap-x-4 gap-y-2 text-xs leading-6 text-nrs-ink/65">
      <Link className="underline" href="/mesafeli-satis-sozlesmesi">Mesafeli Satış Sözleşmesi</Link>
      <Link className="underline" href="/on-bilgilendirme-formu">Ön Bilgilendirme Formu</Link>
      <Link className="underline" href="/iade-ve-degisim">İade ve Değişim</Link>
      <Link className="underline" href="/kargo-ve-teslimat">Kargo ve Teslimat</Link>
    </p>
    <BankTransferInfo />
  </div>
}
