'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PRODUCTS } from '@/data/products';

const Selected = () => {
  // Show the first 3 products as "featured" since there is no is_exclusive field
  const featuredProducts = PRODUCTS.slice(0, 3);

  return (
    <section className="py-32 md:py-48 bg-nrs-offwhite">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.32, 1] }}
            className="mb-20 text-center"
          >
            <h2 className="text-sm uppercase tracking-[0.4em] text-nrs-charcoal/50 mb-4">Curated Selection</h2>
            <h3 className="text-5xl md:text-7xl font-serif text-nrs-charcoal">Selected Pieces</h3>
            <p className="max-w-xl mx-auto mt-6 text-nrs-charcoal/60 italic">
              A refined curation of our most-prized pieces, chosen for their exceptional artistry and enduring character.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-24">
            {featuredProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.32, 1] }}
                className="group cursor-pointer"
              >
                <div className="relative overflow-hidden bg-nrs-charcoal/5 aspect-[3/4] mb-8">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-[1000ms] ease-in-out transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-all duration-500" />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-nrs-charcoal/40">{product.category}</span>
                  <h4 className="text-2xl font-serif text-nrs-charcoal">{product.name}</h4>
                  <p className="text-nrs-charcoal/60 text-sm mt-2">{product.description}</p>
                  <div className="mt-4 text-xs uppercase tracking-widest text-nrs-charcoal/40 group-hover:text-nrs-gold transition-colors">
                    View Details —&gt;
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Selected;
