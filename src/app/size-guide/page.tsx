'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function SizeGuidePage() {
  return (
    <div className="min-h-screen bg-nrs-ivory text-nrs-black layout-content">

      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-serif tracking-tight"
            >
              BEDEN REHBERİ
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-black/60 font-sans italic text-sm">
              Size en uygun parçayı bulmanıza yardımcı olmak için hazırladığımız ölçü tablosu.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-nrs-black/10">
                  <th className="py-4 px-4 text-xs uppercase tracking-widest font-medium">Beden</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-widest font-medium">Göğüs (cm)</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-widest font-medium">Bel (cm)</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-widest font-medium">Basen (cm)</th>
                </tr>
              </thead>
              <tbody className="text-sm font-sans text-nrs-black/70">
                {[
                  { size: 'XS', chest: '82-85', waist: '62-65', hip: '88-91' },
                  { size: 'S', chest: '86-89', waist: '66-69', hip: '92-95' },
                  { size: 'M', chest: '90-93', waist: '70-73', hip: '96-99' },
                  { size: 'L', chest: '94-97', waist: '74-77', hip: '100-103' },
                  { size: 'XL', chest: '98-101', waist: '78-81', hip: '104-107' },
                ].map((row) => (
                  <tr key={row.size} className="border-b border-nrs-black/5 hover:bg-nrs-black/5 transition-colors">
                    <td className="py-4 px-4 font-medium">{row.size}</td>
                    <td className="py-4 px-4">{row.chest}</td>
                    <td className="py-4 px-4">{row.waist}</td>
                    <td className="py-4 px-4">{row.hip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-8 border border-nrs-black/5 space-y-4">
            <h3 className="text-sm uppercase tracking-widest font-medium">Nasıl Ölçülür?</h3>
            <p className="text-sm text-nrs-black/60 leading-relaxed font-sans">
              Mezurayı vücudunuzun en geniş noktalarından geçirerek, çok sıkmadan ve çok gevşek bırakmadan ölçüm yapmanızı öneririz. Eğer iki beden arasındaysanız, daha rahat bir kullanım için bir üst bedeni tercih edebilirsiniz.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
