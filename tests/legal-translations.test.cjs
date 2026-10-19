const test = require('node:test')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { loader } = require('./source-loader.cjs')

const load = loader()
const { LEGAL_DOCUMENT_ARCHIVE } = load('src/lib/legal/documents.ts')
const translations = load('src/lib/legal/translations-v1-4.ts')
const source = LEGAL_DOCUMENT_ARCHIVE['v1.4'].documents
const v15 = load('src/lib/legal/translations-v1-5.ts')
const currentSource = LEGAL_DOCUMENT_ARCHIVE['v1.5'].documents

test('the eight current legal documents have complete EN and AR text tied to the unchanged v1.4 source', () => {
  const fingerprint = createHash('sha256').update(JSON.stringify(source), 'utf8').digest('hex')
  assert.equal(fingerprint, translations.LEGAL_TRANSLATION_SOURCE_FINGERPRINT)
  assert.equal(Object.keys(source).length, 8)
  for (const locale of ['en', 'ar']) {
    let paragraphs = 0
    for (const [slug, document] of Object.entries(source)) {
      const result = translations.localizeLegalDocument(slug, document, source, locale)
      assert.equal(result.complete, true, `${locale}:${slug}`)
      assert.equal(result.sourceVersion, 'v1.4')
      assert.notEqual(result.document.title, document.title)
      assert.equal(result.document.sections.length, document.sections.length)
      for (let sectionIndex = 0; sectionIndex < document.sections.length; sectionIndex++) {
        const sourceSection = document.sections[sectionIndex]
        const translatedSection = result.document.sections[sectionIndex]
        assert.notEqual(translatedSection.title, sourceSection.title, `${locale}:${slug}:section:${sectionIndex}`)
        assert.equal(translatedSection.paragraphs.length, sourceSection.paragraphs.length)
        for (let paragraphIndex = 0; paragraphIndex < sourceSection.paragraphs.length; paragraphIndex++) {
          const text = translatedSection.paragraphs[paragraphIndex]
          assert.ok(text.trim().length > 0, `${locale}:${slug}:paragraph:${paragraphIndex}`)
          assert.notEqual(text, sourceSection.paragraphs[paragraphIndex], `${locale}:${slug}:paragraph:${paragraphIndex}`)
          paragraphs++
        }
      }
    }
    assert.equal(paragraphs, 142)
  }
})

test('a changed Turkish source fails closed to the source rather than misaligning translated paragraphs', () => {
  const changed = structuredClone(source)
  changed.kvkk.sections[0].paragraphs[0] += ' Değişiklik.'
  const result = translations.localizeLegalDocument('kvkk', changed.kvkk, changed, 'en')
  assert.equal(result.complete, false)
  assert.equal(result.document, changed.kvkk)
})

test('historic accepted legal versions remain available in Turkish without being presented as translated', () => {
  const oldArchive = LEGAL_DOCUMENT_ARCHIVE['v1.3'].documents
  const result = translations.localizeLegalDocument('kvkk', oldArchive.kvkk, oldArchive, 'ar')
  assert.equal(result.complete, false)
  assert.equal(result.document, oldArchive.kvkk)
})

test('current v1.5 legal translations explain optional measurements without changing the archived v1.4', () => {
  assert.match(JSON.stringify(source), /Bütün NRS kıyafetleri müşterinin ürün bazında verdiği beden ölçülerine göre dikilir/)
  assert.doesNotMatch(JSON.stringify(currentSource), /Bütün NRS kıyafetleri müşterinin ürün bazında verdiği beden ölçülerine göre dikilir/)
  for (const locale of ['en', 'ar']) {
    const allText = []
    for (const slug of Object.keys(currentSource)) {
      const result = v15.localizeLegalDocumentV1_5(slug, currentSource[slug], locale)
      assert.equal(result.complete, true, `${locale}:${slug}`)
      assert.equal(result.sourceVersion, 'v1.5')
      const body = JSON.stringify(result.document)
      allText.push(body)
      assert.doesNotMatch(body, locale === 'en' ? /required measurements/i : /القياسات المطلوبة/)
    }
    assert.match(allText.join(' '), locale === 'en' ? /measurements are optional/i : /القياسات الشخصية اختيارية/)
  }
})
