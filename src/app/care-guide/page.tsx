'use client';

import React from 'react';
import { m as motion } from 'framer-motion';

export default function CareGuidePage() {
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
              BAKIM REHBERİ
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-ink/60 font-sans italic text-sm">
              Yatırımlarınızı koruyun. Parçalarınızın ömrünü uzatacak bakım önerileri.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12">
            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">Kumaş Bakımı</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                NRS koleksiyonlarında kullanılan ipek, yün ve saten gibi hassas kumaşlar, özel bakım gerektirir. Ürünlerimizin formunu ve dokusunu korumak için profesyonel kuru temizleme önerilir.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">Yıkama ve Kurutma</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                Elde yıkama gerektiren parçalar için soğuk su ve nötr deterjanlar kullanınız. Asla kurutma makinesi kullanmayınız; ürünlerinizi gölge ve havadar bir yerde, düz bir zemine sererek kurutunuz.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif text-nrs-ink">Ütüleme</h3>
              <p className="text-nrs-ink/60 font-sans leading-relaxed text-sm">
                Ütüleme yaparken kumaşın tersini çeviriniz ve düşük ısı kullanınız. Hassas kumaşlar için ütü ile kumaş arasında ince bir tülbent kullanmanız önerilir.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
