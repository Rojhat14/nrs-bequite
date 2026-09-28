import Link from 'next/link'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import AdminPagination from '@/components/admin/AdminPagination'
import { getOrderList, isMissingTable } from '@/lib/admin/data'
import { formatDate, formatMoney } from '@/lib/admin/types'

type SearchParams = { page?: string; q?: string; status?: string }
const statuses = ['pending', 'payment_pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const result = await getOrderList({ page: Number(searchParams.page) || 1, query: searchParams.q, status: searchParams.status })
  const params = new URLSearchParams()
  if (searchParams.q) params.set('q', searchParams.q)
  if (searchParams.status) params.set('status', searchParams.status)
  return <div className="mx-auto max-w-7xl">
    <AdminPageHeader title="Siparişler" description="Mevcut sipariş kayıtlarını görüntüleyin ve operasyonel durumlarını yönetin." />
    {isMissingTable(result.error) ? <AdminDatabaseState title="Sipariş tablosuna erişilemiyor" /> : <>
      {result.error && <p role="alert" className="mb-5 border border-rose-200 bg-white p-4 text-sm text-rose-800">Siparişler yüklenemedi. Admin okuma policy’si ve mevcut grants doğrulanmalıdır.</p>}
      <form method="get" className="mb-5 grid gap-3 border border-[#E4DED2] bg-white p-4 sm:grid-cols-[1fr_220px_auto]">
        <label className="sr-only" htmlFor="order-search">E-posta ile ara</label><input id="order-search" name="q" type="search" defaultValue={searchParams.q} placeholder="Müşteri e-postası ara" className="admin-field" />
        <label className="sr-only" htmlFor="order-status-filter">Durum</label><select id="order-status-filter" name="status" defaultValue={searchParams.status ?? ''} className="admin-field"><option value="">Tüm durumlar</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select>
        <button className="admin-secondary">Filtrele</button>
      </form>
      <div className="overflow-x-auto border border-[#E4DED2] bg-white">
        <table className="w-full min-w-[850px] border-collapse text-left">
          <thead className="bg-[#FAF9F6]"><tr className="border-b border-[#E4DED2] text-[9px] uppercase tracking-[0.14em] text-[#777165]"><th className="p-3">Sipariş ID</th><th className="p-3">Müşteri</th><th className="p-3">E-posta</th><th className="p-3">Tutar</th><th className="p-3">Durum</th><th className="p-3">Tarih</th><th className="p-3">Detay</th></tr></thead>
          <tbody className="divide-y divide-[#F0ECE5]">
            {result.orders.map((order) => <tr key={order.id} className="hover:bg-[#FAF9F6]"><td className="p-3 font-mono text-[10px]">{order.id.slice(0, 12)}…</td><td className="p-3 text-sm">{order.customer_name || 'Misafir'}</td><td className="p-3 text-xs">{order.customer_email || '—'}</td><td className="p-3 text-xs">{formatMoney(order.total_amount)}</td><td className="p-3"><AdminStatusBadge value={order.status} /></td><td className="p-3 text-xs">{formatDate(order.created_at)}</td><td className="p-3"><Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="text-xs text-[#6B5734] underline">Aç</Link></td></tr>)}
            {result.orders.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-sm text-[#9A9385]">Sipariş bulunamadı.</td></tr>}
          </tbody>
        </table>
      </div>
      <AdminPagination page={result.page} pageCount={result.pageCount} pathname="/admin/orders" query={params.toString()} />
      <p className="mt-3 text-xs text-[#9A9385]">{result.count} sipariş · misafir siparişleri de listelenir</p>
    </>}
  </div>
}
