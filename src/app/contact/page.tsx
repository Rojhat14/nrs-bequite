'use client';

import React from 'react';
import Navigation from '@/components/Navigation';
import { motion } from 'framer-motion';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-nrs-ivory text-nrs-black layout-content">
      <Navigation />

      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-4"
          >
            <h1 className="text-4xl md:text-6xl font-serif tracking-tight">İLETİŞİM</h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-black/60 font-sans leading-relaxed max-w-xl mx-auto italic">
              Size yardımcı olmaktan mutluluk duyarız. Sorularınız, özel talepleriniz veya iş birlikleri için bizimle iletişime geçebilirsiniz.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mt-20 text-left">
            <div className="space-y-8">
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest font-medium">E-posta</h3>
                <p className="text-sm font-sans text-nrs-black/70">info@nrs.com</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest font-medium">Atölye</h3>
                <p className="text-sm font-sans text-nrs-black/70">Nişantaşı, İstanbul / Türkiye</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest font-medium">Çalışma Saatleri</h3>
                <p className="text-sm font-sans text-nrs-black/70">Pazartesi - Cumartesi: 10:00 - 19:00</p>
              </div>
            </div>

            <div className="bg-white p-8 border border-nrs-black/5 shadow-sm space-y-6">
              <form className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-nrs-black/40 block">Ad Soyad</label>
                  <input type="text" className="w-full bg-transparent border-b border-nrs-black/10 py-2 focus:outline-none focus:border-nrs-black transition-colors text-sm" placeholder="Adınız Soyadınız" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-nrs-black/40 block">E-posta</label>
                  <input type="email" className="w-full bg-transparent border-b border-nrs-black/10 py-2 focus:outline-none focus:border-nrs-black transition-colors text-sm" placeholder="eposta@ornek.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-nrs-black/40 block">Mesajınız</label>
                  <textarea rows={4} className="w-full bg-transparent border-b border-nrs-black/10 py-2 focus:outline-none focus:border-nrs-black transition-colors text-sm" placeholder="Mesajınızı buraya yazın..."></textarea>
                </div>
                <button className="w-full py-4 bg-nrs-black text-nrs-ivory uppercase tracking-widest text-[10px] hover:bg-nrs-charcoal transition-all duration-500">
                  GÖNDER
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
