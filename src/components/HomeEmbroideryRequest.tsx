'use client'

import { useState } from 'react'
import { whatsappUrl } from '@/lib/storefront-config'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import { useLocale } from '@/context/LocaleContext'
import { marketing } from '@/lib/i18n/marketing'

export default function HomeEmbroideryRequest() {
  const { locale } = useLocale()
  const t = (key: Parameters<typeof marketing>[1]) => marketing(locale, key)
  const [note, setNote] = useState('')
  const href = whatsappUrl([
    t('embroideryMessage'),
    note.trim() ? `${t('embroideryNotePrefix')}: ${note.trim()}` : '',
  ].filter(Boolean).join('\n\n'))

  return (
    <section id="nakis-talebi" aria-labelledby="nakis-baslik" className="scroll-mt-32 border-b border-nrs-ink/10 bg-nrs-panel" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-2 md:gap-16 md:py-16">
        <div>
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-nrs-ink/65">{t('embroideryEyebrow')}</p>
          <h2 id="nakis-baslik" className="text-3xl font-serif leading-tight md:text-4xl">{t('embroideryTitle')}</h2>
          <p className="mt-5 max-w-lg leading-7 text-nrs-ink/75">{t('embroideryIntro')}</p>
          <p className="mt-4 max-w-lg text-sm leading-7 text-nrs-ink/65">{t('embroideryDetails')}</p>
          <p className="mt-6 text-sm leading-6 text-nrs-ink/65">{t('embroideryEstimate')}</p>
        </div>
        <div className="border border-nrs-ink/15 bg-nrs-canvas p-6 md:p-8">
          <label htmlFor="nakis-notu" className="block font-serif text-2xl">{t('embroideryLabel')}</label>
          <p id="nakis-yardim" className="mt-2 text-sm leading-6 text-nrs-ink/65">{t('embroideryHelp')}</p>
          <textarea id="nakis-notu" value={note} onChange={event => setNote(event.target.value)} maxLength={1500} rows={5}
            aria-describedby="nakis-yardim nakis-gonderim" placeholder={t('embroideryPlaceholder')}
            className="mt-5 w-full resize-y border border-nrs-ink/25 bg-transparent p-4 text-base leading-6 placeholder:text-nrs-ink/45 focus:outline-none focus:ring-2 focus:ring-nrs-ink" />
          {href ? <a href={href} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-3 bg-nrs-ink px-5 py-3 text-center text-sm text-nrs-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            <WhatsAppIcon />{note.trim() ? t('embroiderySendNote') : t('embroideryAsk')}
          </a> : <p role="status" className="mt-4 text-sm">{t('embroideryUnavailable')}</p>}
          <p id="nakis-gonderim" className="mt-4 text-xs leading-6 text-nrs-ink/65">{t('embroideryDisclaimer')}</p>
        </div>
      </div>
    </section>
  )
}
