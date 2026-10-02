import Link from 'next/link'
import { PRODUCTS } from '@/data/products'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminPagination from '@/components/admin/AdminPagination'
import { getFavorites, isMissingTable } from '@/lib/admin/data'
import type { ProductRow, ProfileRow } from '@/lib/admin/types'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { displayName, formatDate } from '@/lib/admin/types'

type SearchParams = { page?: string; product?: string; user?: string }

export default async function AdminFavoritesPage({ searchParams: searchParamsPromise }: { searchParams: Promise<SearchParams> }) {
  const searchParams = await searchParamsPromise
  const result = await getFavorites({ page: Number(searchParams.page) || 1, productId: searchParams.product, userId: searchParams.user })
  const supabase = await createSupabaseServerClient()
  const userIds = Array.from(new Set(result.favorites.map((favorite) => favorite.user_id)))
  const productIds = Array.from(new Set(result.favorites.map((favorite) => favorite.product_id)))
  const [profilesResult, productsResult] = await Promise.all([
    userIds.length ? supabase.from('profiles').select('*').in('id', userIds) : Promise.resolve({ data: [], error: null }),
    productIds.length ? supabase.from('products').select('*').in('id', productIds) : Promise.resolve({ data: [], error: null }),
  ])
  const profiles = new Map(((profilesResult.data ?? []) as unknown as ProfileRow[]).map((profile) => [profile.id, profile]))
  const products = new Map(((productsResult.data ?? []) as unknown as ProductRow[]).map((product) => [product.id, product.name]))
  const params = new URLSearchParams()
  if (searchParams.product) params.set('product', searchParams.product)
  if (searchParams.user) params.set('user', searchParams.user)
  return <div className="mx-auto max-w-7xl">
    <AdminPageHeader title="Favoriler" description="Mevcut wishlist kayıtlarını salt-okunur görüntüleyin." />
    {isMissingTable(result.error) ? <AdminDatabaseState title="Wishlist tablosuna erişilemiyor" /> : <>
      {result.error && <p role="alert" className="mb-5 border border-rose-200 bg-white p-4 text-sm text-rose-800">Favoriler yüklenemedi. Admin okuma policy’sini kontrol edin.</p>}
      <form method="get" className="mb-5 grid gap-3 border border-[#E4DED2] bg-white p-4 sm:grid-cols-[1fr_1fr_auto]"><label className="sr-only" htmlFor="favorite-product-filter">Product ID</label><input id="favorite-product-filter" name="product" defaultValue={searchParams.product} placeholder="Ürün ID" className="admin-field" /><label className="sr-only" htmlFor="favorite-user-filter">User ID</label><input id="favorite-user-filter" name="user" defaultValue={searchParams.user} placeholder="Kullanıcı ID" className="admin-field" /><button className="admin-secondary">Filtrele</button></form>
      <div className="overflow-x-auto border border-[#E4DED2] bg-white"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#FAF9F6]"><tr className="border-b border-[#E4DED2] text-[9px] uppercase tracking-widest text-[#777165]"><th className="p-3">Kullanıcı</th><th className="p-3">E-posta</th><th className="p-3">Ürün</th><th className="p-3">Product ID</th><th className="p-3">Eklenme</th></tr></thead><tbody className="divide-y divide-[#F0ECE5]">{result.favorites.map((favorite, index) => {
        const profile = profiles.get(favorite.user_id)
        const productName = products.get(favorite.product_id) ?? PRODUCTS.find((product) => product.id === favorite.product_id)?.name ?? 'Katalogda bulunamadı'
        return <tr key={favorite.id ?? `${favorite.user_id}-${favorite.product_id}-${index}`}><td className="p-3 text-sm"><Link href={`/admin/users/${encodeURIComponent(favorite.user_id)}`} className="underline">{displayName(profile)}</Link></td><td className="p-3 text-xs">{profile?.email || '—'}</td><td className="p-3 text-sm">{productName}</td><td className="p-3 font-mono text-[10px]">{favorite.product_id}</td><td className="p-3 text-xs">{formatDate(favorite.created_at)}</td></tr>
      })}{result.favorites.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-sm text-[#9A9385]">Favori kaydı bulunamadı.</td></tr>}</tbody></table></div>
      <AdminPagination page={result.page} pageCount={result.pageCount} pathname="/admin/favorites" query={params.toString()} /><p className="mt-3 text-xs text-[#9A9385]">{result.count} favori kaydı · mevcut wishlist kayıtları değiştirilmez</p>
    </>}
  </div>
}
