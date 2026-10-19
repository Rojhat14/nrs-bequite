'use client'

import Link from 'next/link'
import { LEGAL_DOCUMENT_VERSIONS, legalDocumentHref } from '@/lib/legal/documents'
import { useLocale } from '@/context/LocaleContext'
import { localePrefix } from '@/lib/i18n/messages'

export default function CheckoutLegalConsent({ accepted, onChange, error }: {
  accepted: boolean; onChange: (value: boolean) => void; error: string
}) {
  const { locale } = useLocale()
  const prefix = localePrefix(locale)
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const contractHref = `${prefix}${legalDocumentHref('contract', LEGAL_DOCUMENT_VERSIONS.contract)}`
  const preInformationHref = `${prefix}${legalDocumentHref('preInformation', LEGAL_DOCUMENT_VERSIONS.preInformation)}`
  return <fieldset className="min-w-0 space-y-3 border border-nrs-ink/15 p-4 sm:p-6">
    <legend className="px-2 font-serif text-xl">{copy('Sözleşme onayı', 'Agreement approval', 'الموافقة على الاتفاقيات')}</legend>
    <div className="flex items-start gap-3">
      <input id="checkout-contract" type="checkbox" checked={accepted} required
        onChange={event => onChange(event.target.checked)}
        aria-describedby={error ? 'checkout-contract-error' : 'checkout-contract-versions'}
        aria-invalid={Boolean(error)} className="mt-3 h-5 w-5 shrink-0 accent-nrs-charcoal" />
      <label htmlFor="checkout-contract" className="min-h-11 min-w-0 text-sm leading-7 break-words cursor-pointer">
        <Link href={contractHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center py-2 underline underline-offset-4">{copy('Mesafeli Satış Sözleşmesi', 'Distance Sales Agreement', 'عقد البيع عن بُعد')}</Link>{copy('’ni ve', ' and the ', ' و')}{' '}
        <Link href={preInformationHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center py-2 underline underline-offset-4">{copy('Ön Bilgilendirme Formu', 'Pre-Contractual Information Form', 'نموذج المعلومات قبل التعاقد')}</Link>{copy('’nu okudum ve kabul ediyorum.', ' I have read and agree.', ' قرأتُ وأوافق.')}
      </label>
    </div>
    <p id="checkout-contract-versions" className="text-xs text-nrs-ink/60">{copy('Sözleşme', 'Agreement', 'الاتفاقية')}: {LEGAL_DOCUMENT_VERSIONS.contract} · {copy('Ön bilgilendirme', 'Preliminary information', 'المعلومات المسبقة')}: {LEGAL_DOCUMENT_VERSIONS.preInformation}</p>
    <p className="text-xs leading-6 text-nrs-ink/65">{copy('Kişisel veriler hakkında', 'For information about personal data, see the', 'للاطلاع على بياناتك الشخصية، راجعي')} <Link href={`${prefix}/kvkk`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center underline">{copy('KVKK Aydınlatma Metni', 'Personal Data Information Notice', 'إشعار معلومات البيانات الشخصية')}</Link>{copy(' ve ', ' and the ', ' و')}<Link href={`${prefix}/gizlilik-politikasi`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center underline">{copy('Gizlilik Politikası', 'Privacy Policy', 'سياسة الخصوصية')}</Link>. {copy('Bu onay pazarlama izni veya kişisel veri işleme açık rızası değildir.', 'This approval is not marketing consent or explicit consent to personal data processing.', 'هذه الموافقة ليست إذناً تسويقياً ولا موافقة صريحة على معالجة البيانات الشخصية.')}</p>
    {error && <p id="checkout-contract-error" role="alert" className="text-sm text-red-700">{error}</p>}
  </fieldset>
}
