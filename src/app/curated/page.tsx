'use client';

import React from 'react';
import Navigation from '@/components/Navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';

export default function CuratedPage() {
  return (
    <div className="min-h-screen bg-nrs-ivory text-nrs-black layout-content">
      <Navigation />

      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-serif tracking-tight"
            >
              SÖZEL SEÇKİLER
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-black/60 font-sans italic text-sm max-w-xl mx-auto">
              NRS küratörleri tarafından belirlenen, sezonun ruhunu yansıtan özel kombinler ve zamansız parçalar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                title: 'Minimalist Lüks',
                desc: 'Sessiz lüksün en saf hali. Monokrom tonlar ve kusursuz kesimler.',
                image: 'https://images.unsplash.com/photo-1434389677669-7486e12638ce?q=80&w=2070&auto=format&fit=crop'
              },
              {
                title: 'Gece Işıltısı',
                desc: 'Davetlerin odak noktası olacak, iddialı ve rafine gece tasarımları.',
                image: 'https://images.unsplash.com/photo-1539008835757-a65767669e6b?q=80&w=2070&auto=format&fit=crop'
              },
              {
                title: 'Modern Şehir',
                desc: 'Şehrin ritmine ayak uyduran, konfor ve zarafeti birleştiren parçalar.',
                image: 'https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop'
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[3/4] overflow-hidden mb-6">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-nrs-black/10 group-hover:bg-transparent transition-all duration-500" />
                </div>
                <h3 className="text-xl font-serif text-nrs-black mb-3 tracking-wide">{item.title}</h3>
                <p className="text-sm text-nrs-black/60 font-sans leading-relaxed mb-6">
                  {item.desc}
                </p>
                <span className="text-[10px] uppercase tracking-widest text-nrs-black font-medium border-b border-nrs-black pb-1 group-hover:text-nrs-rosegold group-hover:border-nrs-rosegold transition-all duration-500">
                  Keşfet
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
