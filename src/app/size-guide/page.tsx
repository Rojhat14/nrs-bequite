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
              {copy('Size en uygun parçayı bulmanıza yardımcı olmak için hazırladığımız ölçü tablosu.', 'A measurement chart to help you find the most suitable fit.', 'جدول قياسات لمساعدتك في اختيار القطعة الأنسب.')}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-nrs-ink/10">
                  <th className="py-4 px-4 text-xs uppercase tracking-widest font-medium">{copy('Beden', 'Size', 'المقاس')}</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-widest font-medium">{copy('Göğüs (cm)', 'Bust (cm)', 'الصدر (سم)')}</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-widest font-medium">{copy('Bel (cm)', 'Waist (cm)', 'الخصر (سم)')}</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-widest font-medium">{copy('Basen (cm)', 'Hip (cm)', 'الأرداف (سم)')}</th>
                </tr>
              </thead>
              <tbody className="text-sm font-sans text-nrs-ink/70">
                {[
                  { size: 'XS', chest: '82-85', waist: '62-65', hip: '88-91' },
                  { size: 'S', chest: '86-89', waist: '66-69', hip: '92-95' },
                  { size: 'M', chest: '90-93', waist: '70-73', hip: '96-99' },
                  { size: 'L', chest: '94-97', waist: '74-77', hip: '100-103' },
                  { size: 'XL', chest: '98-101', waist: '78-81', hip: '104-107' },
                ].map((row) => (
                  <tr key={row.size} className="border-b border-nrs-ink/5 hover:bg-nrs-black/5 transition-colors">
                    <td className="py-4 px-4 font-medium">{row.size}</td>
                    <td className="py-4 px-4">{row.chest}</td>
                    <td className="py-4 px-4">{row.waist}</td>
                    <td className="py-4 px-4">{row.hip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
