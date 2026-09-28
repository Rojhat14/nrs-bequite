'use client'

export default function AdminRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="mx-auto max-w-2xl border border-[#E4DED2] bg-white p-8 text-center">
    <p className="text-[9px] uppercase tracking-[0.3em] text-[#9A8358]">NRS Admin</p>
    <h1 className="mt-3 font-serif text-2xl">Bu ekran yüklenemedi</h1>
    <p className="mt-3 text-sm text-[#777165]">Bağlantı veya yetki sorunu olabilir. Hassas sunucu hataları bu ekranda gösterilmez.</p>
    <button type="button" onClick={reset} className="admin-primary mt-6">Tekrar dene</button>
  </section>
}
