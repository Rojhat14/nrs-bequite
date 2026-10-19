import type { LegalDocument } from './versions/v1'
import { DOCUMENTS_V1_4 } from './versions/v1-4'
import { localizeLegalDocument } from './translations-v1-4'

const revisedEN = 'Customers may continue by selecting one of the numeric sizes available on the product page. Chest, waist, hip, height and other personal measurements are optional; customers may enter only the measurements they know. Selecting a standard size alone does not mean that an item is individually customised or limit mandatory consumer rights. If a separate personalisation option is offered, its scope and terms are disclosed before the order.'
const revisedAR = 'يمكن متابعة الطلب باختيار أحد المقاسات الرقمية المتاحة في صفحة المنتج. قياسات الصدر والخصر والأرداف والطول وغيرها من القياسات الشخصية اختيارية؛ ويمكن إدخال القياسات المعروفة فقط. ولا يعني اختيار المقاس القياسي وحده أن المنتج صُنع خصيصاً للفرد، ولا يقيّد حقوق المستهلك الإلزامية. وإذا عُرض خيار تخصيص منفصل، فيُوضح نطاقه وشروطه قبل الطلب.'
const privacyEN = 'Chest, waist, hip, height, shoulder, arm, garment and inseam measurements are optional. If a customer provides them, they are used only to assist with the relevant order. Health information is not requested. Measurements are not automatically reused for advertising, customer profiling or other orders. If retention is required as legal evidence, use is limited to protecting the relevant right.'
const privacyAR = 'قياسات الصدر والخصر والأرداف والطول والكتفين والذراع والقطعة وطول الساق الداخلي اختيارية. وإذا قدمها العميل، فتُستخدم للمساعدة في تجهيز الطلب المعني فقط. ولا تُطلب معلومات صحية. ولا يُعاد استخدام القياسات تلقائياً للإعلان أو تصنيف العملاء أو الطلبات الأخرى. وإذا لزم الاحتفاظ بها كدليل قانوني، يقتصر استخدامها على حماية الحق المعني.'
const productEN = 'Before ordering, check the product, selected numeric size, any optional measurements you choose to provide, delivery address, free shipping, the total 7–10 business-day delivery period from order confirmation (including preparation and transit), and the final total.'
const productAR = 'قبل الطلب، تحققوا من المنتج والمقاس الرقمي المختار وأي قياسات اختيارية ترغبون في تقديمها وعنوان التوصيل والشحن المجاني وإجمالي مدة التوصيل 7–10 أيام عمل من تأكيد الطلب، شاملةً التجهيز والنقل، ومن الإجمالي النهائي.'

function reviseParagraph(text: string, locale: 'en' | 'ar') {
  if (locale === 'en') {
    if (text.startsWith('All NRS garments are made according to the body measurements')) return revisedEN
    if (text.startsWith('NRS garments are made to measure using the body measurements')) return productEN
    if (text.startsWith('Chest, waist, hip, height, shoulder, arm, garment and inseam measurements are collected only')) return privacyEN
  } else {
    if (text.startsWith('تُخاط قطع NRS وفق قياسات جسم العميل')) return revisedAR
    if (text.startsWith('تُصنع ملابس NRS حسب قياسات جسم العميل المقدمة')) return productAR
    if (text.startsWith('تُجمع قياسات الصدر والخصر والأرداف والطول والكتفين والذراع والقطعة')) return privacyAR
    if (text.startsWith('تُجهز جميع ملابس NRS وفق قياسات جسم العميل')) return revisedAR
  }
  return text
}

/** v1.5 retains v1.4's reviewed translations, replacing only paragraphs whose
 * Turkish source was revised. The original v1.4 archive and fingerprint stay
 * untouched for prior order acceptances. */
export function localizeLegalDocumentV1_5(slug: string, document: LegalDocument, locale: 'tr' | 'en' | 'ar') {
  if (locale === 'tr') return { document, complete: true, sourceVersion: 'v1.5' }
  const source = DOCUMENTS_V1_4[slug]
  if (!source) return { document, complete: false, sourceVersion: 'v1.5' }
  const localized = localizeLegalDocument(slug, source, DOCUMENTS_V1_4, locale)
  if (!localized.complete) return { document, complete: false, sourceVersion: 'v1.5' }
  const translated: LegalDocument = {
    title: localized.document.title,
    sections: localized.document.sections.map(section => ({
      title: section.title,
      paragraphs: section.paragraphs.map(paragraph => reviseParagraph(paragraph, locale)),
    })),
  }
  return { document: translated, complete: true, sourceVersion: 'v1.5' }
}
