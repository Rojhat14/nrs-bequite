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
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const introPlayed = sessionStorage.getItem('nrs-intro-played');
    if (introPlayed) {
      setShowIntro(false);
      setIntroFinished(true);
    }
  }, []);

  return (
    <main className="relative min-h-screen bg-[#F7F3EE] text-[#050505]">
      {showIntro && <IntroAnimation onComplete={() => {
        setIntroFinished(true);
        sessionStorage.setItem('nrs-intro-played', 'true');
      }} />}

      {/*
        We REMOVE <Navigation /> from here because it's already in layout.tsx.
        To avoid having two navbars on the home page, we use a CSS trick
        or a conditional in Navigation itself.
        Since we want the home page intro to control the navbar,
        we will keep a specialized version or handle it via a provider.

        Actually, the simplest way is to remove it from here and
        let layout.tsx handle it, but layout.tsx doesn't know about
        the home page's introFinished state.

        Let's fix this by removing it from layout.tsx and putting it back in
        each page, OR (better) using a state management for the intro.
      */}

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
            {/* Explore All Collections button removed as it is already in the navbar */}
          </div>
        </section>

        {/* 4. BRAND STORY: High-end split layout */}
        <BrandStory />
      </div>
    </main>
  );
}
