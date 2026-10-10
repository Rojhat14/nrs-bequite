import type { Metadata } from 'next'
import { LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

export const metadata: Metadata = {
  title: 'Kargo ve Teslimat | NRS',
  description: 'NRS Bequite Luminous — kargo ve teslimat.',
  alternates: { canonical: '/kargo-ve-teslimat' },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : LEGAL_DOCUMENT_VERSIONS.contract
  return <LegalDocumentPage slug="kargo-ve-teslimat" version={version} />
}
