'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

const CategoryMood = () => {
  const moods = [
    {
      name: 'GÜNDÜZ',
      description: 'Günün zarafeti. Günün her anına eşlik eden sade, modern ve rafine siluetler.',
      image: 'https://images.unsplash.com/photo-1434389677669-7486e12638ce?q=80&w=2070&auto=format&fit=crop',
      href: '/category/tops'
    },
    {
      name: 'GECE',
      description: 'Gecenin kendine özgü hali. Işığı yakalayan dokular ve güçlü siluetlerle akşamın ritmine uyum sağlayan tasarımlar.',
      image: 'https://images.unsplash.com/photo-1539008835757-a65767669e6b?q=80&w=2070&auto=format&fit=crop',
      href: '/category/dresses'
    },
    {
      name: 'DAVET',
      description: 'Anın kendisi için. Hatırlanmaya değer anlar için tasarlanan özel parçalar.',
      image: 'https://images.unsplash.com/photo-1566174053895-827e65767724?q=80&w=2070&auto=format&fit=crop',
      href: '/category/dresses'
    },
    {
      name: 'İMZA',
      description: "NRS'nin karakteri. Markanın estetik anlayışını tanımlayan özgün ve zamansız parçalar.",
      image: 'https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop',
      href: '/collections'
    },
  ];

  return (
    <section className="py-32 bg-nrs-ivory">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20 space-y-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-serif text-nrs-black tracking-tight"
          >
            TARZINI KEŞFET
          </motion.h2>
          <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {moods.map((mood, index) => (
            <motion.div
              key={mood.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative group cursor-pointer overflow-hidden aspect-[3/4]"
            >
              <Link href={mood.href} className="block w-full h-full relative">
                <Image
                  src={mood.image}
                  alt={mood.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-105"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-nrs-black/40 opacity-60 group-hover:opacity-80 transition-all duration-700" />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <h3 className="text-white text-2xl font-serif tracking-[0.2em] mb-4 transition-transform duration-500 group-hover:-translate-y-2">
                    {mood.name}
                  </h3>
                  <p className="text-nrs-ivory/0 group-hover:text-nrs-ivory/80 text-[11px] uppercase tracking-widest leading-relaxed transition-all duration-700 delay-100 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 font-sans">
                    {mood.description}
                  </p>
                </div>

                {/* Bottom Line */}
                <div className="absolute bottom-0 left-0 w-0 h-px bg-white transition-all duration-700 group-hover:w-full"></div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryMood;
