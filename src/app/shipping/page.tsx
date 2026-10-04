'use client';

import React from 'react';
import { m as motion } from 'framer-motion';

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-nrs-canvas text-nrs-ink layout-content">

      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-serif tracking-tight"
            >
              KARGO & TESLİMAT
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 gap-12">
            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">Teslimat Süreci</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                Tüm siparişleriniz, NRS atölyesinde özenle hazırlanır ve paketlenir. Hazırlık süreci ortalama 1-3 iş günü sürmektedir.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">Kargo Ücretleri</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                3.000 TL ve üzeri tüm siparişlerde kargo ücretsizdir. Bu tutarın altındaki siparişler için sabit kargo ücreti uygulanmaktadır.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">Teslimat Süresi</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                Türkiye genelinde teslimat süresi ortalama 2-5 iş günüdür. Siparişiniz kargoya verildiğinde tarafınıza bir takip numarası iletilir.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">Uluslararası Gönderimler</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                Uluslararası gönderim detayları için lütfen bizimle iletişime geçin.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
