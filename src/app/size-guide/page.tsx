'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import { useLocale } from '@/context/LocaleContext';
import { SIZE_CHART } from '@/lib/size-chart';
import { whatsappNumber, whatsappUrl } from '@/lib/storefront-config';

export default function SizeGuidePage() {
  const { locale } = useLocale();
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr;
  const range = ([low, high]: [number, number]) => `${low}–${high}`;
  const steps = [
    [copy('Göğüs', 'Bust', 'الصدر'), copy('Mezurayı göğsün en dolgun noktasından, yere paralel geçirin.', 'Measure around the fullest part of the bust, keeping the tape level.', 'قيسي حول أعرض جزء من الصدر مع إبقاء الشريط مستوياً.')],
    [copy('Bel', 'Waist', 'الخصر'), copy('Belin en ince yerini, mezurayı sıkmadan ölçün.', 'Measure the narrowest part of the waist without pulling the tape tight.', 'قيسي أضيق جزء من الخصر دون شد الشريط.')],
    [copy('Basen', 'Hips', 'الورك'), copy('Kalçanın en geniş yerini, ayaklar bitişikken ölçün.', 'Measure the widest part of the hips with feet together.', 'قيسي أعرض جزء من الورك مع ضم القدمين.')],
  ];
  return (
    <div className="min-h-screen bg-nrs-canvas text-nrs-ink layout-content">

      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-serif tracking-tight"
            >
              {copy('BEDEN REHBERİ', 'SIZE GUIDE', 'دليل المقاسات')}
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-nrs-ink/70">
              {copy('Her parça siparişinizle birlikte size özel dikilir. Tablodaki değerler vücut ölçüleridir; harf ve numara bedenlerimiz aynıdır.', 'Every piece is made to order for you. The values below are body measurements; our letter and number sizes are the same.', 'تُصنع كل قطعة خصيصاً لطلبك. القيم أدناه قياسات للجسم، ومقاساتنا بالحروف والأرقام متطابقة.')}
            </p>
          </div>

          <div className="border border-nrs-ink/10 bg-nrs-panel p-5 sm:p-8">
            <h2 className="text-sm uppercase tracking-widest font-medium">{copy('Vücut ölçüleri (cm)', 'Body measurements (cm)', 'قياسات الجسم (سم)')}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[24rem] border-collapse text-left text-sm tabular-nums">
                <thead><tr className="border-b border-nrs-ink/20 text-[11px] uppercase tracking-wider text-nrs-ink/60">
                  <th scope="col" className="py-2 pr-3 font-normal">{copy('Harf', 'Letter', 'حرف')}</th>
                  <th scope="col" className="py-2 pr-3 font-normal">{copy('Numara', 'Number', 'رقم')}</th>
                  <th scope="col" className="py-2 pr-3 font-normal">{copy('Göğüs', 'Bust', 'الصدر')}</th>
                  <th scope="col" className="py-2 pr-3 font-normal">{copy('Bel', 'Waist', 'الخصر')}</th>
                  <th scope="col" className="py-2 font-normal">{copy('Basen', 'Hips', 'الورك')}</th>
                </tr></thead>
                <tbody>{SIZE_CHART.map(row => <tr key={row.numeric} className="border-b border-nrs-ink/10">
                  <th scope="row" className="py-3 pr-3 font-medium">{row.letter}</th>
                  <td className="py-3 pr-3">{row.numeric}</td>
                  <td className="py-3 pr-3">{range(row.chest)}</td>
                  <td className="py-3 pr-3">{range(row.waist)}</td>
                  <td className="py-3">{range(row.hips)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-6 text-nrs-ink/60">{copy('Elbiselerimiz 32–44 numara, diğer ürünlerimiz S–XL harf bedenleriyle sunulur. Hangi bedenin sunulduğunu ürün sayfasında görebilirsiniz.', 'Our dresses come in sizes 32–44 and our other pieces in S–XL. Each product page shows which sizes it offers.', 'تتوفر فساتيننا بالمقاسات 32–44 وباقي القطع بالمقاسات S–XL. تعرض صفحة كل منتج المقاسات المتاحة له.')}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-nrs-panel p-6 sm:p-8 border border-nrs-ink/5 space-y-4">
              <h2 className="text-sm uppercase tracking-widest font-medium">{copy('Nasıl ölçülür?', 'How to measure', 'كيف تأخذين القياسات؟')}</h2>
              <ul className="space-y-3 text-sm leading-6 text-nrs-ink/70">
                {steps.map(([label, text]) => <li key={label}><strong className="font-medium text-nrs-ink">{label}:</strong> {text}</li>)}
              </ul>
            </div>
            <div className="bg-nrs-panel p-6 sm:p-8 border border-nrs-ink/5 space-y-4">
              <h2 className="text-sm uppercase tracking-widest font-medium">{copy('İki beden arasındaysanız', 'Between two sizes?', 'بين مقاسين؟')}</h2>
              <p className="text-sm leading-6 text-nrs-ink/70">{copy('Bir büyük bedeni seçin ve ürün sayfasındaki “Bedenimi bul” ile ölçülerinizi siparişe ekleyin. Atölyemiz dikimde ölçülerinizi esas alır; bunun için ek ücret alınmaz.', 'Choose the larger size and add your measurements with “Find my size” on the product page. Our atelier cuts to them at no extra charge.', 'اختاري المقاس الأكبر وأضيفي قياساتك عبر «اعرفي مقاسك» في صفحة المنتج. يعتمدها مشغلنا عند الخياطة دون رسوم إضافية.')}</p>
              {whatsappNumber && <a href={whatsappUrl(copy('Merhaba, beden konusunda yardım almak istiyorum.', 'Hello, I would like help with sizing.', 'مرحبًا، أود المساعدة في اختيار المقاس.')) ?? undefined} target="_blank" rel="noopener noreferrer"
                className="inline-block text-sm underline underline-offset-4 hover:text-nrs-ink">{copy('WhatsApp’tan beden danışın', 'Ask about sizing on WhatsApp', 'استشيري المقاس عبر واتساب')}</a>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
