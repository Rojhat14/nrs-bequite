import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { legalPageMetadata } from '@/lib/legal/page-metadata'

export async function generateMetadata() { return legalPageMetadata('kvkk') }

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string | string[] }> }) {
  const params = await searchParams
  const version = typeof params.version === 'string' ? params.version : 'v1.4'
  return await LegalDocumentPage({ slug: 'kvkk', version })
}
