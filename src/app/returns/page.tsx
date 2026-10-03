'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function ReturnsPage() {
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
              İADE & DEĞİŞİM
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 gap-12">
            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">İade Koşulları</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                Satın aldığınız ürünleri, teslimat tarihinden itibaren 14 gün içerisinde iade edebilirsiniz. İade edilecek ürünlerin kullanılmamış, etiketlerinin koparılmamış ve orijinal ambalajında olması gerekmektedir.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">Değişim İşlemleri</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                Beden değişimi veya farklı bir model tercihi için müşteri hizmetlerimizle iletişime geçebilirsiniz. Stok durumuna göre değişim işlemleri gerçekleştirilmektedir.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">İade Süreci</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                İade işlemini başlatmak için sipariş numaranız ile birlikte info@nrs.com adresine e-posta gönderebilirsiniz. Onay sonrası size iletilecek olan kargo kodu ile ücretsiz iade yapabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
