import type { Metadata } from 'next'
import { LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

export const metadata: Metadata = {
  title: 'İade ve Değişim Koşulları | NRS',
  description: 'NRS Bequite Luminous — i̇ade ve değişim koşulları.',
  alternates: { canonical: '/iade-ve-degisim' },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : LEGAL_DOCUMENT_VERSIONS.contract
  return <LegalDocumentPage slug="iade-ve-degisim" version={version} />
}
