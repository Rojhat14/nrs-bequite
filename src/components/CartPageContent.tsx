'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ShoppingBag } from 'lucide-react'
import { useCart } from '@/store/useCart'
import { useLocale } from '@/context/LocaleContext'
import { localePrefix } from '@/lib/i18n/messages'

export default function CartPageContent() {
  const { items, openDrawer } = useCart()
  const { locale, t } = useLocale()
  const prefix = localePrefix(locale)
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  // The persisted bag is only known in the browser; render counts after mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); openDrawer() }, [openDrawer])
  const count = mounted ? items.reduce((sum, item) => sum + item.quantity, 0) : 0

  return <main className="flex min-h-[80svh] items-center justify-center bg-nrs-canvas px-6 pb-16 pt-[calc(var(--nrs-header-height,80px)+3rem)]">
    <div className="w-full max-w-md text-center">
      <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-nrs-panel text-nrs-ink/55"><ShoppingBag size={25} strokeWidth={1.4} aria-hidden="true" /></span>
      <h1 className="font-serif text-3xl text-nrs-ink md:text-4xl">{copy('Sepetiniz', 'Your bag', 'حقيبتك')}</h1>
      <p className="mt-3 text-sm leading-6 text-nrs-ink/60">
        {!mounted ? t('checkoutLoading') : count > 0 ? `${count} ${t('items')}` : t('bagEmptyBody')}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {mounted && count > 0 && <>
          <button type="button" onClick={openDrawer}
            className="flex min-h-12 w-full items-center justify-center rounded-sm border border-nrs-ink/25 px-4 text-sm text-nrs-ink hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {copy('Sepeti görüntüle', 'View bag', 'عرض الحقيبة')}
          </button>
          <Link href={`${prefix}/checkout`}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-nrs-charcoal px-4 text-sm font-medium text-nrs-ivory hover:bg-nrs-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {t('checkout')} <ArrowRight size={16} aria-hidden="true" className={locale === 'ar' ? 'rotate-180' : ''} />
          </Link>
        </>}
        <Link href={`${prefix}/collections`}
          className="mx-auto mt-2 inline-flex min-h-11 items-center gap-2 border-b border-nrs-ink pb-1 text-sm text-nrs-ink focus-visible:outline focus-visible:outline-2">
          {t('continueShopping')} <ArrowRight size={15} aria-hidden="true" className={locale === 'ar' ? 'rotate-180' : ''} />
        </Link>
      </div>
    </div>
  </main>
}
