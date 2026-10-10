import type { Metadata } from 'next'
import { LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

export const metadata: Metadata = {
  title: 'Kullanım Koşulları | NRS',
  description: 'NRS Bequite Luminous — kullanım koşulları.',
  alternates: { canonical: '/kullanim-kosullari' },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : LEGAL_DOCUMENT_VERSIONS.contract
  return <LegalDocumentPage slug="kullanim-kosullari" version={version} />
}
