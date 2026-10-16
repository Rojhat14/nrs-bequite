import { MEASUREMENT_HELP, MEASUREMENT_LABELS, type Measurements } from '@/lib/order-measurements'
import type { Locale } from './messages'

type Field = keyof typeof MEASUREMENT_LABELS
const localized = {
  chest: { en: 'Chest circumference', ar: 'محيط الصدر', helpEn: 'Measure horizontally around the fullest part of the chest.', helpAr: 'قيسي أفقياً حول أكثر مناطق الصدر امتلاءً.' },
  waist: { en: 'Waist circumference', ar: 'محيط الخصر', helpEn: 'Measure around the natural waist without pulling the tape tight.', helpAr: 'قيسي حول الخصر الطبيعي من دون شد شريط القياس.' },
  hips: { en: 'Hip circumference', ar: 'محيط الوركين', helpEn: 'Measure horizontally around the fullest part of the hips.', helpAr: 'قيسي أفقياً حول أعرض نقطة من الوركين.' },
  height: { en: 'Height', ar: 'الطول', helpEn: 'Measure barefoot from the top of the head to the floor.', helpAr: 'قيسي من أعلى الرأس إلى الأرض من دون حذاء.' },
  shoulder: { en: 'Shoulder width', ar: 'عرض الكتفين', helpEn: 'Measure across the back between the ends of the shoulders.', helpAr: 'قيسي عبر الظهر بين طرفي الكتفين.' },
  sleeve: { en: 'Sleeve length', ar: 'طول الكم', helpEn: 'Measure from the shoulder point to the wrist with the arm slightly bent.', helpAr: 'قيسي من طرف الكتف إلى المعصم مع ثني الذراع قليلاً.' },
  length: { en: 'Requested garment length', ar: 'الطول المطلوب للقطعة', helpEn: 'For dresses or tops, measure from the shoulder; for bottoms, from the waist to the desired hem.', helpAr: 'للفساتين والقطع العلوية، قيسي من الكتف؛ وللقطع السفلية، من الخصر إلى الطول المطلوب.' },
  inseam: { en: 'Inside leg length', ar: 'طول الساق الداخلي', helpEn: 'Measure from the crotch along the inside leg to the requested hem.', helpAr: 'قيسي من نقطة التقاء الساقين على طول الساق الداخلي حتى نهاية الطول المطلوب.' },
} as const

export function measurementLabel(locale: Locale, field: Field): string {
  return locale === 'tr' ? MEASUREMENT_LABELS[field] : localized[field][locale]
}

export function measurementHelp(locale: Locale, field: Field): string {
  return locale === 'tr' ? MEASUREMENT_HELP[field] : locale === 'en' ? localized[field].helpEn : localized[field].helpAr
}

export function formatLocalizedMeasurements(value: Measurements, locale: Locale): string {
  return Object.entries(value).flatMap(([key, amount]) => typeof amount === 'number' ? (() => {
    const field = key as Field
    const number = new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-arab' : locale === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 1 }).format(amount)
    return [`${measurementLabel(locale, field)}: ${number} ${locale === 'ar' ? 'سم' : 'cm'}`]
  })() : []).join(' · ')
}
