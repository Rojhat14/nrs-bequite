import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminPagination from '@/components/admin/AdminPagination'
import InventoryTable from '@/components/admin/InventoryTable'
import { getInventoryRows, isMissingTable } from '@/lib/admin/data'
import { LOW_STOCK_THRESHOLD } from '@/lib/admin/config'

type SearchParams = { page?: string; filter?: string }

export default async function AdminInventoryPage({ searchParams: searchParamsPromise }: { searchParams: Promise<SearchParams> }) {
  const searchParams = await searchParamsPromise
  const page = Number(searchParams.page) || 1
  const result = await getInventoryRows({ page, filter: searchParams.filter })
  const filter = ['in-stock', 'low', 'out'].includes(searchParams.filter ?? '') ? searchParams.filter : ''
  const query = filter ? `filter=${filter}` : ''
  return <div className="mx-auto max-w-7xl">
    <AdminPageHeader title="Stok" description="Beden varyantlarının stok miktarlarını yönetin." />
    {isMissingTable(result.error) ? <AdminDatabaseState title="Varyant tablosu henüz kurulmamış" /> : <>
      {result.error && <p role="alert" className="mb-5 border border-rose-200 bg-white p-4 text-sm text-rose-800">Stok verisi yüklenemedi. Admin RLS izinlerini kontrol edin.</p>}
      <nav aria-label="Stok filtresi" className="mb-4 flex flex-wrap gap-2">
        {[[ '', 'Tümü' ], [ 'in-stock', 'Stokta' ], [ 'low', 'Düşük stok' ], [ 'out', 'Tükendi' ]].map(([value, label]) => <a key={value} href={value ? `/admin/inventory?filter=${value}` : '/admin/inventory'} aria-current={filter === value ? 'page' : undefined} className={`border px-3 py-2 text-xs ${filter === value ? 'border-[#B99A62] bg-[#F8F4EA] text-[#5D4929]' : 'border-[#E4DED2] bg-white text-[#777165]'}`}>{label}</a>)}
      </nav>
      <InventoryTable variants={result.variants} products={result.products} />
      <AdminPagination page={result.page} pageCount={result.pageCount} pathname="/admin/inventory" query={query} />
      <p className="mt-3 text-xs text-[#9A9385]">{result.count} varyant · düşük stok eşiği {LOW_STOCK_THRESHOLD} (başlangıç varsayılanı; kalıcı ayar henüz bağlı değil)</p>
    </>}
  </div>
}
