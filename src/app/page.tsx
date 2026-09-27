'use client';

import React, { useState, useEffect } from 'react';
import Hero from '@/components/Hero';
import Collection from '@/components/Collection';
import Navigation from '@/components/Navigation';
import BrandStory from '@/components/BrandStory';
import CategoryMood from '@/components/CategoryMood';
import IntroAnimation from '@/components/IntroAnimation';
import { PRODUCTS } from '@/data/products';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function Page() {
  const [introFinished, setIntroFinished] = useState(false);

  return (
    <main className="relative min-h-screen bg-[#F7F3EE] text-[#050505]">
      <IntroAnimation onComplete={() => setIntroFinished(true)} />
      <Navigation introFinished={introFinished} />

      <div className="pt-0">
        {/* 1. HERO: High-end Fashion Campaign */}
        <Hero introFinished={introFinished} />

        {/* 2. CATEGORY MOOD: Editorial visual cards for main categories */}
        <CategoryMood />

        {/* 3. FEATURED COLLECTION: Premium product grid */}
        <section className="py-24 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-serif"
            >
              The Luminous Edit
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-gray-500 font-light text-lg max-w-2xl mx-auto"
            >
              A curated selection of our most exclusive pieces, designed for those who appreciate the art of elegance.
            </motion.p>
          </div>

          <Collection
            products={PRODUCTS}
            onProductClick={(id: string) => {
              window.location.href = `/product/${id}`;
            }}
          />

          <div className="mt-16 text-center">
            <Link
              href="/category/dresses"
              className="inline-block px-10 py-4 border border-nrs-black uppercase tracking-widest text-xs font-sans hover:bg-nrs-black hover:text-nrs-ivory transition-all duration-500"
            >
              Explore All Collections
            </Link>
          </div>
        </section>

        {/* 4. BRAND STORY: High-end split layout */}
        <BrandStory />
      </div>
    </main>
  );
}
