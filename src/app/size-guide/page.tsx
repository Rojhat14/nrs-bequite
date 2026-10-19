'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import { useLocale } from '@/context/LocaleContext';

export default function SizeGuidePage() {
  const { locale } = useLocale();
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr;
  return (
    <div className="min-h-screen bg-nrs-canvas text-nrs-ink layout-content">

      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-serif tracking-tight"
            >
              {copy('BEDEN REHBERİ', 'SIZE GUIDE', 'دليل المقاسات')}
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-ink/60 font-sans italic text-sm">
              {copy('Beden seçenekleri her ürünün sayfasında gösterilir. Kişisel ölçü paylaşmak isteğe bağlıdır.', 'Size options are shown on each product page. Sharing personal measurements is optional.', 'تظهر خيارات المقاس في صفحة كل منتج. تقديم القياسات الشخصية اختياري.')}
            </p>
          </div>

          <div className="border border-nrs-ink/10 bg-nrs-panel p-6 text-sm leading-7 text-nrs-ink/70">
            {copy('Doğrulanmış santimetre ölçü tablosu bulunmuyor. Ürün sayfasındaki beden seçeneklerinden uygun olanı seçebilirsiniz; kişisel ölçü alanları sipariş için zorunlu değildir.', 'A verified centimetre measurement chart is not available. Select from the options shown on the product page; personal measurement fields are not required to place an order.', 'لا يتوفر جدول قياسات موثّق بالسنتيمتر. اختاري من الخيارات المعروضة في صفحة المنتج؛ ولا تُطلب القياسات الشخصية لإتمام الطلب.')}
          </div>

          <div className="bg-nrs-panel p-8 border border-nrs-ink/5 space-y-4">
            <h3 className="text-sm uppercase tracking-widest font-medium">{copy('Nasıl ölçülür?', 'How to measure', 'كيفية أخذ القياسات')}</h3>
            <p className="text-sm text-nrs-ink/60 leading-relaxed font-sans">
              {copy('Mezurayı vücudunuzun en geniş noktalarından geçirerek, çok sıkmadan ve çok gevşek bırakmadan ölçüm yapmanızı öneririz. Eğer iki beden arasındaysanız, daha rahat bir kullanım için bir üst bedeni tercih edebilirsiniz.', 'Measure around the fullest points without pulling the tape too tightly or leaving it loose. If you are between two sizes, consider the larger size for a more comfortable fit.', 'مرري شريط القياس حول أعرض نقاط الجسم دون شده كثيراً أو تركه مرتخياً. إذا كنتِ بين مقاسين، يمكنك اختيار المقاس الأكبر لملاءمة أكثر راحة.')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
