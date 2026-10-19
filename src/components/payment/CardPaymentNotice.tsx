'use client'

import { useCardPaymentEnabled } from '@/lib/feature-flags'
import { useLocale } from '@/context/LocaleContext'

export const CARD_PAYMENT_COMING_SOON = 'Kartla ödeme şu anda kullanılamıyor. Sipariş talebinizi WhatsApp üzerinden iletebilirsiniz.'

export default function CardPaymentNotice({ id }: { id?: string }) {
  const enabled = useCardPaymentEnabled()
  const { locale } = useLocale()
  if (enabled) return null
  const copy = locale === 'en' ? 'Card payment is not currently available. You can send an order request via WhatsApp.'
    : locale === 'ar' ? 'الدفع بالبطاقة غير متاح حالياً. يمكنك إرسال طلب الشراء عبر واتساب.' : CARD_PAYMENT_COMING_SOON
  return <p id={id} role="status" className="text-sm leading-6 text-nrs-ink/65">{copy}</p>
}
