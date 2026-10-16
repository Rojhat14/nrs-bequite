'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import { useCardPaymentEnabled } from '@/lib/feature-flags';
import { useLocale } from '@/context/LocaleContext';

export default function FAQPage() {
  const ENABLE_CARD_PAYMENT = useCardPaymentEnabled();
  const { locale } = useLocale();
  const faqsTr = [
    { q: 'Kargo ücreti ve teslimat süresi nedir?', a: 'Türkiye genelinde ücretsiz kargo. Sipariş onayından itibaren özel dikim üretimi ve kargo taşımacılığı dahil toplam 7–10 iş günü içerisinde teslimat. Ek kargo süresi eklenmez.' },
    {
      q: 'Siparişimi nasıl takip edebilirim?',
      a: 'Kargo firması henüz belirlenmedi; anlaşmalı taşıyıcı veya takip hizmeti taahhüt edilmez. Teslimat durumunu şirket iletişim e-postasından sorabilirsiniz.'
    },
    {
      q: 'İade süreci nasıl işliyor?',
      a: 'Kıyafetler müşterinin ölçülerine göre özel dikilir. Cayma hakkı istisnası yalnızca mevzuattaki koşullar oluştuğunda uygulanır; ayıplı ürün hakları korunur. Cayma hakkının geçerli olduğu ürünlerde teslimden itibaren 14 gün içinde bildirim yapılabilir. İletişim ve ayrıntılar İade ve Değişim Koşulları sayfasındadır.'
    },
    {
      q: 'Ödeme yöntemleriniz nelerdir?',
      a: ENABLE_CARD_PAYMENT
        ? 'Online ödeme hizmetinin kullanılabilirliği ödeme ekranında bildirilir. Havale / EFT bilgileri sipariş teyidinde paylaşılır.'
        : 'WhatsApp üzerinden sipariş verebilirsiniz. Havale / EFT ve IBAN bilgileri sipariş onayı sırasında paylaşılır.'
    },
    {
      q: 'Kişiye özel ölçü ile üretim yapıyor musunuz?',
      a: 'Bütün kıyafetler ürün bazında ilettiğiniz zorunlu beden ölçülerine göre özel dikilir.'
    },
  ];
  const faqs = locale === 'tr' ? faqsTr : locale === 'en' ? [
    { q: 'What are the shipping cost and delivery time?', a: 'Shipping is free within Türkiye. Delivery takes a total of 7–10 business days from order approval, including made-to-measure production and shipping. No additional shipping time is added.' },
    { q: 'How can I track my order?', a: 'A carrier has not yet been selected; no carrier or tracking service is promised. You can ask about delivery status at the company contact email.' },
    { q: 'How do returns work?', a: 'Garments are made to the customer’s measurements. An exception to the right of withdrawal applies only when legal conditions are met; rights for defective goods remain protected. For products eligible for withdrawal, notice may be given within 14 days of delivery. See the Returns and Exchanges Terms for contact details and more information.' },
    { q: 'Which payment methods are available?', a: ENABLE_CARD_PAYMENT ? 'Availability of online payment is shown at checkout. Bank transfer details are shared when the order is confirmed.' : 'You can send an order request via WhatsApp. Bank transfer and IBAN details are shared when the order is confirmed.' },
    { q: 'Are garments made to personal measurements?', a: 'Garments are made to the required body measurements provided for each product.' },
  ] : [
    { q: 'ما تكلفة الشحن ومدة التوصيل؟', a: 'الشحن مجاني داخل تركيا. يستغرق التوصيل من تاريخ تأكيد الطلب 7 إلى 10 أيام عمل إجمالاً، شاملاً تجهيز القطعة حسب المقاس والشحن. لا تُضاف مدة شحن أخرى.' },
    { q: 'كيف يمكنني متابعة طلبي؟', a: 'لم يتم تحديد شركة الشحن بعد؛ ولا يوجد وعد بناقل معين أو خدمة تتبع. يمكنك الاستفسار عن حالة التوصيل عبر البريد الإلكتروني للشركة.' },
    { q: 'كيف تتم عمليات الإرجاع؟', a: 'تُجهز الملابس وفق قياسات العميل. لا يُطبق استثناء حق العدول إلا عند تحقق الشروط القانونية، وتظل حقوق المنتجات المعيبة محفوظة. بالنسبة إلى المنتجات التي يسري عليها حق العدول، يمكن تقديم الإخطار خلال 14 يوماً من التسليم. راجعي شروط الإرجاع والاستبدال للتواصل والتفاصيل.' },
    { q: 'ما طرق الدفع المتاحة؟', a: ENABLE_CARD_PAYMENT ? 'تظهر إمكانية الدفع الإلكتروني في صفحة إتمام الطلب. وتُشارك معلومات التحويل البنكي عند تأكيد الطلب.' : 'يمكنك إرسال طلب شراء عبر واتساب. وتُشارك معلومات التحويل البنكي ورقم الآيبان عند تأكيد الطلب.' },
    { q: 'هل تُجهز الملابس وفق القياسات الشخصية؟', a: 'تُجهز الملابس وفق قياسات الجسم المطلوبة المرسلة لكل منتج.' },
  ];
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
              {copy('S.S.S.', 'FAQ', 'الأسئلة الشائعة')}
            </motion.h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto"></div>
            <p className="text-nrs-ink/60 font-sans italic text-sm">
              {copy('Sıkça sorulan sorular ve yanıtları.', 'Frequently asked questions and answers.', 'إجابات عن الأسئلة الشائعة.')}
            </p>
          </div>

          <div className="space-y-8">
            {faqs.map((faq, index) => (
              <div key={index} className="space-y-2 border-b border-nrs-ink/10 pb-8">
                <h3 className="text-lg font-serif text-nrs-ink leading-snug">
                  {faq.q}
                </h3>
                <p className="text-sm text-nrs-ink/60 font-sans leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
