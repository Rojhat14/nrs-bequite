import Link from 'next/link'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminPagination from '@/components/admin/AdminPagination'
import { getAdminUsers, isMissingTable } from '@/lib/admin/data'
import { displayName, formatDate } from '@/lib/admin/types'

type SearchParams = { page?: string; q?: string }

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const result = await getAdminUsers({ page: Number(searchParams.page) || 1, query: searchParams.q })
  const query = new URLSearchParams()
  if (searchParams.q) query.set('q', searchParams.q)
  return <div className="mx-auto max-w-7xl">
    <AdminPageHeader title="Kullanıcılar" description="Profiles tablosundaki müşteri kayıtları. Supabase Auth yönetici listesi kullanılmaz." />
    {isMissingTable(result.error) ? <AdminDatabaseState title="Profil tablosuna erişilemiyor" /> : <>
      {result.error && <p role="alert" className="mb-5 border border-rose-200 bg-white p-4 text-sm text-rose-800">Kullanıcılar yüklenemedi. Admin okuma policy’sini kontrol edin.</p>}
      <form method="get" className="mb-5 flex gap-3 border border-[#E4DED2] bg-white p-4"><label className="sr-only" htmlFor="user-search">E-posta ara</label><input id="user-search" name="q" type="search" defaultValue={searchParams.q} placeholder="E-posta ara" className="admin-field max-w-md" /><button className="admin-secondary">Ara</button></form>
      <div className="overflow-x-auto border border-[#E4DED2] bg-white"><table className="w-full min-w-[700px] text-left"><thead className="bg-[#FAF9F6]"><tr className="border-b border-[#E4DED2] text-[9px] uppercase tracking-widest text-[#777165]"><th className="p-3">Müşteri</th><th className="p-3">E-posta</th><th className="p-3">Telefon</th><th className="p-3">Kayıt tarihi</th><th className="p-3">Detay</th></tr></thead><tbody className="divide-y divide-[#F0ECE5]">{result.profiles.map((profile) => <tr key={profile.id}><td className="p-3 text-sm">{displayName(profile)}</td><td className="p-3 text-xs">{profile.email || '—'}</td><td className="p-3 text-xs">{profile.phone || '—'}</td><td className="p-3 text-xs">{formatDate(profile.created_at)}</td><td className="p-3"><Link href={`/admin/users/${encodeURIComponent(profile.id)}`} className="text-xs text-[#6B5734] underline">Aç</Link></td></tr>)}{result.profiles.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-sm text-[#9A9385]">Kullanıcı bulunamadı.</td></tr>}</tbody></table></div>
      <AdminPagination page={result.page} pageCount={result.pageCount} pathname="/admin/users" query={query.toString()} /><p className="mt-3 text-xs text-[#9A9385]">{result.count} profil</p>
    </>}
  </div>
}
