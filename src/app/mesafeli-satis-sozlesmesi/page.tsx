import type { Metadata } from 'next'
import { LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

export const metadata: Metadata = {
  title: 'Mesafeli Satış Sözleşmesi | NRS',
  description: 'NRS Bequite Luminous — mesafeli satış sözleşmesi.',
  alternates: { canonical: '/mesafeli-satis-sozlesmesi' },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : LEGAL_DOCUMENT_VERSIONS.contract
  return <LegalDocumentPage slug="mesafeli-satis-sozlesmesi" version={version} />
}
