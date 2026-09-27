'use client';

import React from 'react';
import { PRODUCTS } from '@/data/products';
import { ProductCard } from '@/components/ProductCard';
import Navigation from '@/components/Navigation';
import { motion } from 'framer-motion';

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

const categoryBanners: Record<string, { title: string; description: string; image: string }> = {
  'dresses': {
    title: 'The Art of Evening Wear',
    description: 'Refined silhouettes and luminous details for unforgettable nights.',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop',
  },
  'tops': {
    title: 'Essential Luxury Tops',
    description: 'Effortless elegance from structured blazers to fluid silk blouses.',
    image: 'https://images.unsplash.com/photo-1434389677669-578e6292797a?q=80&w=2070&auto=format&fit=crop',
  },
  'bottoms': {
    title: 'Tailored Precision',
    description: 'The perfect balance of structure and movement for the modern woman.',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=2070&auto=format&fit=crop',
  },
  'bedding': {
    title: 'The Luminous Sanctuary',
    description: 'Experience the ultimate restorative sleep with our imperial cotton and silk sets.',
    image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f1430?q=80&w=2070&auto=format&fit=crop',
  },
  'accessories': {
    title: 'Luminous Accents',
    description: 'The final touch of sophistication to complete your ensemble.',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df769374?q=80&w=2070&auto=format&fit=crop',
  },
};

export default function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = params;
  const categoryKey = slug.toLowerCase();

  // Map slug to the category name in our data
  const categoryMap: Record<string, string> = {
    'dresses': 'Dresses',
    'tops': 'Tops',
    'bottoms': 'Bottoms',
    'bedding': 'Bedding',
    'accessories': 'Accessories',
  };

  const categoryName = categoryMap[categoryKey] || 'General';
  const filteredProducts = PRODUCTS.filter(p => p.category === categoryName);
  const banner = categoryBanners[categoryKey] || {
    title: 'Collections',
    description: 'Curated pieces for the discerning eye.',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop',
  };

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#050505]">
      <Navigation />

      {/* Category Hero Banner */}
      <section className="relative h-[60vh] w-full overflow-hidden">
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5 }}
          src={banner.image}
          alt={categoryName}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-center text-white px-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-7xl font-serif mb-4"
          >
            {banner.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl font-light max-w-2xl"
          >
            {banner.description}
          </motion.p>
        </div>
      </section>

      {/* Product Grid Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl font-serif">{categoryName}</h2>
            <p className="text-gray-500 font-light">{filteredProducts.length} Pieces Available</p>
          </div>
          <div className="hidden md:block">
            <select className="bg-transparent border-b border-black py-2 pr-8 focus:outline-none font-light text-sm">
              <option>Sort by: Featured</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Newest</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-xl font-serif italic text-gray-400">No pieces found in this collection.</p>
          </div>
        )}
      </section>
    </div>
  );
}
