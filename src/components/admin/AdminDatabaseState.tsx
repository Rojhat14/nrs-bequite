import Link from 'next/link'

export default function AdminDatabaseState({ title = 'Veritabanı hazır değil', detail }: { title?: string; detail?: string }) {
  return (
    <section role="status" className="border border-[#E4DED2] bg-white p-6 sm:p-8">
      <p className="text-[9px] uppercase tracking-[0.3em] text-[#9A8358]">Kurulum gerekiyor</p>
      <h2 className="mt-3 font-serif text-2xl text-[#11110F]">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#777165]">
        {detail ?? 'Gerekli tablo veya yetki henüz hazır değil. İlgili Supabase migration’larını sırayla uygulayıp aktif admin kaydını oluşturun; mevcut ekran tekrar veri yükleyebilir.'}
      </p>
      <Link href="/admin/settings" className="mt-5 inline-flex border border-[#D8D0C3] px-4 py-2 text-xs text-[#5D4929] hover:bg-[#F8F4EA] focus:outline-none focus:ring-2 focus:ring-[#B99A62]">
        Kurulum bilgileri
      </Link>
    </section>
  )
}
