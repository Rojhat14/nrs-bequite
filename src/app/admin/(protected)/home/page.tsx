import Link from 'next/link'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminCategoryManager from '@/components/admin/AdminCategoryManager'
import AdminProductForm from '@/components/admin/AdminProductForm'
import { getCategories, getCollections, getCategoryProductCounts, isMissingTable } from '@/lib/admin/data'
import { isHomeCategory } from '@/lib/home-category'
import { getHomeCategoryCover } from '@/lib/storage/category-covers'

export default async function AdminHomePage() {
  const { data: categories, error } = await getCategories()
  if (error) return <div className="mx-auto max-w-5xl">
    <AdminPageHeader title="Home / Nevresim" description="Nevresim ürünleri ve Home kategori görseli." />
    {isMissingTable(error) ? <AdminDatabaseState title="Katalog tabloları henüz kurulmamış" />
      : <p role="alert" className="border border-rose-200 bg-white p-4 text-sm text-rose-800">Kategoriler yüklenemedi. Lütfen tekrar deneyin.</p>}
  </div>
  const home = categories.find(isHomeCategory)
  const homeCoverUrl = await getHomeCategoryCover(home?.id ?? '')
  const { counts } = await getCategoryProductCounts(home ? [home.id] : [])
  const { data: collections, error: collectionError } = home?.is_active
    ? await getCollections() : { data: [], error: null }

  return <div className="mx-auto max-w-5xl">
    <AdminPageHeader title="Home / Nevresim" description="Home kategorisini oluşturun, nevresim ürünlerinizi ekleyin ve kategori fotoğrafını yönetin." />
    <AdminCategoryManager categories={home ? [home] : []} productCounts={counts} homeCoverUrl={homeCoverUrl} homeOnly />
    {home?.is_active && <section id="home-new-product" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Yeni nevresim ürünü</h2>
        <Link href={`/admin/products?category=${encodeURIComponent(home.id)}`} className="text-sm text-[#6B5734] underline">Home ürünlerini görüntüle</Link>
      </div>
      {collectionError && <p role="alert" className="border border-amber-200 bg-white p-4 text-sm text-amber-900">Koleksiyonlar yüklenemedi. Ürünü koleksiyon seçmeden kaydedebilirsiniz.</p>}
      <AdminProductForm categories={[home]} collections={collections} initialCategoryId={home.id} />
    </section>}
  </div>
}
