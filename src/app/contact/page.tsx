'use client';

import { LEGAL_SELLER } from '@/lib/legal/documents';
import React, { useState } from 'react';
import { m as motion } from 'framer-motion';
import { contactEmail, contactPhone, contactPhoneLabel, contactAddress, whatsappUrl } from '@/lib/storefront-config';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="min-h-screen bg-nrs-canvas text-nrs-ink layout-content">

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
            <p className="text-nrs-ink/60 font-sans leading-relaxed max-w-xl mx-auto italic">
              Size yardımcı olmaktan mutluluk duyarız. Sorularınız, özel talepleriniz veya iş birlikleri için bizimle iletişime geçebilirsiniz.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mt-20 text-left">
            <div className="space-y-8">
              <div className="space-y-2 text-sm leading-6">
                <h2 className="text-xs uppercase tracking-widest font-medium">Şirket bilgileri</h2>
                <p>{LEGAL_SELLER.name}</p>
                <p>Vergi dairesi: {LEGAL_SELLER.taxOffice} · Vergi numarası: {LEGAL_SELLER.taxNumber}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest font-medium">E-posta</h3>
                <p className="text-sm font-sans text-nrs-ink/70 break-all">{contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : 'İletişim bilgilerimiz yakında paylaşılacak.'}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest font-medium">Telefon / WhatsApp</h3>
                {contactPhone && <a className="inline-flex min-h-11 items-center text-sm text-nrs-ink/70" href={`tel:${contactPhone}`}>{contactPhoneLabel}</a>}
                {whatsappUrl() && <a href={whatsappUrl('Merhaba NRS, web siteniz üzerinden iletişime geçiyorum.')!} target="_blank" rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-center border border-nrs-ink/30 px-4 py-4 text-xs uppercase tracking-widest hover:bg-nrs-ink/5 focus-visible:outline focus-visible:outline-2">
                  WhatsApp&apos;tan bize ulaşın
                </a>}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest font-medium">Adres</h3>
                <p className="text-sm font-sans text-nrs-ink/70">{contactAddress}</p>
              </div>

            </div>

            <div className="bg-nrs-panel p-8 border border-nrs-ink/5 shadow-sm space-y-6">
              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <p className="text-xs uppercase tracking-widest text-nrs-rosegold font-sans">Teşekkürler</p>
                  <h3 className="text-2xl font-serif text-nrs-ink">E-posta uygulamanızdan gönderin</h3>
                  <p className="text-xs text-nrs-ink/60 font-sans leading-relaxed">
                    Mesajınızı e-posta uygulamanızda göndermeniz gerekiyor. Gönderilene kadar talebiniz bize ulaşmaz.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-4 text-[10px] uppercase tracking-widest text-nrs-ink border-b border-nrs-ink pb-1 hover:text-nrs-rosegold transition-colors"
                  >
                    Yeni Mesaj Gönder
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!contactEmail) return;
                    const data = new FormData(e.currentTarget);
                    const body = `Ad Soyad: ${data.get('name')}\nE-posta: ${data.get('email')}\n\n${data.get('message')}`;
                    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent('NRS İletişim')}&body=${encodeURIComponent(body)}`;
                    setSubmitted(true);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label htmlFor="contact-name" className="text-[10px] uppercase tracking-widest text-nrs-ink/60 block">Ad Soyad</label>
                    <input id="contact-name" name="name" autoComplete="name" maxLength={120} required type="text" className="w-full bg-transparent border-b border-nrs-ink/10 py-2 focus:outline-none focus:border-nrs-ink transition-colors text-sm" placeholder="Adınız Soyadınız" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-email" className="text-[10px] uppercase tracking-widest text-nrs-ink/60 block">E-posta</label>
                    <input id="contact-email" name="email" autoComplete="email" maxLength={254} required type="email" className="w-full bg-transparent border-b border-nrs-ink/10 py-2 focus:outline-none focus:border-nrs-ink transition-colors text-sm" placeholder="eposta@ornek.com" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-message" className="text-[10px] uppercase tracking-widest text-nrs-ink/60 block">Mesajınız</label>
                    <textarea id="contact-message" name="message" maxLength={3000} required rows={4} className="w-full bg-transparent border-b border-nrs-ink/10 py-2 focus:outline-none focus:border-nrs-ink transition-colors text-sm" placeholder="Mesajınızı buraya yazın..."></textarea>
                  </div>
                  <button type="submit" disabled={!contactEmail} className="w-full py-4 bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory uppercase tracking-widest text-[10px] hover:bg-nrs-charcoal transition-all duration-500 disabled:opacity-50">
                    E-POSTA UYGULAMASINDA AÇ
                  </button>
                  {!contactEmail && <p role="status" className="text-xs text-nrs-ink/60">İletişim formu şu anda kullanılamıyor.</p>}
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
