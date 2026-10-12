'use client'

import { useCardPaymentEnabled } from '@/lib/feature-flags'

export const CARD_PAYMENT_COMING_SOON = 'Kartla ödeme, banka onayının ardından kullanıma açılacaktır. Siparişinizi WhatsApp üzerinden tamamlayabilirsiniz.'

export default function CardPaymentNotice({ id }: { id?: string }) {
  const enabled = useCardPaymentEnabled()
  if (enabled) return null
  return <p id={id} role="status" className="text-sm leading-6 text-nrs-ink/65">{CARD_PAYMENT_COMING_SOON}</p>
}
