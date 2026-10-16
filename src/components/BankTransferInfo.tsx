'use client'

import { bankTransfer } from '@/lib/storefront-config'
import { useLocale } from '@/context/LocaleContext'
import { marketing } from '@/lib/i18n/marketing'

export default function BankTransferInfo() {
  const { locale } = useLocale()
  const t = (key: Parameters<typeof marketing>[1]) => marketing(locale, key)
  return <div className="space-y-2 text-xs leading-6 text-nrs-ink/65 break-words">
    <p>{t('bankMethod')}</p>
    {bankTransfer.iban ? <>
      {bankTransfer.bankName && <p>{t('bankName')}: {bankTransfer.bankName}</p>}
      {bankTransfer.accountName && <p>{t('bankAccount')}: {bankTransfer.accountName}</p>}
      <p>IBAN: <bdi dir="ltr" className="select-all">{bankTransfer.iban}</bdi></p>
      <p>{t('bankConfirm')}</p>
    </> : <p>{t('bankLater')}</p>}
    <p>{t('bankRequest')}</p>
  </div>
}
