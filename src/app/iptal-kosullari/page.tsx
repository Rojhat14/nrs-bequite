import type { Metadata } from 'next'
import { LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

export const metadata: Metadata = {
  title: 'İptal Koşulları | NRS',
  description: 'NRS Bequite Luminous — i̇ptal koşulları.',
  alternates: { canonical: '/iptal-kosullari' },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : LEGAL_DOCUMENT_VERSIONS.contract
  return <LegalDocumentPage slug="iptal-kosullari" version={version} />
}
