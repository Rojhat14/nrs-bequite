'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import { useLocale } from '@/context/LocaleContext';

export default function CareGuidePage() {
  const { locale } = useLocale();
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr;
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
              {copy('BAKIM REHBERİ', 'CARE GUIDE', 'دليل العناية')}
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-ink/60 font-sans italic text-sm">
              {copy('Yatırımlarınızı koruyun. Parçalarınızın ömrünü uzatacak bakım önerileri.', 'Care guidance to help preserve your pieces and extend their useful life.', 'إرشادات عناية تساعد على الحفاظ على قطعك وإطالة عمرها.')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12">
            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">{copy('Kumaş bakımı', 'Fabric care', 'العناية بالأقمشة')}</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                {copy('NRS koleksiyonlarında kullanılan ipek, yün ve saten gibi hassas kumaşlar, özel bakım gerektirir. Ürünlerimizin formunu ve dokusunu korumak için profesyonel kuru temizleme önerilir.', 'Delicate fabrics such as silk, wool and satin in the NRS collections require particular care. Professional dry cleaning is recommended to help preserve the garment’s shape and texture.', 'تتطلب الأقمشة الحساسة مثل الحرير والصوف والساتان في مجموعات NRS عناية خاصة. يُنصح بالتنظيف الجاف لدى مختص للمساعدة في الحفاظ على شكل القطعة وملمسها.')}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">{copy('Yıkama ve kurutma', 'Washing and drying', 'الغسل والتجفيف')}</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                {copy('Elde yıkama gerektiren parçalar için soğuk su ve nötr deterjanlar kullanınız. Asla kurutma makinesi kullanmayınız; ürünlerinizi gölge ve havadar bir yerde, düz bir zemine sererek kurutunuz.', 'For pieces that require hand washing, use cold water and a neutral detergent. Do not use a tumble dryer; dry garments flat in a shaded, well-ventilated place.', 'للقطع التي تتطلب الغسل اليدوي، استخدمي ماءً بارداً ومنظفاً محايداً. لا تستخدمي مجفف الملابس؛ جففي القطع مسطحة في مكان مظلل وجيد التهوية.')}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">{copy('Ütüleme', 'Ironing', 'الكي')}</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                {copy('Ütüleme yaparken kumaşın tersini çeviriniz ve düşük ısı kullanınız. Hassas kumaşlar için ütü ile kumaş arasında ince bir tülbent kullanmanız önerilir.', 'Turn the garment inside out and use a low heat setting. For delicate fabrics, place a thin pressing cloth between the iron and the fabric.', 'اقلبي القطعة إلى الداخل واستخدمي حرارة منخفضة. للأقمشة الحساسة، ضعي قطعة قماش رقيقة بين المكواة والقماش.')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
