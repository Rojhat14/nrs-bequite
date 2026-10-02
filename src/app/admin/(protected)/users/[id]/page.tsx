import { notFound } from 'next/navigation'
import Link from 'next/link'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import { getAdminUserDetail, isMissingTable } from '@/lib/admin/data'
import { displayName, formatDate, formatMoney } from '@/lib/admin/types'

export default async function AdminUserDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const result = await getAdminUserDetail(params.id)
  if (isMissingTable(result.error)) return <AdminDatabaseState title="Müşteri tablolarına erişilemiyor" />
  if (!result.profile && !result.error) notFound()
  if (!result.profile) return <p role="alert" className="border border-rose-200 bg-white p-5 text-sm text-rose-800">Müşteri profili yüklenemedi. Admin RLS ayarını kontrol edin.</p>
  const profile = result.profile
  return <div className="mx-auto max-w-6xl">
    <AdminPageHeader title={displayName(profile)} description={profile.id} />
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Sipariş sayısı" value={result.orderCount === null ? '—' : String(result.orderCount)} />
      <Stat label="Toplam sipariş tutarı" value={result.totalOrderAmount === null ? '—' : formatMoney(result.totalOrderAmount)} />
      <Stat label="Favori sayısı" value={result.favoriteCount === null ? '—' : String(result.favoriteCount)} />
    </div>
    {result.summaryError && <p role="status" className="mt-4 border border-[#E4DED2] bg-white p-4 text-sm text-[#777165]">Özet sayıları için admin panel migration’ını uygulayın. Profil verisi okunabilir durumda.</p>}
    <section className="mt-6 border border-[#E4DED2] bg-white p-5"><h2 className="mb-4 font-serif text-xl">Profil</h2><dl className="grid gap-4 sm:grid-cols-2"><Info label="Ad" value={profile.first_name} /><Info label="Soyad" value={profile.last_name} /><Info label="E-posta" value={profile.email} /><Info label="Telefon" value={profile.phone} /><Info label="Kayıt tarihi" value={formatDate(profile.created_at)} /></dl></section>
    <section className="mt-6 border border-[#E4DED2] bg-white p-5"><h2 className="mb-4 font-serif text-xl">Son siparişler</h2>{result.orders.length ? <div className="divide-y divide-[#F0ECE5]">{result.orders.map((order) => <Link key={order.id} href={`/admin/orders/${encodeURIComponent(order.id)}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="font-mono text-xs">{order.id}</span><AdminStatusBadge value={order.status} /><span className="text-xs">{formatMoney(order.total_amount)}</span><span className="text-xs text-[#8A8479]">{formatDate(order.created_at)}</span></Link>)}</div> : <p className="text-sm text-[#9A9385]">Bu profilde sipariş bulunamadı.</p>}</section>
  </div>
}

function Stat({ label, value }: { label: string; value: string }) { return <article className="border border-[#E4DED2] bg-white p-5"><p className="text-[9px] uppercase tracking-widest text-[#777165]">{label}</p><p className="mt-4 font-serif text-2xl">{value}</p></article> }
function Info({ label, value }: { label: string; value: unknown }) { return <div><dt className="text-[9px] uppercase tracking-widest text-[#8A8479]">{label}</dt><dd className="mt-1 break-words text-sm">{typeof value === 'string' && value ? value : '—'}</dd></div> }
