'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product, PRODUCTS } from '@/data/products';
import { ProductCard } from '@/components/ProductCard';

interface CollectionProps {
  products?: Product[];
  onProductClick?: (id: string) => void;
}

const Collection = ({ products = PRODUCTS, onProductClick }: CollectionProps) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category)));
    return ['All', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter((p) => p.category === activeCategory);
  }, [activeCategory, products]);

  return (
    <section id="collection" className="py-32 bg-nrs-ivory">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-24 gap-8">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-6xl font-serif text-nrs-black">
              The Collection
            </h2>
            <div className="h-px w-24 bg-nrs-rosegold"></div>
            <p className="max-w-md text-nrs-black/60 text-lg font-sans italic">
              A curated selection of pieces designed to elevate the everyday into the extraordinary.
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            {categories.map((cat) => {
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[11px] uppercase tracking-[0.2em] transition-all duration-300 ${
                    activeCategory === cat
                      ? 'text-nrs-black border-b border-nrs-black'
                      : 'text-nrs-black/40 hover:text-nrs-black'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
          <AnimatePresence mode="popLayout">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onProductClick={onProductClick}
                />
              ))
            )
            : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="col-span-full py-20 text-center"
              >
                <p className="text-nrs-black/40 italic font-serif">No pieces in this category.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default Collection;
