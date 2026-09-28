import Link from 'next/link'
import Image from 'next/image'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import { getDashboardData, isMissingTable } from '@/lib/admin/data'
import { formatDate, formatMoney } from '@/lib/admin/types'
import { LOW_STOCK_THRESHOLD } from '@/lib/admin/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getProductImageUrl } from '@/lib/storage/products'

const cards = [
  { key: 'products', label: 'Toplam ürün', href: '/admin/products' },
  { key: 'activeProducts', label: 'Aktif ürün', href: '/admin/products?status=active' },
  { key: 'lowStock', label: `Düşük stok (1–${LOW_STOCK_THRESHOLD})`, href: '/admin/inventory?filter=low' },
  { key: 'orders', label: 'Toplam sipariş', href: '/admin/orders' },
  { key: 'pendingOrders', label: 'Bekleyen sipariş', href: '/admin/orders?status=pending' },
  { key: 'users', label: 'Toplam kullanıcı', href: '/admin/users' },
  { key: 'favorites', label: 'Toplam favori', href: '/admin/favorites' },
] as const

export default async function AdminDashboardPage() {
  const data = await getDashboardData()
  const supabase = await createSupabaseServerClient()

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader title="Dashboard" description="NRS mağazasının bugünkü özeti." />
      {data.catalogMissing && <div className="mb-6"><AdminDatabaseState title="Ürün kataloğu migration bekliyor" detail="Ürün, kategori, görsel ve varyant tabloları hazır olduğunda katalog kartları gerçek verilerle çalışacaktır." /></div>}
      {data.hasErrors && !data.catalogMissing && <p role="status" className="mb-6 border border-[#E4DED2] bg-white px-4 py-3 text-sm text-[#777165]">Bazı istatistikler mevcut RLS veya veritabanı kurulumu nedeniyle yüklenemedi.</p>}

      <section aria-label="Mağaza istatistikleri" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ key, label, href }) => {
          const value = data.counts[key]
          return (
            <Link key={key} href={href} className="min-h-32 border border-[#E4DED2] bg-white p-5 transition hover:border-[#C7B58F] focus:outline-none focus:ring-2 focus:ring-[#B99A62]">
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#777165]">{label}</span>
              <span className="mt-5 block font-serif text-3xl text-[#11110F]">{value ?? '—'}</span>
              <span className="mt-2 block text-[10px] text-[#9A9385]">{value === null ? 'Bağlantı bekleniyor' : 'Detayları görüntüle'}</span>
            </Link>
          )
        })}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="border border-[#E4DED2] bg-white">
          <div className="flex items-center justify-between border-b border-[#EEE9DF] px-5 py-4">
            <div><p className="text-[9px] uppercase tracking-[0.24em] text-[#9A8358]">Son hareketler</p><h2 className="mt-1 font-serif text-xl">Son siparişler</h2></div>
            <Link href="/admin/orders" className="text-xs text-[#76613D] hover:underline">Tüm siparişler</Link>
          </div>
          {data.orders.length ? <div className="divide-y divide-[#F0ECE5]">
            {data.orders.map((order) => <Link key={order.id} href={`/admin/orders/${encodeURIComponent(order.id)}`} className="grid grid-cols-[1fr_auto] gap-3 px-5 py-4 hover:bg-[#FAF9F6] sm:grid-cols-[1fr_1.2fr_auto_auto] sm:items-center">
              <span className="font-mono text-[10px] text-[#777165]">{order.id.slice(0, 8)}…</span>
              <span className="truncate text-xs text-[#25231F]">{order.customer_name || 'Misafir'} <span className="block truncate text-[10px] text-[#9A9385]">{order.customer_email || 'E-posta yok'}</span></span>
              <AdminStatusBadge value={order.status} />
              <span className="text-right text-xs">{formatMoney(order.total_amount)}</span>
              <span className="col-span-2 text-[10px] text-[#9A9385] sm:col-span-4">{formatDate(order.created_at)}</span>
            </Link>)}
          </div> : <p className="px-5 py-9 text-center text-sm text-[#9A9385]">Henüz görüntülenebilir sipariş yok.</p>}
        </section>

        <section className="border border-[#E4DED2] bg-white">
          <div className="flex items-center justify-between border-b border-[#EEE9DF] px-5 py-4">
            <div><p className="text-[9px] uppercase tracking-[0.24em] text-[#9A8358]">Katalog</p><h2 className="mt-1 font-serif text-xl">Yeni eklenen ürünler</h2></div>
            <Link href="/admin/products" className="text-xs text-[#76613D] hover:underline">Kataloğa git</Link>
          </div>
          {data.products.length ? <div className="divide-y divide-[#F0ECE5]">
            {data.products.map((product) => {
              const imageUrl = getProductImageUrl(supabase, product.image)
              return <Link key={product.id} href={`/admin/products/${encodeURIComponent(product.id)}`} className="flex items-center gap-4 px-5 py-3 hover:bg-[#FAF9F6]">
                {imageUrl ? <Image src={imageUrl} alt={product.image?.alt_text || product.name} width={48} height={56} unoptimized className="h-14 w-12 bg-[#F2F0EB] object-cover" /> : <div className="h-14 w-12 bg-[#F2F0EB]" aria-label="Görsel yok" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{product.name}</span><span className="mt-1 block truncate text-[10px] text-[#9A9385]">{product.category_name} · {product.id}</span></span>
                <span className="hidden text-right sm:block"><span className="block text-xs">{formatMoney(product.price_amount, product.currency)}</span><span className="mt-1 block"><AdminStatusBadge value={product.status} /></span></span>
              </Link>
            })}
          </div> : <p className="px-5 py-9 text-center text-sm text-[#9A9385]">Ürün bulunamadı.</p>}
        </section>
      </div>
    </div>
  )
}
