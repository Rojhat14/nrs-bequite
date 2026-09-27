'use client';

import React from 'react';
import Navigation from '@/components/Navigation';
import { motion } from 'framer-motion';

export default function FAQPage() {
  const faqs = [
    {
      q: 'Siparişimi nasıl takip edebilirim?',
      a: 'Siparişiniz kargoya verildiğinde, kayıtlı e-posta adresinize bir takip numarası ve kargo firması bilgisi iletilir.'
    },
    {
      q: 'İade süreci nasıl işliyor?',
      a: 'Teslimat tarihinden itibaren 14 gün içinde iade talebinizi info@nrs.com adresine ileterek süreci başlatabilirsiniz.'
    },
    {
      q: 'Ödeme yöntemleriniz nelerdir?',
      a: 'Kredi kartı ve banka kartları ile güvenli ödeme yapabilirsiniz. Tüm işlemler PayTR altyapısı ile şifrelenmiş olarak gerçekleştirilir.'
    },
    {
      q: 'Kişiye özel ölçü ile üretim yapıyor musunuz?',
      a: 'Belirli parçalarımızda özel ölçü hizmeti sunmaktayız. Detaylar için bizimle iletişime geçebilirsiniz.'
    },
  ];

  return (
    <div className="min-h-screen bg-nrs-ivory text-nrs-black layout-content">
      <Navigation />

      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-serif tracking-tight"
            >
              S.S.S.
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-black/60 font-sans italic text-sm">
              Sıkça sorulan sorular ve yanıtları.
            </p>
          </div>

          <div className="space-y-8">
            {faqs.map((faq, index) => (
              <div key={index} className="space-y-2 border-b border-nrs-black/10 pb-8">
                <h3 className="text-lg font-serif text-nrs-black leading-snug">
                  {faq.q}
                </h3>
                <p className="text-sm text-nrs-black/60 font-sans leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
