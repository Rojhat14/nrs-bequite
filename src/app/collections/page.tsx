'use client';

import React from 'react';
import Navigation from '@/components/Navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

export default function CollectionsPage() {
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
              KOLEKSİYONLAR
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-black/60 font-sans italic text-sm max-w-xl mx-auto">
              Zamanın ötesinde siluetler, rafine detaylar ve modern kadının ruhunu yansıtan özel seçkiler.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {[
              {
                id: 'oz',
                title: 'KOLEKSİYON 01: ÖZ',
                desc: 'NRS\'nin karakterini tanımlayan siluetler. Arındırılmış çizgiler, güçlü formlar ve zamansız bir zarafet anlayışı.',
                image: 'https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop'
              },
              {
                id: 'gece',
                title: 'KOLEKSİYON 02: GECE',
                desc: 'Işığın değiştiği saatler için tasarlandı. Akışkan dokular, dikkat çekici siluetler ve ölçülü bir ihtişam.',
                image: 'https://images.unsplash.com/photo-1539008835757-a65767669e6b?q=80&w=2070&auto=format&fit=crop'
              },
              {
                id: 'atolye',
                title: 'KOLEKSİYON 03: ATÖLYE',
                desc: 'Tasarımın kişisel bir ifadeye dönüştüğü yer. Özgün detaylar, özenli işçilik ve sınırlı sayıda üretilen özel tasarımlar.',
                image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop'
              },
              {
                id: 'isik',
                title: 'KOLEKSİYON 04: IŞIK',
                desc: 'Modern zarafetin daha doğal hali. Rahatlık ve zarafet arasında kurulan denge.',
                image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop'
              },
            ].map((col, index) => (
              <motion.div
                key={col.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[16/9] overflow-hidden mb-6">
                  <Image
                    src={col.image}
                    alt={col.title}
                    fill
                    className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-nrs-black/20 group-hover:bg-transparent transition-all duration-500" />
                </div>
                <h3 className="text-2xl font-serif text-nrs-black mb-3 tracking-wide">{col.title}</h3>
                <p className="text-sm text-nrs-black/60 font-sans leading-relaxed mb-6">
                  {col.desc}
                </p>
                <Link
                  href={`/collections/${col.id}`}
                  className="text-[10px] uppercase tracking-widest text-nrs-black font-medium border-b border-nrs-black pb-1 hover:text-nrs-rosegold hover:border-nrs-rosegold transition-all duration-500"
                >
                  Keşfet
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
