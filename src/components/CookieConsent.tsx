'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { readAdvertisingConsent, saveAdvertisingConsent } from '@/lib/cookie-consent'
import { useLocale } from '@/context/LocaleContext'
import { localePrefix } from '@/lib/i18n/messages'
export default function CookieConsent() {
  const { locale, t } = useLocale()
  const prefix = localePrefix(locale)
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(readAdvertisingConsent() === null) }, [])
  function choose(allowed: boolean) { saveAdvertisingConsent(allowed); setOpen(false) }
  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-3 start-3 z-[160] min-h-11 border border-nrs-ink/20 bg-nrs-canvas px-4 text-xs shadow-sm">{t('consentTitle')}</button>
    {open && <section aria-label={t('consentTitle')} className="fixed inset-x-3 bottom-16 z-[160] mx-auto max-w-xl border border-nrs-ink/20 bg-nrs-canvas p-5 shadow-xl sm:p-7">
      <h2 className="font-serif text-xl">{t('consentTitle')}</h2>
      <p className="mt-3 text-sm leading-6">{copy('Oturum ve sepet için gerekli kayıtlar kullanılır. İsteğe bağlı Meta Pixel, reklam ölçümü için yalnızca izninizle yüklenir. Kabul etmek alışveriş şartı değildir; tercihinizi daha sonra değiştirebilirsiniz.', 'Essential storage supports your session and bag. The optional Meta Pixel is used for advertising measurement only with your consent. Consent is optional and can be changed later.', 'تُستخدم ملفات ضرورية للجلسة وحقيبة التسوق. ولا يُحمّل Meta Pixel الاختياري لقياس الإعلانات إلا بموافقتك. الموافقة اختيارية ويمكن تغييرها لاحقاً.')}</p>
      <Link href={`${prefix}/gizlilik-politikasi`} className="inline-flex min-h-11 items-center text-sm underline">{copy('Gizlilik ve çerez bilgileri', 'Privacy and cookie information', 'معلومات الخصوصية وملفات الارتباط')}</Link>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button onClick={() => choose(false)} className="min-h-11 border border-nrs-ink/30 px-4 py-3 text-sm">{copy('İsteğe bağlı çerezleri reddet', 'Reject optional cookies', 'رفض ملفات الارتباط الاختيارية')}</button>
        <button onClick={() => choose(true)} className="min-h-11 border border-nrs-ink/30 px-4 py-3 text-sm">{copy('Reklam çerezlerine izin ver', 'Allow advertising cookies', 'السماح بملفات ارتباط الإعلانات')}</button>
      </div>
    </section>}
  </>
}
