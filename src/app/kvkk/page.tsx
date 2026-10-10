import type { Metadata } from 'next'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni | NRS',
  description: 'NRS Bequite Luminous — kvkk aydınlatma metni.',
  alternates: { canonical: '/kvkk' },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : 'v1.4'
  return <LegalDocumentPage slug="kvkk" version={version} />
}
