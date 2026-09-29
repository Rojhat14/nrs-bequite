import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminProductForm from '@/components/admin/AdminProductForm'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import { getCategories, getCollections, isMissingTable } from '@/lib/admin/data'

export default async function NewAdminProductPage() {
  const [{ data: categories, error: categoryError }, { data: collections, error: collectionError }] =
    await Promise.all([
      getCategories(),
      getCollections(),
    ])
  const error = categoryError ?? collectionError
  return <div className="mx-auto max-w-5xl">
    <AdminPageHeader title="Yeni ürün" description="Ürün kaydedildikten sonra görselleri ve varyant stoklarını ekleyebilirsiniz." />
    {isMissingTable(error) ? <AdminDatabaseState title="Katalog tabloları henüz kurulmamış" /> : <>
      {categoryError && <p role="alert" className="mb-5 border border-rose-200 bg-white p-4 text-sm text-rose-800">Kategoriler yüklenemedi; kategori seçimi kullanılamayabilir.</p>}
      {collectionError && <p role="alert" className="mb-5 border border-amber-200 bg-white p-4 text-sm text-amber-900">Koleksiyonlar yüklenemedi; koleksiyon seçimi kullanılamayabilir.</p>}
      <AdminProductForm categories={categories} collections={collections} />
    </>}
  </div>
}
