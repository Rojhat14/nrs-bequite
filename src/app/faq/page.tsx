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
      a: 'Ürün sayfasında sunulan beden seçeneklerinden biriyle sipariş verebilirsiniz; kişisel ölçü paylaşmak isteğe bağlıdır. Standart beden seçimi tek başına kişiye özel üretim veya cayma hakkı istisnası oluşturmaz. Ayıplı ürün hakları korunur. Cayma hakkının geçerli olduğu ürünlerde teslimden itibaren 14 gün içinde bildirim yapılabilir. Ayrıntılar İade ve Değişim Koşulları sayfasındadır.'
    },
    {
      q: 'Ödeme yöntemleriniz nelerdir?',
      a: ENABLE_CARD_PAYMENT
        ? 'Online ödeme hizmetinin kullanılabilirliği ödeme ekranında bildirilir. Havale / EFT bilgileri sipariş teyidinde paylaşılır.'
        : 'WhatsApp üzerinden sipariş verebilirsiniz. Havale / EFT ve IBAN bilgileri sipariş onayı sırasında paylaşılır.'
    },
    {
      q: 'Kişiye özel ölçü ile üretim yapıyor musunuz?',
      a: 'Ürün sayfasında sunulan beden seçeneklerinden biriyle sipariş verebilirsiniz. Kişisel ölçü paylaşmak isteğe bağlıdır; yalnızca bildiğiniz ölçüleri girebilirsiniz.'
    },
  ];
  const faqs = locale === 'tr' ? faqsTr : locale === 'en' ? [
    { q: 'What are the shipping cost and delivery time?', a: 'Shipping is free within Türkiye. Delivery takes a total of 7–10 business days from order approval, including made-to-measure production and shipping. No additional shipping time is added.' },
    { q: 'How can I track my order?', a: 'A carrier has not yet been selected; no carrier or tracking service is promised. You can ask about delivery status at the company contact email.' },
    { q: 'How do returns work?', a: 'Choose a size offered on the product page; sharing personal measurements is optional. A standard size alone does not mean an item is individually customised or create an exception to the right of withdrawal. Rights for defective goods remain protected. For products eligible for withdrawal, notice may be given within 14 days of delivery. See the Returns and Exchanges Terms for details.' },
    { q: 'Which payment methods are available?', a: ENABLE_CARD_PAYMENT ? 'Availability of online payment is shown at checkout. Bank transfer details are shared when the order is confirmed.' : 'You can send an order request via WhatsApp. Bank transfer and IBAN details are shared when the order is confirmed.' },
    { q: 'Are personal measurements required?', a: 'No. You can select a size shown on the product page. Personal measurements are optional, and you may provide only the ones you know.' },
  ] : [
    { q: 'ما تكلفة الشحن ومدة التوصيل؟', a: 'الشحن مجاني داخل تركيا. يستغرق التوصيل من تاريخ تأكيد الطلب 7 إلى 10 أيام عمل إجمالاً، شاملاً تجهيز القطعة حسب المقاس والشحن. لا تُضاف مدة شحن أخرى.' },
    { q: 'كيف يمكنني متابعة طلبي؟', a: 'لم يتم تحديد شركة الشحن بعد؛ ولا يوجد وعد بناقل معين أو خدمة تتبع. يمكنك الاستفسار عن حالة التوصيل عبر البريد الإلكتروني للشركة.' },
    { q: 'كيف تتم عمليات الإرجاع؟', a: 'اختاري أحد المقاسات المعروضة في صفحة المنتج؛ وتقديم القياسات الشخصية اختياري. اختيار المقاس القياسي وحده لا يعني أن المنتج صُنع خصيصاً للفرد ولا ينشئ استثناءً من حق العدول. وتظل حقوق المنتجات المعيبة محفوظة. بالنسبة إلى المنتجات التي يسري عليها حق العدول، يمكن تقديم الإخطار خلال 14 يوماً من التسليم. راجعي شروط الإرجاع والاستبدال للتفاصيل.' },
    { q: 'ما طرق الدفع المتاحة؟', a: ENABLE_CARD_PAYMENT ? 'تظهر إمكانية الدفع الإلكتروني في صفحة إتمام الطلب. وتُشارك معلومات التحويل البنكي عند تأكيد الطلب.' : 'يمكنك إرسال طلب شراء عبر واتساب. وتُشارك معلومات التحويل البنكي ورقم الآيبان عند تأكيد الطلب.' },
    { q: 'هل القياسات الشخصية مطلوبة؟', a: 'لا. يمكنك اختيار مقاس معروض في صفحة المنتج. القياسات الشخصية اختيارية، ويمكنك تقديم القياسات التي تعرفينها فقط.' },
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
