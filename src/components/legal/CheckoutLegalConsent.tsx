'use client'

import Link from 'next/link'
import { LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'

export default function CheckoutLegalConsent({ accepted, onChange, error }: {
  accepted: boolean; onChange: (value: boolean) => void; error: string
}) {
  return <fieldset className="min-w-0 space-y-3 border border-nrs-ink/15 p-4 sm:p-6">
    <legend className="px-2 font-serif text-xl">Sözleşme onayı</legend>
    <div className="flex items-start gap-3">
      <input id="checkout-contract" type="checkbox" checked={accepted} required
        onChange={event => onChange(event.target.checked)}
        aria-describedby={error ? 'checkout-contract-error' : 'checkout-contract-versions'}
        aria-invalid={Boolean(error)} className="mt-3 h-5 w-5 shrink-0 accent-nrs-charcoal" />
      <label htmlFor="checkout-contract" className="min-h-11 min-w-0 text-sm leading-7 break-words cursor-pointer">
        <Link href="/mesafeli-satis-sozlesmesi" target="_blank" rel="noopener noreferrer" className="inline-block py-2 underline underline-offset-4">Mesafeli Satış Sözleşmesi</Link>&apos;ni ve{' '}
        <Link href="/on-bilgilendirme-formu" target="_blank" rel="noopener noreferrer" className="inline-block py-2 underline underline-offset-4">Ön Bilgilendirme Formu</Link>&apos;nu okudum ve kabul ediyorum.
      </label>
    </div>
    <p id="checkout-contract-versions" className="text-xs text-nrs-ink/60">Sözleşme: {LEGAL_DOCUMENT_VERSIONS.contract} · Ön bilgilendirme: {LEGAL_DOCUMENT_VERSIONS.preInformation}</p>
    <p className="text-xs leading-6 text-nrs-ink/65">Kişisel veriler hakkında <Link href="/kvkk" target="_blank" rel="noopener noreferrer" className="underline">KVKK Aydınlatma Metni</Link>&apos;ni inceleyebilirsiniz. Bu onay pazarlama izni veya kişisel veri işleme açık rızası değildir.</p>
    {error && <p id="checkout-contract-error" role="alert" className="text-sm text-red-700">{error}</p>}
  </fieldset>
}
