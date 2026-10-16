import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLegalDocument, LEGAL_DOCUMENT_ARCHIVE, LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import { localePrefix } from '@/lib/i18n/messages'
import { LEGAL_TRANSLATION_NOTICE, localizeLegalDocument } from '@/lib/legal/translations-v1-4'
import LegalDocumentContent from './LegalDocumentContent'

const labels = {
  tr: { legal: 'Yasal bilgiler', version: 'Sürüm', published: 'İlk yayın', taxNumber: 'Vergi kimlik numarası', taxOffice: 'Vergi dairesi', established: 'İşe başlama', activity: 'Faaliyet', contact: 'İletişim', archive: 'Bu arşiv sürümünün çevirisi henüz mevcut değil; Türkçe kaynak gösteriliyor.' },
  en: { legal: 'Legal information', version: 'Version', published: 'First published', taxNumber: 'Tax identification number', taxOffice: 'Tax office', established: 'Established', activity: 'Business activity', contact: 'Contact', archive: 'A translation of this archived version is not available; the Turkish source is shown.' },
  ar: { legal: 'معلومات قانونية', version: 'الإصدار', published: 'تاريخ النشر الأول', taxNumber: 'الرقم الضريبي', taxOffice: 'مكتب الضرائب', established: 'تاريخ بدء النشاط', activity: 'النشاط التجاري', contact: 'التواصل', archive: 'ترجمة هذا الإصدار المؤرشف غير متاحة؛ يُعرض النص التركي المصدر.' },
} as const

export default async function LegalDocumentPage({ slug, version = LEGAL_DOCUMENT_VERSIONS.contract }: { slug: string; version?: string }) {
  const document = getLegalDocument(slug, version)
  if (!document) notFound()
  const locale = await getRequestLocale()
  const archive = LEGAL_DOCUMENT_ARCHIVE[version as keyof typeof LEGAL_DOCUMENT_ARCHIVE]
  const seller = archive.seller
  const labelsForLocale = labels[locale]
  const localized = version === 'v1.4'
    ? localizeLegalDocument(slug, document, LEGAL_DOCUMENT_ARCHIVE['v1.4'].documents, locale)
    : { document, complete: false, sourceVersion: version }
  const displayDocument = localized.document
  return <main className="min-h-screen bg-nrs-canvas text-nrs-ink layout-content" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <article className="mx-auto max-w-3xl px-6 pt-10 sm:pt-12 pb-24 space-y-10">
      <header className="space-y-5 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-nrs-ink/60">NRS · {labelsForLocale.legal}</p>
        <h1 className="font-serif text-3xl sm:text-5xl leading-tight">{displayDocument.title}</h1>
        <div className="mx-auto h-px w-20 bg-nrs-ink/20" />
        <p className="text-xs text-nrs-ink/60" dir="auto">{labelsForLocale.version}: {version} · {labelsForLocale.published}: {archive.publishedAt}</p>
        {locale !== 'tr' && localized.complete && version === 'v1.4' && <p className="text-xs text-nrs-ink/60">{LEGAL_TRANSLATION_NOTICE[locale]}</p>}
        {locale !== 'tr' && !localized.complete && <p className="text-sm text-amber-900" role="status">{labelsForLocale.archive}</p>}
      </header>
      <LegalDocumentContent document={displayDocument} />
      <address className="not-italic space-y-3 text-sm leading-6 break-words">
        <p className="font-medium">{seller.name}</p><p dir="auto">{seller.address}</p>
        <p dir="auto">{labelsForLocale.taxNumber}: {seller.taxNumber} · {labelsForLocale.taxOffice}: {seller.taxOffice}</p>
        <p dir="auto">{labelsForLocale.established}: {seller.establishedAt} · {labelsForLocale.activity}: {seller.activity}</p>
        <a className="block min-h-11 underline underline-offset-4" dir="ltr" href={`mailto:${seller.email}`}>{seller.email}</a>
        <a className="block min-h-11 underline underline-offset-4" dir="ltr" href={`tel:${seller.phone.replace(/\s/g, '')}`}>{seller.phone}</a>
      </address>
      <Link href={`${localePrefix(locale)}/contact`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{labelsForLocale.contact}</Link>
    </article>
  </main>
}
