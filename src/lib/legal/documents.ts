import { DOCUMENTS_V1_2, SELLER_V1_2 } from './versions/v1-2'
import { DOCUMENTS_V1, SELLER_V1 } from './versions/v1'
import { DOCUMENTS_V1_1, SELLER_V1_1 } from './versions/v1-1'

export const LEGAL_DOCUMENT_VERSIONS = { contract: 'v1.1', preInformation: 'v1.1' } as const
export const LEGAL_PUBLICATION_DATE = '08.10.2026'
export const LEGAL_SELLER = SELLER_V1
export const LEGAL_ROUTES = Object.keys(DOCUMENTS_V1).map(slug => `/${slug}`)
export const LEGAL_DOCUMENT_ARCHIVE = { 'v1.2': { seller: SELLER_V1_2, publishedAt: '10.10.2026', documents: DOCUMENTS_V1_2 }, 'v1.0': { seller: SELLER_V1, publishedAt: LEGAL_PUBLICATION_DATE, documents: DOCUMENTS_V1 }, 'v1.1': { seller: SELLER_V1_1, publishedAt: LEGAL_PUBLICATION_DATE, documents: DOCUMENTS_V1_1 } } as const

export function getLegalDocument(slug: string, version: string = ['kvkk', 'gizlilik-politikasi'].includes(slug) ? 'v1.2' : slug === 'on-bilgilendirme-formu' ? LEGAL_DOCUMENT_VERSIONS.preInformation : LEGAL_DOCUMENT_VERSIONS.contract) {
  if (!Object.prototype.hasOwnProperty.call(LEGAL_DOCUMENT_ARCHIVE, version)) return null
  const archive = LEGAL_DOCUMENT_ARCHIVE[version as keyof typeof LEGAL_DOCUMENT_ARCHIVE]
  return Object.prototype.hasOwnProperty.call(archive.documents, slug) ? archive.documents[slug] : null
}

export function legalDocumentHref(kind: 'contract' | 'preInformation', version: string) {
  const slug = kind === 'contract' ? 'mesafeli-satis-sozlesmesi' : 'on-bilgilendirme-formu'
  return `/${slug}?version=${encodeURIComponent(version)}`
}
