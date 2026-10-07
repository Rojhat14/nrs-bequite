'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import ProductShowcase from '@/components/ProductShowcase';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/data/products';

interface HeroProps {
  introFinished?: boolean;
  products: Product[];
}

const Hero = ({ introFinished, products }: HeroProps) => {
  return (
    <section className="relative min-h-[100svh] w-full bg-nrs-canvas flex flex-col items-center justify-center overflow-hidden pt-[var(--nrs-header-height)] pb-8">
      {/* Ambient Background Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-nrs-champagne/30 blur-[150px] rounded-full pointer-events-none" />

      {/* Editorial Background Image - Soft, high-end fashion feel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: introFinished ? 0.4 : 0 }}
        transition={{ duration: 2, delay: 1 }}
        className="absolute inset-0 z-0"
      >
        <Image
          src="https://images.unsplash.com/photo-1490481651818-503f6c70611d?q=80&w=2070&auto=format&fit=crop"
          alt="Luxury Fashion Background"
          fill
          className="object-cover opacity-40 mix-blend-multiply"
          priority
        />
      </motion.div>

      {/* Background Product Showcase */}
      <ProductShowcase introFinished={introFinished} products={products} />

      <div className="container mx-auto px-4 z-10">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: introFinished ? 1 : 0, y: introFinished ? 0 : 30 }}
            transition={{
              duration: 1.5,
              delay: introFinished ? 0 : 0,
              ease: [0.22, 1, 0.32, 1]
            }}
            className="space-y-8"
          >
            {/* Main Editorial Text */}
            <div className="relative flex flex-col justify-center items-center py-12">
              <motion.h1
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: introFinished ? 1 : 0, scale: introFinished ? 1 : 0.98 }}
                transition={{ delay: introFinished ? 0.2 : 0, duration: 1.8 }}
                className="text-5xl md:text-8xl font-serif text-nrs-ink tracking-tight mb-6"
              >
                ZARAFETİN SANATI
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: introFinished ? 1 : 0 }}
                transition={{ delay: introFinished ? 1 : 0, duration: 1.5 }}
                className="text-sm md:text-lg font-sans text-nrs-ink/60 max-w-2xl mx-auto leading-relaxed tracking-wide px-4"
              >
                Modern kadının özgün duruşu için tasarlanan rafine siluetler, seçkin dokular ve zamansız detaylar.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: introFinished ? 1 : 0, y: introFinished ? 0 : 20 }}
                transition={{ delay: introFinished ? 1.4 : 0, duration: 1.2 }}
                className="flex flex-col md:flex-row items-center justify-center gap-6 mt-12"
              >
                <Link
                  href="/collections"
                  className="px-10 py-4 bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory uppercase tracking-[0.3em] text-[10px] font-sans hover:bg-nrs-charcoal transition-all duration-700"
                >
                  Koleksiyonu Keşfet
                </Link>
              </motion.div>
            </div>
          </motion.div>
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
