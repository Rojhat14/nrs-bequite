import { formatMeasurements } from '@/lib/order-measurements'
import type { LegalOrderSummary as Summary } from '@/lib/legal/order-summary'
import Link from 'next/link'

export default function LegalOrderSummary({ summary, preview = false }: { summary: Summary; preview?: boolean }) {
  const money = (amount: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: summary.currency }).format(amount)
  return <section aria-label="Siparişe özgü bilgiler" className="space-y-5 rounded-sm border border-nrs-ink/15 bg-nrs-panel p-4 sm:p-6 break-words">
    <h2 className="font-serif text-2xl">{preview ? 'Sipariş ön bilgilendirme özeti' : 'Sipariş özeti'}</h2>
    {preview && <p className="text-sm text-nrs-ink/65">Bu özet sipariş talebidir; ödeme veya kesin sipariş onayı değildir. Fiyat, stok ve teslimat bedeli sipariş teyidinde bildirilir.</p>}
    <ul className="divide-y divide-nrs-ink/10">
      {summary.items.map((item, index) => <li key={`${item.productId}-${index}`} className="py-3 space-y-1 text-sm">
        {item.image && <img src={item.image} alt={item.name} width={80} height={100} className="h-24 w-20 object-cover" />}
        <p className="font-medium">{item.name}{item.size ? ` — Beden: ${item.size}` : ''}</p>
        <p className="text-nrs-ink/65">{item.description}</p>
        {item.measurements && <p>Özel ölçüler: {formatMeasurements(item.measurements) || 'Belirtilmedi'}</p>}
        <p>{item.quantity} adet × {money(item.unitPrice)} = {money(Math.round(item.unitPrice * 100) * item.quantity / 100)}</p>
        <p className="text-xs text-nrs-ink/60">Ürün kodu: {item.productId}</p>
        {preview && <Link href={`/product/${encodeURIComponent(item.productId)}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center underline underline-offset-4">Ürünün temel özelliklerini incele</Link>}
      </li>)}
    </ul>
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4"><dt>Ara toplam</dt><dd>{money(summary.subtotal)}</dd></div>
      <div className="flex justify-between gap-4"><dt>İndirim</dt><dd>{money(summary.discount)}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt>Kargo / teslimat</dt><dd>{summary.shipping === null ? 'Henüz belirlenmedi; sipariş teyidinde bildirilir' : money(summary.shipping)}</dd></div>
      <div className="flex justify-between gap-4 border-t border-nrs-ink/10 pt-2"><dt>{preview ? 'Mevcut sepet toplamı' : 'KDV dahil toplam'}</dt><dd>{money(summary.total)}</dd></div>
    </dl>
    <div className="space-y-2 text-sm">
      {summary.orderNote && <p>Sipariş notu: {summary.orderNote}</p>}
      <p>Ödeme yöntemi: {summary.paymentMethod}</p><p>Teslimat: {summary.deliveryTerms}</p>
      {summary.orderedAt && <p>Sipariş tarihi: {new Date(summary.orderedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>}
      <p>Alıcı: {summary.buyer.name || 'Henüz belirtilmedi'}</p>
      {summary.buyer.email && <p>E-posta: {summary.buyer.email}</p>}
      {summary.buyer.phone && <p>Telefon: {summary.buyer.phone}</p>}
      <p>Teslimat adresi: {summary.buyer.address || 'Henüz belirtilmedi'}</p>
    </div>
  </section>
}
