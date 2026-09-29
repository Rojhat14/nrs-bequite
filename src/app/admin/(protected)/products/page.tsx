import Link from 'next/link'
import Image from 'next/image'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import AdminPagination from '@/components/admin/AdminPagination'
import DuplicateProductButton from '@/components/admin/DuplicateProductButton'
import { getProductList, isMissingTable } from '@/lib/admin/data'
import { formatDate, formatMoney } from '@/lib/admin/types'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getProductImageUrl } from '@/lib/storage/products'

type SearchParams = { page?: string; q?: string; category?: string; status?: string }

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Number(searchParams.page) || 1
  const result = await getProductList({ page, query: searchParams.q, category: searchParams.category, status: searchParams.status })
  const supabase = await createSupabaseServerClient()
  const categoryNames = new Map(result.categories.map((category) => [category.id, category.name]))
  const query = new URLSearchParams()
  if (searchParams.q) query.set('q', searchParams.q)
  if (searchParams.category) query.set('category', searchParams.category)
  if (searchParams.status) query.set('status', searchParams.status)
  const queryString = query.toString()

  return <div className="mx-auto max-w-7xl">
    <AdminPageHeader title="Ürünler" description="Katalog ürünlerini ara, filtrele ve düzenle." action={<Link href="/admin/products/new" className="admin-primary inline-flex items-center">Yeni ürün</Link>} />
    {isMissingTable(result.error) && <AdminDatabaseState title="Ürün tabloları henüz kurulmamış" />}
    {result.error && !isMissingTable(result.error) && <p role="alert" className="mb-5 border border-rose-200 bg-white p-4 text-sm text-rose-800">Ürün listesi yüklenemedi. Admin RLS ve tablo yetkilerini kontrol edin.</p>}

    <form method="get" className="mb-5 grid gap-3 border border-[#E4DED2] bg-white p-4 sm:grid-cols-4">
      <label className="sr-only" htmlFor="product-search">Ürün ara</label><input id="product-search" name="q" defaultValue={searchParams.q} placeholder="Ürün adı ara" className="admin-field" />
      <label className="sr-only" htmlFor="product-category-filter">Kategori</label><select id="product-category-filter" name="category" defaultValue={searchParams.category ?? ''} className="admin-field"><option value="">Tüm kategoriler</option>{result.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <label className="sr-only" htmlFor="product-status-filter">Durum</label><select id="product-status-filter" name="status" defaultValue={searchParams.status ?? ''} className="admin-field"><option value="">Tüm durumlar</option><option value="active">Aktif</option><option value="draft">Taslak</option><option value="archived">Arşivlendi</option></select>
      <button className="admin-secondary">Filtrele</button>
    </form>

    <div className="overflow-x-auto border border-[#E4DED2] bg-white">
      <table className="w-full min-w-[1050px] border-collapse text-left">
        <thead className="bg-[#FAF9F6]"><tr className="border-b border-[#E4DED2] text-[9px] uppercase tracking-[0.14em] text-[#777165]"><th className="p-3">Görsel</th><th className="p-3">Ürün / ID</th><th className="p-3">Kategori</th><th className="p-3">Fiyat</th><th className="p-3">Durum</th><th className="p-3">Stok</th><th className="p-3">Güncellendi</th><th className="p-3">İşlem</th></tr></thead>
        <tbody className="divide-y divide-[#F0ECE5]">
          {result.products.map((product) => {
            const image = result.images.find((row) => row.product_id === product.id && row.is_primary) ?? result.images.find((row) => row.product_id === product.id)
            const imageUrl = getProductImageUrl(supabase, image)
            return <tr key={product.id} className="hover:bg-[#FAF9F6]">
              <td className="p-3">{imageUrl ? <Image src={imageUrl} alt={image?.alt_text ?? product.name} width={48} height={56} unoptimized className="h-14 w-12 object-cover" /> : <div className="h-14 w-12 bg-[#F2F0EB]" />}</td>
              <td className="p-3"><Link href={`/admin/products/${encodeURIComponent(product.id)}`} className="text-sm hover:underline">{product.name}</Link><span className="mt-1 block font-mono text-[10px] text-[#9A9385]">{product.id}</span></td>
              <td className="p-3 text-xs">{product.category_id ? categoryNames.get(product.category_id) ?? '—' : '—'}</td>
              <td className="p-3 text-xs">{formatMoney(product.price_amount, product.currency)}</td>
              <td className="p-3"><AdminStatusBadge value={product.status} /></td>
              <td className="p-3 text-xs">{(result.stockByProduct.get(product.id) ?? 0) > 0 ? `${result.stockByProduct.get(product.id)} adet` : 'Tükendi / varyant yok'}</td>
              <td className="p-3 text-xs text-[#777165]">{formatDate(product.updated_at)}</td>
              <td className="p-3 whitespace-nowrap"><Link href={`/admin/products/${encodeURIComponent(product.id)}`} className="text-xs text-[#6B5734] underline underline-offset-4">Düzenle</Link><DuplicateProductButton productId={product.id} /></td>
            </tr>
          })}
          {result.products.length === 0 && !result.error && <tr><td colSpan={8} className="p-12 text-center text-sm text-[#9A9385]">Filtrelere uygun ürün yok.</td></tr>}
        </tbody>
      </table>
    </div>
    <AdminPagination page={result.page} pageCount={result.pageCount} pathname="/admin/products" query={queryString} />
    <p className="mt-3 text-xs text-[#9A9385]">{result.count} ürün</p>
  </div>
}
