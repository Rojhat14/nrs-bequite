'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product, PRODUCTS } from '@/data/products';
import { ProductCard } from '@/components/ProductCard';
import Link from 'next/link';

interface CollectionProps {
  products?: Product[];
  onProductClick?: (id: string) => void;
}

const Collection = ({ products = PRODUCTS, onProductClick }: CollectionProps) => {
  const [activeCategory, setActiveCategory] = useState<string>('Tümü');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category)));
    return ['Tümü', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'Tümü') return products;
    return products.filter((p) => p.category === activeCategory);
  }, [activeCategory, products]);

  return (
    <section id="collection" className="py-32 bg-nrs-ivory">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-24 gap-12">
          <div className="space-y-6">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-serif text-nrs-black tracking-tight"
            >
              NRS KOLEKSİYONU
            </motion.h2>
            <div className="h-px w-20 bg-nrs-black/20"></div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="max-w-2xl text-nrs-black/60 text-lg font-sans leading-relaxed"
            >
              Modern kadın için yeniden yorumlanan zarafet. NRS koleksiyonu; güçlü siluetleri, rafine detayları ve zamansız tasarım anlayışını bir araya getirir.
              <br />
              <span className="text-sm italic block mt-4">Her parça, sezonluk bir trendin ötesinde uzun süre kullanılabilecek bir gardırop anlayışıyla tasarlanır.</span>
            </motion.p>
          </div>

          <div className="flex flex-wrap gap-8">
            {categories.map((cat) => {
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[10px] uppercase tracking-[0.3em] transition-all duration-700 font-sans relative group ${
                    activeCategory === cat
                      ? 'text-nrs-black'
                      : 'text-nrs-black/40 hover:text-nrs-black'
                  }`}
                >
                  {cat}
                  <span className={`absolute -bottom-1 left-0 h-px bg-nrs-black transition-all duration-700 ${
                    activeCategory === cat ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
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
                <p className="text-nrs-black/40 italic font-serif">Bu kategoride henüz bir parça bulunmuyor.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-24 text-center">
          <Link
            href="/collections"
            className="inline-block px-12 py-5 border border-nrs-black uppercase tracking-[0.3em] text-[10px] font-sans hover:bg-nrs-black hover:text-nrs-ivory transition-all duration-700"
          >
            Koleksiyonu Keşfet
          </Link>
        </div>
      </div>
    </section>
  );
};

  export default Collection;
