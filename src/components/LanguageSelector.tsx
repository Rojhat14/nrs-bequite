'use client'

import { useLocale } from '@/context/LocaleContext'
import type { Locale } from '@/lib/i18n/messages'

const choices: Array<{ locale: Locale; label: string }> = [
  { locale: 'tr', label: 'TR' }, { locale: 'en', label: 'EN' }, { locale: 'ar', label: 'العربية' },
]

export default function LanguageSelector({ className = '' }: { className?: string }) {
  const { locale, t } = useLocale()
  const changeLanguage = (target: Locale) => {
    const current = new URL(window.location.href)
    const path = current.pathname.replace(/^\/(?:en|ar)(?=\/|$)/, '') || '/'
    document.cookie = `nrs-locale=${target}; Path=/; Max-Age=31536000; SameSite=Lax${current.protocol === 'https:' ? '; Secure' : ''}`
    current.pathname = target === 'tr' ? path : `/${target}${path === '/' ? '' : path}`
    window.location.assign(current.toString())
  }
  return <div role="group" aria-label={t('language')} className={`inline-flex items-center gap-1 ${className}`}>
    {choices.map(choice => <button key={choice.locale} type="button" lang={choice.locale}
      aria-current={choice.locale === locale ? 'true' : undefined}
      aria-label={choice.locale === 'ar' ? 'العربية' : choice.locale === 'en' ? 'English' : 'Türkçe'}
      onClick={() => changeLanguage(choice.locale)}
      className={`min-h-9 rounded-sm px-2 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${choice.locale === locale ? 'bg-nrs-ink text-nrs-canvas' : 'text-nrs-ink/65 hover:bg-nrs-ink/5 hover:text-nrs-ink'}`}>
      {choice.label}
    </button>)}
  </div>
}
