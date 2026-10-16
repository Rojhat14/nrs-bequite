'use client';

import { LEGAL_SELLER } from '@/lib/legal/documents';
import React, { useState } from 'react';
import { m as motion } from 'framer-motion';
import { contactEmail, contactPhone, contactPhoneLabel, contactAddress, whatsappUrl } from '@/lib/storefront-config';
import { useLocale } from '@/context/LocaleContext';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const { locale } = useLocale();
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr;
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
            <h1 className="text-4xl md:text-6xl font-serif tracking-tight">{copy('İLETİŞİM', 'CONTACT', 'تواصل معنا')}</h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-ink/60 font-sans leading-relaxed max-w-xl mx-auto italic">
              {copy('Size yardımcı olmaktan mutluluk duyarız. Sorularınız, özel talepleriniz veya iş birlikleri için bizimle iletişime geçebilirsiniz.', 'We are happy to help. Contact us with questions, special requests or collaboration enquiries.', 'يسعدنا مساعدتك. تواصلي معنا للاستفسارات أو الطلبات الخاصة أو فرص التعاون.')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mt-20 text-left">
            <div className="space-y-8">
              <div className="space-y-2 text-sm leading-6">
                <h2 className="text-xs uppercase tracking-widest font-medium">{copy('Şirket bilgileri', 'Company details', 'بيانات الشركة')}</h2>
                <p>{LEGAL_SELLER.name}</p>
                <p><bdi>{copy('Vergi dairesi', 'Tax office', 'مكتب الضرائب')}</bdi>: <bdi>{LEGAL_SELLER.taxOffice}</bdi> · <bdi>{copy('Vergi numarası', 'Tax number', 'الرقم الضريبي')}</bdi>: <bdi>{LEGAL_SELLER.taxNumber}</bdi></p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest font-medium">{copy('E-posta', 'Email', 'البريد الإلكتروني')}</h3>
                <p className="text-sm font-sans text-nrs-ink/70 break-all">{contactEmail ? <a href={`mailto:${contactEmail}`} dir="ltr">{contactEmail}</a> : copy('İletişim bilgilerimiz yakında paylaşılacak.', 'Our contact details will be shared soon.', 'ستُتاح بيانات التواصل قريباً.')}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest font-medium">{copy('Telefon / WhatsApp', 'Phone / WhatsApp', 'الهاتف / واتساب')}</h3>
                {contactPhone && <a className="inline-flex min-h-11 items-center text-sm text-nrs-ink/70" href={`tel:${contactPhone}`}>{contactPhoneLabel}</a>}
                {whatsappUrl(copy('Merhaba NRS, web siteniz üzerinden iletişime geçiyorum.', 'Hello NRS, I am contacting you through your website.', 'مرحباً NRS، أتواصل معكم عبر موقعكم الإلكتروني.')!) && <a href={whatsappUrl(copy('Merhaba NRS, web siteniz üzerinden iletişime geçiyorum.', 'Hello NRS, I am contacting you through your website.', 'مرحباً NRS، أتواصل معكم عبر موقعكم الإلكتروني.')!)!} target="_blank" rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-center border border-nrs-ink/30 px-4 py-4 text-xs uppercase tracking-widest hover:bg-nrs-ink/5 focus-visible:outline focus-visible:outline-2">
                  {copy('WhatsApp üzerinden bize ulaşın', 'Contact us on WhatsApp', 'تواصلي معنا عبر واتساب')}
                </a>}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest font-medium">{copy('Adres', 'Address', 'العنوان')}</h3>
                <p className="text-sm font-sans text-nrs-ink/70">{contactAddress}</p>
              </div>

            </div>

            <div className="bg-nrs-panel p-8 border border-nrs-ink/5 shadow-sm space-y-6">
              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <p className="text-xs uppercase tracking-widest text-nrs-rosegold font-sans">{copy('Teşekkürler', 'Thank you', 'شكراً لكِ')}</p>
                  <h3 className="text-2xl font-serif text-nrs-ink">{copy('E-posta uygulamanızdan gönderin', 'Send from your email application', 'أرسلي الرسالة من تطبيق البريد الإلكتروني')}</h3>
                  <p className="text-xs text-nrs-ink/60 font-sans leading-relaxed">
                    {copy('Mesajınızı e-posta uygulamanızda göndermeniz gerekiyor. Gönderilene kadar talebiniz bize ulaşmaz.', 'You need to send your message in your email application. We will not receive it until it is sent.', 'يجب إرسال رسالتك من تطبيق البريد الإلكتروني. لن يصلنا الطلب قبل الإرسال.')}
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-4 text-[10px] uppercase tracking-widest text-nrs-ink border-b border-nrs-ink pb-1 hover:text-nrs-rosegold transition-colors"
                  >
                    {copy('Yeni mesaj gönder', 'Send a new message', 'إرسال رسالة جديدة')}
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!contactEmail) return;
                    const data = new FormData(e.currentTarget);
                    const body = `${copy('Ad Soyad', 'Name', 'الاسم')}: ${data.get('name')}\n${copy('E-posta', 'Email', 'البريد الإلكتروني')}: ${data.get('email')}\n\n${data.get('message')}`;
                    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(copy('NRS İletişim', 'NRS Enquiry', 'استفسار إلى NRS'))}&body=${encodeURIComponent(body)}`;
                    setSubmitted(true);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label htmlFor="contact-name" className="text-[10px] uppercase tracking-widest text-nrs-ink/60 block">{copy('Ad Soyad', 'Full name', 'الاسم الكامل')}</label>
                    <input id="contact-name" name="name" autoComplete="name" maxLength={120} required type="text" className="w-full bg-transparent border-b border-nrs-ink/10 py-2 focus:outline-none focus:border-nrs-ink transition-colors text-sm" placeholder={copy('Adınız Soyadınız', 'Your name', 'اسمك الكامل')} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-email" className="text-[10px] uppercase tracking-widest text-nrs-ink/60 block">{copy('E-posta', 'Email', 'البريد الإلكتروني')}</label>
                    <input id="contact-email" name="email" autoComplete="email" maxLength={254} required type="email" dir="ltr" className="w-full bg-transparent border-b border-nrs-ink/10 py-2 focus:outline-none focus:border-nrs-ink transition-colors text-sm" placeholder="email@example.com" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-message" className="text-[10px] uppercase tracking-widest text-nrs-ink/60 block">{copy('Mesajınız', 'Your message', 'رسالتك')}</label>
                    <textarea id="contact-message" name="message" maxLength={3000} required rows={4} className="w-full bg-transparent border-b border-nrs-ink/10 py-2 focus:outline-none focus:border-nrs-ink transition-colors text-sm" placeholder={copy('Mesajınızı buraya yazın…', 'Write your message here…', 'اكتبي رسالتك هنا…')}></textarea>
                  </div>
                  <button type="submit" disabled={!contactEmail} className="w-full py-4 bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory uppercase tracking-widest text-[10px] hover:bg-nrs-charcoal transition-all duration-500 disabled:opacity-50">
                    {copy('E-POSTA UYGULAMASINDA AÇ', 'OPEN EMAIL APPLICATION', 'فتح تطبيق البريد الإلكتروني')}
                  </button>
                  {!contactEmail && <p role="status" className="text-xs text-nrs-ink/60">{copy('İletişim formu şu anda kullanılamıyor.', 'The contact form is currently unavailable.', 'نموذج التواصل غير متاح حالياً.')}</p>}
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
