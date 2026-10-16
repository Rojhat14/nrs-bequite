const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('./source-loader.cjs')

const load = loader()
const { marketing } = load('src/lib/i18n/marketing.ts')

test('remaining brand, embroidery, collection, newsletter and transfer copy is available in all locales', () => {
  const keys = [
    'aboutP1', 'womanP1', 'atelierP1', 'brandQuote', 'curatedIntro', 'moodNightBody',
    'embroideryDisclaimer', 'embroideryMessage', 'newsletterBody', 'bankRequest',
    'collectionFallback', 'collectionDetailEmpty', 'notFoundBody',
  ]
  for (const locale of ['tr', 'en', 'ar']) {
    for (const key of keys) {
      const value = marketing(locale, key)
      assert.equal(typeof value, 'string', `${locale}.${key}`)
      assert.ok(value.trim().length > 0, `${locale}.${key} must not be empty`)
    }
  }
  assert.match(marketing('en', 'embroideryDisclaimer'), /WhatsApp/)
  assert.match(marketing('ar', 'embroideryDisclaimer'), /واتساب/)
})
