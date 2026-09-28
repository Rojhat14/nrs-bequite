import AdminPageHeader from '@/components/admin/AdminPageHeader'
import { DEFAULT_ADMIN_SETTINGS } from '@/lib/admin/config'

export default function AdminSettingsPage() {
  return <div className="mx-auto max-w-5xl">
    <AdminPageHeader title="Ayarlar" description="Mağaza yapılandırmasının ilk sürüm özeti." />
    <div className="grid gap-4 sm:grid-cols-2">
      <Setting label="Store name" value={DEFAULT_ADMIN_SETTINGS.storeName} />
      <Setting label="Currency" value={DEFAULT_ADMIN_SETTINGS.currency} />
      <Setting label="Low stock threshold" value={`${DEFAULT_ADMIN_SETTINGS.lowStockThreshold} adet`} />
      <Setting label="Default product status" value={DEFAULT_ADMIN_SETTINGS.defaultProductStatus} />
    </div>
    <p className="mt-5 border border-[#E4DED2] bg-white p-5 text-sm leading-6 text-[#777165]">Bu değerler şu an yalnızca başlangıç ayarı olarak gösterilir ve kaydedilmez. Kalıcı ayarlar için ayrı, gözden geçirilmiş bir migration gerekir; mevcut veritabanına bu aşamada ayar tablosu eklenmedi.</p>
  </div>
}

function Setting({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#E4DED2] bg-white p-5"><p className="text-[9px] uppercase tracking-widest text-[#777165]">{label}</p><p className="mt-3 font-serif text-xl">{value}</p></div>
}
