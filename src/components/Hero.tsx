'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import ProductShowcase from '@/components/ProductShowcase';
import Link from 'next/link';
import Image from 'next/image';
import type { HomepageShowcaseProduct } from '@/lib/products';
import { useLocale } from '@/context/LocaleContext';

interface HeroProps {
  products: HomepageShowcaseProduct[];
}

const Hero = ({ products }: HeroProps) => {
  const { locale } = useLocale()
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  return (
    <section className="relative min-h-[100svh] w-full bg-nrs-canvas flex flex-col items-center justify-center overflow-hidden pt-[var(--nrs-header-height)] pb-8">
      {/* Ambient Background Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-nrs-champagne/30 blur-[150px] rounded-full pointer-events-none" />

      {/* Editorial Background Image - Soft, high-end fashion feel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 z-0"
      >
        <Image
          src="/images/editorial/categories/dresses.jpg"
          alt={copy('NRS elbise koleksiyonundan görünüm', 'A look from the NRS dresses collection', 'إطلالة من مجموعة فساتين NRS')}
          fill
          className="object-cover opacity-40 mix-blend-multiply"
          priority
        />
      </motion.div>

      {/* Background Product Showcase */}
      <ProductShowcase products={products} />

      <div className="container mx-auto px-4 z-10">
        <div className="max-w-6xl mx-auto text-center">
          <div className="space-y-8">
            {/* Main Editorial Text */}
            <div className="relative flex flex-col justify-center items-center py-12">
              <h1 className="text-5xl md:text-8xl font-serif text-nrs-ink tracking-tight mb-6">
                {copy('ZARAFETİN SANATI', 'THE ART OF ELEGANCE', 'فن الأناقة')}
              </h1>

              <p className="text-sm md:text-lg font-sans text-nrs-ink/60 max-w-2xl mx-auto leading-relaxed tracking-wide px-4">
                {copy('Modern kadının özgün duruşu için tasarlanan rafine siluetler, seçkin dokular ve zamansız detaylar.', 'Refined silhouettes, considered textures and timeless details for a distinctive modern woman.', 'خطوط راقية وخامات منتقاة وتفاصيل خالدة صُممت للمرأة العصرية ذات الحضور المميز.')}
              </p>

              <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-12">
                <Link
                  href="/collections"
                  className="px-10 py-4 bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory uppercase tracking-[0.3em] text-[10px] font-sans hover:bg-nrs-charcoal transition-all duration-700"
                >
                  {copy('Koleksiyonu Keşfet', 'Explore the collection', 'اكتشفي المجموعة')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Decorative Lines */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-24 w-px h-full bg-nrs-ink/[0.05]"></div>
        <div className="absolute top-0 right-24 w-px h-full bg-nrs-ink/[0.05]"></div>
      </div>
    </section>
  );
};

export default Hero;
