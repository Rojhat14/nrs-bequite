import type { Metadata } from 'next'
import { LEGAL_DOCUMENT_ARCHIVE, LEGAL_DOCUMENT_VERSIONS } from './documents'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import { languageAlternates, localePrefix } from '@/lib/i18n/messages'
import { localizedLegalTitle } from './translation-titles'

export async function legalPageMetadata(slug: string): Promise<Metadata> {
  const locale = await getRequestLocale()
  const source = LEGAL_DOCUMENT_ARCHIVE[LEGAL_DOCUMENT_VERSIONS.contract].documents[slug]
  const title = localizedLegalTitle(slug, locale) || source?.title || 'Legal information'
  const titlePrefix = locale === 'tr' ? '' : 'NRS | '
  const description = locale === 'ar'
    ? `معلومات NRS Bequite Luminous: ${title}.`
    : locale === 'en' ? `NRS Bequite Luminous — ${title}.` : `NRS Bequite Luminous — ${title}.`
  const path = `/${slug}`
  const prefix = localePrefix(locale)
  return {
    title: `${titlePrefix}${title}`,
    description,
    alternates: { canonical: `${prefix}${path}`, languages: languageAlternates(path) },
  }
}
