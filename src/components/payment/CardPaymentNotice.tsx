'use client'

import { useCardPaymentEnabled } from '@/lib/feature-flags'
import { useLocale } from '@/context/LocaleContext'

export const CARD_PAYMENT_COMING_SOON = 'Kartla ödeme, banka onayının ardından kullanıma açılacaktır. Siparişinizi WhatsApp üzerinden tamamlayabilirsiniz.'

export default function CardPaymentNotice({ id }: { id?: string }) {
  const enabled = useCardPaymentEnabled()
  const { locale } = useLocale()
  if (enabled) return null
  const copy = locale === 'en' ? 'Card payments will be available after bank approval. You can complete your order request via WhatsApp.'
    : locale === 'ar' ? 'سيصبح الدفع بالبطاقة متاحاً بعد موافقة البنك. يمكنك إرسال طلبك عبر واتساب.' : CARD_PAYMENT_COMING_SOON
  return <p id={id} role="status" className="text-sm leading-6 text-nrs-ink/65">{copy}</p>
}
