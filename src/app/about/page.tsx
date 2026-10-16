'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from '@/context/LocaleContext'
import { localePrefix } from '@/lib/i18n/messages'
import { marketing } from '@/lib/i18n/marketing'

export default function AboutPage() {
  const { locale } = useLocale()
  const prefix = localePrefix(locale)
  const t = (key: Parameters<typeof marketing>[1]) => marketing(locale, key)
  return (
    <div className="min-h-screen bg-nrs-canvas text-nrs-ink layout-content">

      <main className="max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        {/* SECTION 1: NRS HAKKINDA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative aspect-[4/5] overflow-hidden"
          >
            <Image
              src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
              alt={t('aboutImage1')}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 border-[20px] border-white/20 pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.4em] text-nrs-ink/60 font-sans">{t('aboutEyebrow')}</span>
              <h1 className="text-4xl md:text-6xl font-serif leading-tight">
                {t('aboutTitle')}
              </h1>
            </div>

            <div className="space-y-6 text-nrs-ink/70 font-light text-lg leading-relaxed">
              <p>
                {t('aboutP1')}
              </p>
              <p>
                {t('aboutP2')}
              </p>
              <p>
                {t('aboutP3a')}<Link href={`${prefix}/collections`} className="underline underline-offset-4 decoration-nrs-black/20 hover:decoration-nrs-black transition-colors">{t('aboutCollections')}</Link>{t('aboutP3b')}
              </p>
              <p>
                {t('aboutP4')}
              </p>
            </div>
          </motion.div>
        </div>

        {/* SECTION 2: NRS KADINI */}
        <div id="woman" className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="order-2 md:order-1 relative aspect-[4/5] overflow-hidden"
          >
            <Image
              src="https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop"
              alt={t('womanImage')}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 border-[20px] border-white/20 pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="order-1 md:order-2 space-y-8"
          >
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.4em] text-nrs-ink/60 font-sans">{t('womanEyebrow')}</span>
              <h2 className="text-4xl md:text-6xl font-serif leading-tight">
                {t('womanTitle')}
              </h2>
            </div>

            <div className="space-y-6 text-nrs-ink/70 font-light text-lg leading-relaxed">
              <p>
                {t('womanP1')}
              </p>
              <p>
                {t('womanP2a')}<Link href={`${prefix}/category/ceketler-blazerlar`} className="underline underline-offset-4 decoration-nrs-black/20 hover:decoration-nrs-black transition-colors">{t('womanBlazer')}</Link>{t('womanP2b')}<Link href={`${prefix}/category/elbiseler`} className="underline underline-offset-4 decoration-nrs-black/20 hover:decoration-nrs-black transition-colors">{t('womanDress')}</Link>{t('womanP2c')}
              </p>
              <p>
                {t('womanP3')}
              </p>
            </div>
          </motion.div>
        </div>

        {/* SECTION 3: ATÖLYE */}
        <div id="atelier" className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative aspect-[4/5] overflow-hidden"
          >
            <Image
              src="https://images.unsplash.com/photo-1558769132-cb14497891a4?q=80&w=2070&auto=format&fit=crop"
              alt={t('atelierImage')}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 border-[20px] border-white/20 pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.4em] text-nrs-ink/60 font-sans">{t('atelierEyebrow')}</span>
              <h2 className="text-4xl md:text-6xl font-serif leading-tight">
                {t('atelierTitle')}
              </h2>
            </div>

            <div className="space-y-6 text-nrs-ink/70 font-light text-lg leading-relaxed">
              <p>
                {t('atelierP1')}
              </p>
              <p>
                {t('atelierP2')}
              </p>
              <p>
                {t('atelierP3')}
              </p>
              <p>
                {t('atelierP4')}
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
