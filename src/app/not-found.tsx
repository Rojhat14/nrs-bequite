'use client';

import React from 'react';
import Link from 'next/link';
import { m as motion } from 'framer-motion';
import { useLocale } from '@/context/LocaleContext'
import { localePrefix } from '@/lib/i18n/messages'
import { marketing } from '@/lib/i18n/marketing'

export default function NotFound() {
  const { locale } = useLocale()
  const prefix = localePrefix(locale)
  const t = (key: Parameters<typeof marketing>[1]) => marketing(locale, key)
  return (
    <div className="min-h-screen bg-nrs-canvas flex items-center justify-center p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl w-full text-center space-y-12"
      >
        <div className="space-y-4">
          <h1 className="text-6xl md:text-9xl font-serif text-nrs-ink">404</h1>
          <h2 className="text-2xl md:text-4xl font-serif text-nrs-ink italic">
            {t('notFoundTitle')}
          </h2>
          <p className="text-nrs-ink/60 font-sans leading-relaxed max-w-md mx-auto text-sm md:text-base">
            {t('notFoundBody')}
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <Link
            href={`${prefix}/`}
            className="px-10 py-4 bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory uppercase tracking-[0.3em] text-[10px] font-sans hover:bg-nrs-charcoal transition-all duration-700 w-full md:w-auto"
          >
            {t('notFoundHome')}
          </Link>
          <Link
            href={`${prefix}/category/elbiseler`}
            className="px-10 py-4 border border-nrs-ink text-nrs-ink uppercase tracking-[0.3em] text-[10px] font-sans hover:bg-nrs-black hover:text-nrs-ivory transition-all duration-700 w-full md:w-auto"
          >
            {t('notFoundShop')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
