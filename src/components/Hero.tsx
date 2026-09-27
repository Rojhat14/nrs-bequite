'use client';

import React from 'react';
import { motion } from 'framer-motion';
import ProductShowcase from '@/components/ProductShowcase';

interface HeroProps {
  introFinished?: boolean;
}

const Hero = ({ introFinished }: HeroProps) => {
  return (
    <section className="relative h-screen w-full bg-nrs-ivory flex flex-col items-center justify-center overflow-hidden">
      {/* Ambient Background Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-nrs-rosegold/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Background Product Showcase - Appears when intro is moving to nav */}
      <ProductShowcase introFinished={introFinished} />

      <div className="container mx-auto px-4 z-10">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.32, 1] }}
            className="space-y-0"
          >
            {/* Logo and Tagline Wrapper */}
            <div className="relative flex flex-col justify-center items-center py-12">
              {/* Central Logo with Flying Animation */}
              <motion.img
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: introFinished ? 0 : 1,
                  scale: introFinished ? 0.2 : 1,
                  y: introFinished ? -800 : 0, // Flies up to navigation
                  x: 0
                }}
                transition={{
                  duration: 1.5,
                  ease: [0.45, 0, 0.55, 1], // Smooth a-to-b transition
                }}
                src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                alt="NRS Logo"
                className="h-80 md:h-[600px] w-auto object-contain mx-auto z-10"
              />

              {/* Tagline - Stays centered but fades slightly when intro finishes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                transition={{ delay: 0.8, duration: 1.2, ease: 'easeOut' }}
                className="relative z-20 flex flex-col items-center justify-center space-y-6 -mt-20 md:-mt-32"
              >
                <p className="text-2xl md:text-4xl font-serif italic text-nrs-black/70 text-center tracking-tight drop-shadow-sm">
                  &ldquo;The Art of Elegance&rdquo;
                </p>
                <div className="flex justify-center items-center gap-6">
                  <div className="h-px w-12 bg-nrs-black/10"></div>
                  <button className="text-[9px] uppercase tracking-[0.4em] text-nrs-black/60 border-b border-nrs-black/10 pb-1 hover:text-nrs-black hover:border-nrs-black transition-all duration-700">
                    Discover Collection
                  </button>
                  <div className="h-px w-12 bg-nrs-black/10"></div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Side Decorative Lines */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-12 w-px h-full bg-nrs-black/[0.03]"></div>
        <div className="absolute top-0 right-12 w-px h-full bg-nrs-black/[0.03]"></div>
      </div>
    </section>
  );
};

export default Hero;
