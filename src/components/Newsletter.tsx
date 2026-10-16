'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/context/LocaleContext'
import { marketing } from '@/lib/i18n/marketing'

export default function Newsletter() {
  const pathname = usePathname();
  const basePath = pathname?.replace(/^\/(?:en|ar)(?=\/|$)/, '') || pathname
  const { locale } = useLocale()
  const t = (key: Parameters<typeof marketing>[1]) => marketing(locale, key)

  // Ürün detay veya admin sayfalarında newsletter'ı gizle
  if (basePath?.startsWith('/product/') || basePath?.startsWith('/admin')) {
    return null;
  }

  return (
    <section id="newsletter" className="py-24 bg-nrs-black text-nrs-ivory text-center px-6 scroll-mt-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <h2 className="text-3xl md:text-4xl font-serif">{t('newsletterTitle')}</h2>
        <p className="text-nrs-ivory/60 font-light text-lg">
          {t('newsletterBody')}
        </p>
        <p className="text-sm text-nrs-ivory/60">{t('newsletterSoon')}</p>
      </div>
    </section>
  );
}
