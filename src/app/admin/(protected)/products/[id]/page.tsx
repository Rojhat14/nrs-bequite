import { notFound } from 'next/navigation'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminProductForm from '@/components/admin/AdminProductForm'
import AdminDatabaseState from '@/components/admin/AdminDatabaseState'
import { getProductEditorData, isMissingTable } from '@/lib/admin/data'

export default async function AdminProductDetailPage({ params }: { params: { id: string } }) {
  const data = await getProductEditorData(params.id)
  if (isMissingTable(data.error)) return <AdminDatabaseState title="Katalog tabloları henüz kurulmamış" />
  if (!data.product && !data.error) notFound()
  return <div className="mx-auto max-w-5xl">
    <AdminPageHeader title={data.product?.name ?? 'Ürün düzenle'} description={`Ürün ID: ${params.id}`} />
    {data.error && <p role="alert" className="mb-5 border border-rose-200 bg-white p-4 text-sm text-rose-800">Ürün bilgileri yüklenirken hata oluştu. Tablo ve admin RLS izinlerini kontrol edin.</p>}
    {data.product && <AdminProductForm product={data.product} categories={data.categories} variants={data.variants} />}
  </div>
}
