'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-nrs-canvas text-nrs-ink layout-content">

      <main className="max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        {/* SECTION 1: NRS HAKKINDA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative aspect-[4/5] overflow-hidden"
          >
            <Image
              src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
              alt="NRS Modern Zarafet"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 border-[20px] border-white/20 pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.4em] text-nrs-ink/60 font-sans">NRS Hakkında</span>
              <h1 className="text-4xl md:text-6xl font-serif leading-tight">
                MODERN ZARAFETİN YENİ YORUMU
              </h1>
            </div>

            <div className="space-y-6 text-nrs-ink/70 font-light text-lg leading-relaxed">
              <p>
                NRS, modern kadının stilini özgün bir tasarım diliyle ifade etme tutkusundan doğdu.
                Çağdaş kadın modasını; güçlü silüetler, rafine detaylar ve seçkin kumaşların kusursuz dengesiyle yeniden yorumlayan premium bir kadın giyim markasıyız.
              </p>
              <p>
                Bizim için moda, yalnızca sezon trendlerini takip etmek değil; zamansız tasarım anlayışını modern terzilikle buluşturmaktır.
                Bir giysinin kesimi, dokusu ve hareketi, onu taşıyan kişinin karakterini yansıtan sessiz bir dile dönüşür.
              </p>
              <p>
                Tasarım felsefemizin merkezinde &quot;daha fazla&quot; yerine &quot;daha anlamlı&quot; yaklaşımı yer alır.
                Seçkin kumaşlar ve dengeli oranlar ile hayat verdiğimiz <Link href="/collections" className="underline underline-offset-4 decoration-nrs-black/20 hover:decoration-nrs-black transition-colors">koleksiyonlarımız</Link>,
                yalnızca estetik bir görünüm değil, aynı zamanda kişisel bir ifade biçimi sunar.
              </p>
              <p>
                Modern silüetler ve rafine detaylarla örülü dünyamızda, lüksü gösterişte değil, tasarımın ve işçiliğin detaylarında arıyoruz.
              </p>
            </div>
          </motion.div>
        </div>

        {/* SECTION 2: NRS KADINI */}
        <div id="woman" className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="order-2 md:order-1 relative aspect-[4/5] overflow-hidden"
          >
            <Image
              src="https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop"
              alt="NRS Kadını"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 border-[20px] border-white/20 pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="order-1 md:order-2 space-y-8"
          >
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.4em] text-nrs-ink/60 font-sans">NRS Kadını</span>
              <h2 className="text-4xl md:text-6xl font-serif leading-tight">
                KENDİ TARZININ ÖZNESİ
              </h2>
            </div>

            <div className="space-y-6 text-nrs-ink/70 font-light text-lg leading-relaxed">
              <p>
                NRS kadını, dikkat çekmek için değil, kendisini ifade etmek için giyinir.
                Onun için stil, geçici bir görünümden ziyade, dünyaya karşı takındığı bilinçli bir duruş biçimidir.
                Özgüvenini detayların gücünden alan, başkalarının onayına ihtiyaç duymayan modern bir zarafeti temsil eder.
              </p>
              <p>
                Günlük hayatın dinamizminde keskin hatlı bir <Link href="/category/blazers" className="underline underline-offset-4 decoration-nrs-black/20 hover:decoration-nrs-black transition-colors">kadın blazer</Link>,
                özel bir akşamda akışkan bir <Link href="/category/dresses" className="underline underline-offset-4 decoration-nrs-black/20 hover:decoration-nrs-black transition-colors">kadın elbise</Link>
                ya da bir davette zamansız bir siluet...
                Her parça, onun hayatının farklı anlarına eşlik eden birer imza niteliğindedir.
              </p>
              <p>
                Kendi stilini bilen ve detaylara önem veren NRS kadını, zamansız stil anlayışını çağdaş moda ile harmanlayarak özgünlüğünü korur.
                Güçlü, zarif ve her zaman kendisi.
              </p>
            </div>
          </motion.div>
        </div>

        {/* SECTION 3: ATÖLYE */}
        <div id="atelier" className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative aspect-[4/5] overflow-hidden"
          >
            <Image
              src="https://images.unsplash.com/photo-1558769132-cb14497891a4?q=80&w=2070&auto=format&fit=crop"
              alt="NRS Atölye"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 border-[20px] border-white/20 pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.4em] text-nrs-ink/60 font-sans">Atölye</span>
              <h2 className="text-4xl md:text-6xl font-serif leading-tight">
                TASARIMIN DETAYA DÖNÜŞTÜĞÜ YER
              </h2>
            </div>

            <div className="space-y-6 text-nrs-ink/70 font-light text-lg leading-relaxed">
              <p>
                NRS Atölyesi, bir fikrin somut bir sanat eserine dönüştüğü, sabrın ve titizliğin ön planda olduğu bir üretim merkezidir.
                Her tasarım, önce zihinde bir silüet olarak belirir; ardından oranlar, kumaş seçimi ve kesim aşamalarıyla hayat bulur.
              </p>
              <p>
                Tasarım sürecimiz; doğru kumaşın seçimiyle başlar, milimetrik kesimlerle devam eder ve usta bir terzilik anlayışıyla son dokunuşuna ulaşır.
                Dikişlerin her bir hattı, kumaşın her bir kıvrımı, lüksün yalnızca bir etiket değil, bir deneyim olduğu inancıyla işlenir.
              </p>
              <p>
                Sınırlı üretim anlayışını benimsediğimiz atölyemizde, gösterişli detaylar yerine rafine ve anlamlı detaylara odaklanırız.
                Kaliteyi, malzemenin saflığında ve işçiliğin kusursuzluğunda arayan bir yaklaşımla, her parçayı özel bir tasarım objesi olarak ele alırız.
              </p>
              <p>
                NRS için gerçek lüks, görünmeyenin içindeki özenle gizlidir.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
