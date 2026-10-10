'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import { ENABLE_CARD_PAYMENT } from '@/lib/feature-flags';

export default function FAQPage() {
  const faqs = [
    { q: 'Kargo ücreti ve teslimat süresi nedir?', a: 'Türkiye genelinde ücretsiz kargo. Sipariş onayından itibaren özel dikim üretimi ve kargo taşımacılığı dahil toplam 7–10 iş günü içerisinde teslimat. Ek kargo süresi eklenmez.' },
    {
      q: 'Siparişimi nasıl takip edebilirim?',
      a: 'Kargo firması henüz belirlenmedi; anlaşmalı taşıyıcı veya takip hizmeti taahhüt edilmez. Teslimat durumunu şirket iletişim e-postasından sorabilirsiniz.'
    },
    {
      q: 'İade süreci nasıl işliyor?',
      a: 'Kıyafetler müşterinin ölçülerine göre özel dikilir. Cayma hakkı istisnası yalnızca mevzuattaki koşullar oluştuğunda uygulanır; ayıplı ürün hakları korunur. Cayma hakkının geçerli olduğu ürünlerde teslimden itibaren 14 gün içinde bildirim yapılabilir. İletişim ve ayrıntılar İade ve Değişim Koşulları sayfasındadır.'
    },
    {
      q: 'Ödeme yöntemleriniz nelerdir?',
      a: ENABLE_CARD_PAYMENT
        ? 'Online ödeme hizmetinin kullanılabilirliği ödeme ekranında bildirilir. Havale / EFT bilgileri sipariş teyidinde paylaşılır.'
        : 'WhatsApp üzerinden sipariş verebilirsiniz. Havale / EFT ve IBAN bilgileri sipariş onayı sırasında paylaşılır.'
    },
    {
      q: 'Kişiye özel ölçü ile üretim yapıyor musunuz?',
      a: 'Bütün kıyafetler ürün bazında ilettiğiniz zorunlu beden ölçülerine göre özel dikilir.'
    },
  ];

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
              S.S.S.
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-ink/60 font-sans italic text-sm">
              Sıkça sorulan sorular ve yanıtları.
            </p>
          </div>

          <div className="space-y-8">
            {faqs.map((faq, index) => (
              <div key={index} className="space-y-2 border-b border-nrs-ink/10 pb-8">
                <h3 className="text-lg font-serif text-nrs-ink leading-snug">
                  {faq.q}
                </h3>
                <p className="text-sm text-nrs-ink/60 font-sans leading-relaxed">
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
