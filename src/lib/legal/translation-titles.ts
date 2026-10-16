const documentTitles = {
  'mesafeli-satis-sozlesmesi': ['Distance Sales Agreement', 'اتفاقية البيع عن بُعد'],
  'on-bilgilendirme-formu': ['Pre-Contractual Information Form', 'نموذج المعلومات المسبقة'],
  'iade-ve-degisim': ['Returns and Exchanges', 'الإرجاع والاستبدال'],
  'iptal-kosullari': ['Cancellation Terms', 'شروط الإلغاء'],
  'gizlilik-politikasi': ['Privacy Policy', 'سياسة الخصوصية'],
  kvkk: ['Personal Data Protection Notice (KVKK)', 'إشعار حماية البيانات الشخصية (KVKK)'],
  'kullanim-kosullari': ['Terms of Use', 'شروط الاستخدام'],
  'kargo-ve-teslimat': ['Shipping and Delivery', 'الشحن والتوصيل'],
} as const

export function localizedLegalTitle(slug: string, locale: 'tr' | 'en' | 'ar') {
  if (locale === 'tr') return null
  const titles = documentTitles[slug as keyof typeof documentTitles]
  return titles?.[locale === 'en' ? 0 : 1] ?? null
}

export { documentTitles }
