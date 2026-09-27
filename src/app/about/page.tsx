'use client';

import React from 'react';
import Navigation from '@/components/Navigation';
import { motion } from 'framer-motion';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#050505]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 pt-44 pb-24 md:pt-52 md:pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="relative aspect-[4/5] overflow-hidden"
          >
            <img
              src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
              alt="NRS Brand"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 border-[20px] border-white/20 pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <span className="text-xs uppercase tracking-[0.4em] text-nrs-rosegold font-sans">Our Essence</span>
            <div className="flex flex-col items-start gap-4">
              <img
                src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                alt="NRS Logo"
                className="h-16 md:h-24 w-auto object-contain"
              />
              <h1 className="text-4xl md:text-6xl font-serif leading-tight">
                Boutique Luminous
              </h1>
            </div>

            <div className="space-y-6 text-gray-600 font-light text-lg leading-relaxed">
              <p>
                NRS is more than a boutique; it is a curated sanctuary of elegance.
                We believe that true luxury lies in the harmony of refined silhouettes
                and luminous details.
              </p>
              <p>
                Our collections are designed for the woman who moves through the world
                with confidence and grace, seeking pieces that are not just worn,
                but experienced. From the ethereal glow of our evening gowns to
                the silent luxury of our imperial bedding, every piece is a
                testament to timeless craftsmanship.
              </p>
              <p>
                At NRS Boutique Luminous, we don&apos;t follow trends. We create
                atmospheres. Welcome to the art of elegance.
              </p>
            </div>

            <div className="pt-8 border-t border-nrs-black/10 flex gap-12">
              <div>
                <p className="text-2xl font-serif text-nrs-black">Exclusivity</p>
                <p className="text-xs uppercase tracking-widest text-gray-400">Limited Editions</p>
              </div>
              <div>
                <p className="text-2xl font-serif text-nrs-black">Quality</p>
                <p className="text-xs uppercase tracking-widest text-gray-400">Premium Fabrics</p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
