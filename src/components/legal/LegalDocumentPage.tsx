import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLegalDocument, LEGAL_DOCUMENT_ARCHIVE, LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import LegalDocumentContent from './LegalDocumentContent'

export default function LegalDocumentPage({ slug, version = LEGAL_DOCUMENT_VERSIONS.contract }: { slug: string; version?: string }) {
  const document = getLegalDocument(slug, version)
  if (!document) notFound()
  const archive = LEGAL_DOCUMENT_ARCHIVE[version as keyof typeof LEGAL_DOCUMENT_ARCHIVE]
  const seller = archive.seller
  return <main className="min-h-screen bg-nrs-canvas text-nrs-ink layout-content">
    <article className="mx-auto max-w-3xl px-6 pt-10 sm:pt-12 pb-24 space-y-10">
      <header className="space-y-5 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-nrs-ink/60">NRS · Yasal bilgiler</p>
        <h1 className="font-serif text-3xl sm:text-5xl leading-tight">{document.title}</h1>
        <div className="mx-auto h-px w-20 bg-nrs-ink/20" />
        <p className="text-xs text-nrs-ink/60">Sürüm: {version} · İlk yayın: {archive.publishedAt}</p>
      </header>
      <LegalDocumentContent document={document} />
      <address className="not-italic space-y-3 text-sm leading-6 break-words">
        <p className="font-medium">{seller.name}</p><p>{seller.address}</p>
        <p>Vergi kimlik numarası: {seller.taxNumber} · Vergi dairesi: {seller.taxOffice}</p>
        <p>İşe başlama: {seller.establishedAt} · Faaliyet: {seller.activity}</p>
        <a className="block min-h-11 underline underline-offset-4" href={`mailto:${seller.email}`}>{seller.email}</a>
        <a className="block min-h-11 underline underline-offset-4" href={`tel:${seller.phone.replace(/\s/g, '')}`}>{seller.phone}</a>
      </address>
      <Link href="/contact" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">İletişim</Link>
    </article>
  </main>
}
