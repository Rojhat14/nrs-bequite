import type { Metadata } from 'next'
import { LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

export const metadata: Metadata = {
  title: 'Ön Bilgilendirme Formu | NRS',
  description: 'NRS Bequite Luminous — ön bilgilendirme formu.',
  alternates: { canonical: '/on-bilgilendirme-formu' },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : LEGAL_DOCUMENT_VERSIONS.preInformation
  return <LegalDocumentPage slug="on-bilgilendirme-formu" version={version} />
}
