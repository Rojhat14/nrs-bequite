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
  'elbiseler': {
    title: 'KADIN ELBİSELERİ',
    description: 'Modern siluetleri, rafine detayları ve zamansız kadınsılığı bir araya getiren seçkin koleksiyon.',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop',
  },
  'ust-giyim': {
    title: 'KADIN ÜST GİYİM',
    description: 'Zarif bluzlardan akışkan saten tasarımlara kadar modern gardırobun tamamlayıcı parçaları.',
    image: 'https://images.unsplash.com/photo-1434389677669-578e6292797a?q=80&w=2070&auto=format&fit=crop',
  },
  'ceketler-blazerlar': {
    title: 'KADIN CEKET & BLAZER',
    description: 'Güçlü bir siluet, doğru kesimle başlar. Modern terzilik anlayışıyla tasarlanmış seçkin parçalar.',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=2070&auto=format&fit=crop',
  },
  'alt-giyim': {
    title: 'KADIN ALT GİYİM',
    description: 'Dengeli siluetler ve özenli kesimler. Modern terziliği rahatlık ve zarafetle birleştiren tasarımlar.',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=2070&auto=format&fit=crop',
  },
  'takimlar': {
    title: 'KADIN TAKIM KOLEKSİYONU',
    description: 'Bir bütün olarak tasarlanan siluetler. Dengeli bir görünüm sunan rafine takım seçkileri.',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop',
  },
};

export default function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = params;
  const categoryKey = slug.toLowerCase();

  // Map slug to the category name in our data (including aliases for old links)
  const categoryMap: Record<string, string> = {
    'elbiseler': 'Elbiseler',
    'dresses': 'Elbiseler',
    'ust-giyim': 'Üst Giyim',
    'tops': 'Üst Giyim',
    'ceketler-blazerlar': 'Ceketler & Blazerlar',
    'blazers': 'Ceketler & Blazerlar',
    'alt-giyim': 'Alt Giyim',
    'bottoms': 'Alt Giyim',
    'takimlar': 'Takımlar',
    'suits': 'Takımlar',
    'bedding': 'Bedding',
    'accessories': 'Aksesuar',
  };

  const categoryName = categoryMap[categoryKey] || 'Genel';
  const filteredProducts = PRODUCTS.filter(p => p.category === categoryName);

  const banner = categoryBanners[categoryKey] || {
    title: 'Koleksiyonlar',
    description: 'Seçkin gözler için küratörlüğünü yaptığımız özel parçalar.',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop',
  };

  return (
    <div className="min-h-screen bg-nrs-ivory text-nrs-black">
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
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center text-white px-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-7xl font-serif mb-4 tracking-tight"
          >
            {banner.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl font-light max-w-2xl leading-relaxed"
          >
            {banner.description}
          </motion.p>
        </div>
      </section>

      {/* Product Grid Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex justify-between items-end mb-16">
          <div className="space-y-2">
            <h2 className="text-3xl font-serif tracking-tight">{categoryName}</h2>
            <p className="text-nrs-black/40 font-light text-sm">{filteredProducts.length} Parça Mevcut</p>
          </div>
          <div className="hidden md:block">
            <select className="bg-transparent border-b border-nrs-black py-2 pr-8 focus:outline-none font-light text-xs uppercase tracking-widest">
              <option>Öne Çıkanlar</option>
              <option>Fiyat: Artan</option>
              <option>Fiyat: Azalan</option>
              <option>Yeni Gelenler</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-32">
            <p className="text-xl font-serif italic text-nrs-black/30">Bu koleksiyonda şu an uygun bir parça bulunmuyor.</p>
          </div>
        )}
      </section>
    </div>
  );
}
