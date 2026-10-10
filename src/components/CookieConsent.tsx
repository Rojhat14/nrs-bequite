'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { readAdvertisingConsent, saveAdvertisingConsent } from '@/lib/cookie-consent'
export default function CookieConsent() {
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(readAdvertisingConsent() === null) }, [])
  function choose(allowed: boolean) { saveAdvertisingConsent(allowed); setOpen(false) }
  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-3 left-3 z-[160] min-h-11 border border-nrs-ink/20 bg-nrs-canvas px-4 text-xs shadow-sm">Çerez tercihleri</button>
    {open && <section aria-label="Çerez tercihleri" className="fixed inset-x-3 bottom-16 z-[160] mx-auto max-w-xl border border-nrs-ink/20 bg-nrs-canvas p-5 shadow-xl sm:p-7">
      <h2 className="font-serif text-xl">Çerez tercihleri</h2>
      <p className="mt-3 text-sm leading-6">Oturum ve sepet için gerekli kayıtlar kullanılır. İsteğe bağlı Meta Pixel, reklam ölçümü için yalnızca izninizle yüklenir. Kabul etmek alışveriş şartı değildir; tercihinizi daha sonra değiştirebilirsiniz.</p>
      <Link href="/gizlilik-politikasi" className="inline-flex min-h-11 items-center text-sm underline">Gizlilik ve çerez bilgileri</Link>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button onClick={() => choose(false)} className="min-h-11 border border-nrs-ink/30 px-4 py-3 text-sm">İsteğe bağlı çerezleri reddet</button>
        <button onClick={() => choose(true)} className="min-h-11 border border-nrs-ink/30 px-4 py-3 text-sm">Reklam çerezlerine izin ver</button>
      </div>
    </section>}
  </>
}
