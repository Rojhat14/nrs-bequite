'use client';

import React from 'react';
import { motion } from 'framer-motion';

const BrandStory = () => {
  return (
    <section className="py-32 bg-nrs-ivory overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* Image Side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.32, 1] }}
            viewport={{ once: true }}
            className="relative aspect-[4/5] overflow-hidden bg-nrs-black/5"
          >
            <img
              src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
              alt="NRS Luxury Fashion"
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
            />
            <div className="absolute inset-0 border-[20px] border-nrs-ivory/10 pointer-events-none"></div>
          </motion.div>

          {/* Text Side */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.32, 1], delay: 0.2 }}
            viewport={{ once: true }}
            className="space-y-10"
          >
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-[0.4em] text-nrs-rosegold font-sans">The Essence</span>
              <h2 className="text-5xl md:text-7xl font-serif text-nrs-black leading-tight">
                The NRS Woman
              </h2>
            </div>

            <p className="text-lg md:text-xl text-nrs-black/60 leading-relaxed font-sans italic">
              &ldquo;NRS is an expression of modern femininity, refined silhouettes and luminous details.
              Our pieces are designed for those who appreciate the silence of luxury and the power of elegance.&rdquo;
            </p>

            <div className="pt-6">
              <button className="group flex items-center gap-4 text-xs uppercase tracking-[0.3em] text-nrs-black font-medium">
                Discover NRS
                <span className="h-px w-0 group-hover:w-12 bg-nrs-rosegold transition-all duration-500"></span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BrandStory;
