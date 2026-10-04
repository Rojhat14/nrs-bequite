'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

const BrandStory = () => {
  return (
    <section className="py-32 bg-nrs-canvas overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          {/* Image Side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.32, 1] }}
            viewport={{ once: true }}
            className="relative aspect-[4/5] overflow-hidden bg-nrs-black/5"
          >
            <Image
              src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
              alt="NRS Luxury Fashion"
              fill
              className="object-cover grayscale hover:grayscale-0 transition-all duration-1000"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 border-[20px] border-nrs-ivory/10 pointer-events-none"></div>
          </motion.div>

          {/* Text Side */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.32, 1], delay: 0.2 }}
            viewport={{ once: true }}
            className="space-y-16"
          >
            <div className="space-y-6">
              <span className="text-xs uppercase tracking-[0.4em] text-nrs-ink/60 font-sans">Manifesto</span>
              <h2 className="text-5xl md:text-7xl font-serif text-nrs-ink leading-tight tracking-tight">
                NRS KADINI
              </h2>
              <p className="text-lg md:text-xl text-nrs-ink/70 leading-relaxed font-sans italic">
                &ldquo;Dikkat çekmek için giyinmez. Kendi duruşunu ifade etmek için giyinir. Kendinden emin, özgün ve rafine. NRS kadını, zarafet ile modernlik arasında kendi çizgisini oluşturur. Onun için stil, başkalarının gördüğü bir görüntüden çok kişisel bir ifade biçimidir.&rdquo;
              </p>
            </div>

            <div className="space-y-6 pt-8 border-t border-nrs-ink/10">
              <h3 className="text-2xl font-serif text-nrs-ink tracking-wide">
                DAHA AZ. DAHA ÖZEL.
              </h3>
              <p className="text-sm text-nrs-ink/60 leading-relaxed font-sans max-w-lg">
                Gerçek zarafetin fazlalıkta değil, detaylarda olduğuna inanıyoruz. Bir kumaşın dokusu, bir kesimin dengesi, bir siluetin duruşu ve bir tasarımın üzerinizde yarattığı his. NRS için lüks; yalnızca görünmek değil, hissettirmektir.
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/about"
                className="group flex items-center gap-4 text-xs uppercase tracking-[0.3em] text-nrs-ink font-medium"
              >
                Hakkımızda
                <span className="h-px w-0 group-hover:w-12 bg-nrs-ink transition-all duration-500"></span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BrandStory;
