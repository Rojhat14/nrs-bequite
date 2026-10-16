const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('./source-loader.cjs')

const load = loader()
const money = load('src/lib/i18n/money.ts')
const messages = load('src/lib/i18n/messages.ts')
const rate = { usdTry: 50, fetchedAt: '2026-10-16T00:00:00.000Z' }
const ecb = load('src/lib/i18n/ecb.ts')

test('locale addresses retain Turkish paths and prefix English and Arabic counterparts', () => {
  assert.equal(messages.localePrefix('tr'), '')
  assert.equal(messages.localePrefix('en'), '/en')
  assert.equal(messages.localePrefix('ar'), '/ar')
  assert.deepEqual(messages.languageAlternates('/product/example'), {
    tr: '/product/example', en: '/en/product/example', ar: '/ar/product/example', 'x-default': '/product/example',
  })
  assert.equal(messages.localeFromCookieHeader('foo=bar; nrs-locale=ar; test=1'), 'ar')
})

test('TRY to USD direction, campaign-equivalent amounts, and fallback are explicit', () => {
  assert.equal(money.tryToDisplayMinor(2490000, 'en', rate), 49800)
  assert.equal(money.tryToDisplayMinor(1992000, 'ar', rate), 39840)
  assert.equal(money.formatMinor(39840, 'en', rate), '$398.40')
  assert.equal(money.displayCurrency('ar', rate), 'USD')
  assert.equal(money.displayCurrency('en', null), 'TRY')
  assert.equal(money.tryToDisplayMinor(2490000, 'en', null), 2490000)
})

test('largest-remainder conversion keeps displayed USD line totals equal to the rounded order total', () => {
  const displayLines = money.allocateDisplayMinor([1992000, 599200], 'en', rate)
  const total = Math.round((1992000 + 599200) / rate.usdTry)
  assert.equal(displayLines.reduce((sum, value) => sum + value, 0), total)
  assert.equal(total, 51824)
})

test('ECB conversion uses the published source date and the defined USD-per-EUR to TRY-per-USD direction', () => {
  const xml = `<gesmes:Envelope><Cube><Cube time='2026-10-15'><Cube currency='USD' rate='1.1208'/><Cube currency='TRY' rate='55.3873'/></Cube></Cube></gesmes:Envelope>`
  const parsed = ecb.parseEcbRate(xml)
  assert.equal(parsed.rateDate, '2026-10-15')
  assert.equal(parsed.usdTry, 55.3873 / 1.1208)
  assert.throws(() => ecb.parseEcbRate(`<Cube time='2026-10-15'><Cube currency='USD' rate='0'/><Cube currency='TRY' rate='55' /></Cube>`), /ECB_RATE_INVALID/)
})
