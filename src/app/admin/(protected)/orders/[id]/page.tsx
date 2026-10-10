import ManualTransferForm from '@/components/admin/ManualTransferForm'
import LegalOrderSummary from '@/components/legal/LegalOrderSummary'
import { isLegalOrderSummary } from '@/lib/legal/order-summary'
import OrderLegalDocuments from '@/components/legal/OrderLegalDocuments'
import { notFound } from 'next/navigation'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import OrderStatusForm from '@/components/admin/OrderStatusForm'
import { getOrderDetail, isMissingTable } from '@/lib/admin/data'
import { formatDate, formatMoney } from '@/lib/admin/types'

export default async function AdminOrderDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const data = await getOrderDetail(params.id)
  if (isMissingTable(data.error)) return <AdminDatabaseState title="Sipariş tablolarına erişilemiyor" />
  if (!data.order && !data.error) notFound()
  if (!data.order) return <p role="alert" className="border border-rose-200 bg-white p-5 text-sm text-rose-800">Sipariş yüklenemedi. Admin RLS policy ve grants ayarını kontrol edin.</p>
  const productMap = new Map(data.products.map((product) => [product.id, product.name]))
  if (data.legal && isLegalOrderSummary(data.legal.order_summary)) for (const item of data.legal.order_summary.items) productMap.set(item.productId,item.name)
  const order = data.order
  return <div className="mx-auto max-w-6xl">
    <AdminPageHeader title="Sipariş detayı" description={`Sipariş ${order.id}`} />
    <div className="mb-6 flex flex-wrap items-center gap-3"><AdminStatusBadge value={order.status} /><span className="text-xs text-[#8A8479]">Oluşturulma: {formatDate(order.created_at)}</span></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="border border-[#E4DED2] bg-white p-5"><h2 className="mb-4 font-serif text-xl">Müşteri</h2><dl className="space-y-3 text-sm"><Info label="Ad" value={order.customer_name} /><Info label="E-posta" value={order.customer_email} /><Info label="Telefon" value={order.customer_phone} /></dl><p className="mt-5 border-t border-[#EEE9DF] pt-4 text-[10px] text-[#9A9385]">{order.user_id ? `Hesap kullanıcısı · ${order.user_id}` : 'Misafir siparişi'}</p></section>
      <section className="border border-[#E4DED2] bg-white p-5"><h2 className="mb-4 font-serif text-xl">Teslimat</h2><dl className="space-y-3 text-sm"><Info label="Adres" value={order.shipping_address_full || order.shipping_address} /><Info label="Şehir" value={order.shipping_city} /><Info label="İlçe" value={order.shipping_district} /><Info label="Posta kodu" value={order.shipping_postal_code} /></dl></section>
      <section className="border border-[#E4DED2] bg-white p-5 lg:col-span-2"><h2 className="mb-4 font-serif text-xl">Sipariş kalemleri</h2><div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left"><thead><tr className="border-b border-[#EEE9DF] text-[9px] uppercase tracking-widest text-[#777165]"><th className="p-3">Ürün</th><th className="p-3">Product ID</th><th className="p-3">Adet</th><th className="p-3">Birim fiyat</th><th className="p-3">Ara toplam</th></tr></thead><tbody className="divide-y divide-[#F0ECE5]">{data.items.map((item) => <tr key={item.id}><td className="p-3 text-sm">{productMap.get(item.product_id) ?? 'Geçmiş katalog ürünü'}</td><td className="p-3 font-mono text-[10px]">{item.product_id}</td><td className="p-3 text-sm">{item.quantity}</td><td className="p-3 text-sm">{formatMoney(item.price_at_purchase)}</td><td className="p-3 text-sm">{formatMoney(Number(item.price_at_purchase) * item.quantity)}</td></tr>)}</tbody></table></div><div className="mt-5 flex flex-wrap justify-between gap-4 border-t border-[#EEE9DF] pt-4 text-sm"><span>Ödeme ID: {data.payment?.transactionId || order.payment_id || '—'}</span><strong>Toplam: {formatMoney(order.total_amount)}</strong></div></section>
      <section className="lg:col-span-2 space-y-3">
        {order.manual_paid_at && <p className="text-sm">Havale / EFT: yetkili tarafından teyit edildi · {formatDate(order.manual_paid_at)} · Referans: {order.manual_payment_reference}</p>}
        <p className="text-sm">Kart ödemesi: {data.payment?.state === 'paid' ? 'Banka tarafından doğrulanmış' : data.payment ? data.payment.state : 'Doğrulanmış ödeme kaydı yok'}</p>
        {data.legal && isLegalOrderSummary(data.legal.order_summary) && <>
          <LegalOrderSummary summary={data.legal.order_summary} />
          <p className="text-sm">Belge kabulü: {formatDate(data.legal.accepted_at)} · Sözleşme: {data.legal.contract_version} · Ön bilgilendirme: {data.legal.pre_information_version}</p>
        </>}
      </section>
      {data.payment && <p className="text-sm text-[#777165] lg:col-span-2">Ödeme kaydı durumu: {data.payment.state} · Sağlayıcı: {data.payment.provider}</p>}
      <section className="lg:col-span-2"><OrderLegalDocuments orderId={order.id} /></section>
      {order.manual_request_key && !order.manual_paid_at && order.status === 'pending' && !data.payment && <section className="lg:col-span-2"><ManualTransferForm orderId={order.id} amount={Number(order.total_amount)} /></section>}
      <section className="lg:col-span-2"><OrderStatusForm orderId={order.id} status={order.status} verifiedPayment={data.payment?.state === 'paid'} paymentState={data.payment?.state} /></section>
    </div>
  </div>
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="grid grid-cols-[120px_1fr] gap-3"><dt className="text-[#8A8479]">{label}</dt><dd className="break-words">{value || '—'}</dd></div>
}
