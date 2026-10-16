import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminCategoryManager from '@/components/admin/AdminCategoryManager'
import { getCategories, getCategoryProductCounts, getCollections, isMissingTable } from '@/lib/admin/data'
import { isHomeCategory } from '@/lib/home-category'
import { getHomeCategoryCover } from '@/lib/storage/category-covers'

export default async function AdminCategoriesPage() {
  const { data: categories, error } = await getCategories()
  const { data: collections, error: collectionsError } = await getCollections()
  const { counts, error: productsError } = await getCategoryProductCounts(categories.map((category) => category.id))
  const homeCategory = categories.find(isHomeCategory)
  const homeCoverUrl = await getHomeCategoryCover(homeCategory?.id ?? '')
  return <div className="mx-auto max-w-7xl">
    <AdminPageHeader title="Kategoriler" description="Kategori adları, slug’lar ve katalog sırasını yönetin." />
    {isMissingTable(error) || isMissingTable(productsError) || isMissingTable(collectionsError) ? <AdminDatabaseState title="Katalog tabloları henüz kurulmamış" /> : <>
      {(error || productsError || collectionsError) && <p role="alert" className="mb-5 border border-rose-200 bg-white p-4 text-sm text-rose-800">Kategori, koleksiyon veya ürün sayıları yüklenemedi. Admin RLS izinlerini kontrol edin.</p>}
      <AdminCategoryManager categories={categories} collections={collections} productCounts={counts} homeCoverUrl={homeCoverUrl} />
    </>}
  </div>
}
