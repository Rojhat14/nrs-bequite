import { LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { legalPageMetadata } from '@/lib/legal/page-metadata'

export async function generateMetadata() { return legalPageMetadata('mesafeli-satis-sozlesmesi') }

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : LEGAL_DOCUMENT_VERSIONS.contract
  return await LegalDocumentPage({ slug: 'mesafeli-satis-sozlesmesi', version })
}
