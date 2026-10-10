import type { Metadata } from 'next'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası | NRS',
  description: 'NRS Bequite Luminous — gizlilik politikası.',
  alternates: { canonical: '/gizlilik-politikasi' },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : 'v1.2'
  return <LegalDocumentPage slug="gizlilik-politikasi" version={version} />
}
