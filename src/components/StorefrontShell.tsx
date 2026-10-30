'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import CartDrawer from '@/components/CartDrawer'
import CartPriceSync from '@/components/CartPriceSync'
import Navigation from '@/components/Navigation'
import LanguageSelector from '@/components/LanguageSelector'
import { useLocale } from '@/context/LocaleContext'
import { localePrefix } from '@/lib/i18n/messages'
import { StorefrontCatalogProvider, type StorefrontNavCategory, type StorefrontNavCollection } from '@/context/StorefrontCatalogContext'

export default function StorefrontShell({ children, categories, collections, footer }: { children: React.ReactNode; categories: StorefrontNavCategory[]; collections: StorefrontNavCollection[]; footer: ReactNode }) {
  const pathname = usePathname() || '/'
  const { locale, t } = useLocale()
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
  const isCheckoutRoute = /^\/(?:en\/|ar\/)?checkout(?:\/|$)/.test(pathname)

  if (isAdminRoute) return <>{children}</>

  if (isCheckoutRoute) return (
    <StorefrontCatalogProvider value={{ categories, collections }}>
      <div style={{ '--nrs-header-height': '64px' } as CSSProperties} className="min-h-screen bg-nrs-canvas">
        <header className="border-b border-nrs-ink/10 bg-nrs-warm-white">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link href={`${localePrefix(locale)}/cart`} className="inline-flex min-h-11 items-center gap-2 text-sm text-nrs-ink/70 underline-offset-4 hover:underline">
              <ArrowLeft aria-hidden="true" size={16} className={locale === 'ar' ? 'rotate-180' : ''} /><span>{t('cart')}</span>
            </Link>
            <Link href={localePrefix(locale) || '/'} aria-label="NRS Bequite Luminous" className="shrink-0">
              <Image src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png" alt="NRS Bequite Luminous" width={125} height={50} priority className="h-10 w-auto object-contain" />
            </Link>
            <LanguageSelector className="shrink-0" />
          </div>
        </header>
        <CartPriceSync />
        {children}
        <footer className="border-t border-nrs-ink/10 bg-nrs-warm-white px-4 py-4 text-center text-xs text-nrs-ink/65">
          <nav aria-label={t('help')} className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link href={`${localePrefix(locale)}/kvkk`} className="min-h-9 inline-flex items-center underline underline-offset-2">{t('privacyNotice')}</Link>
            <Link href={`${localePrefix(locale)}/gizlilik-politikasi`} className="min-h-9 inline-flex items-center underline underline-offset-2">{t('privacyPolicy')}</Link>
            <Link href={`${localePrefix(locale)}/kargo-ve-teslimat`} className="min-h-9 inline-flex items-center underline underline-offset-2">{t('delivery')}</Link>
          </nav>
        </footer>
      </div>
    </StorefrontCatalogProvider>
  )

  return (
    <StorefrontCatalogProvider value={{ categories, collections }}>
      <Navigation introFinished={true} />
      <CartPriceSync />
      {children}
      {footer}
      <CartDrawer />
    </StorefrontCatalogProvider>
  )
}
