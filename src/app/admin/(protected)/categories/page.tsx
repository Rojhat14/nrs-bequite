import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import AdminCategoryManager from '@/components/admin/AdminCategoryManager'
import { getCategories, getCategoryProductCounts, isMissingTable } from '@/lib/admin/data'

export default async function AdminCategoriesPage() {
  const { data: categories, error } = await getCategories()
  const { counts, error: productsError } = await getCategoryProductCounts(categories.map((category) => category.id))
  return <div className="mx-auto max-w-7xl">
    <AdminPageHeader title="Kategoriler" description="Kategori adları, slug’lar ve katalog sırasını yönetin." />
    {isMissingTable(error) || isMissingTable(productsError) ? <AdminDatabaseState title="Katalog tabloları henüz kurulmamış" /> : <>
      {(error || productsError) && <p role="alert" className="mb-5 border border-rose-200 bg-white p-4 text-sm text-rose-800">Kategori veya ürün sayıları yüklenemedi. Admin RLS izinlerini kontrol edin.</p>}
      <AdminCategoryManager categories={categories} productCounts={counts} />
    </>}
  </div>
}
