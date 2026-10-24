const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('./source-loader.cjs')

const load = loader()
const { buildWhatsappOrderMessage } = load('src/lib/whatsapp-order.ts')

test('English and Arabic WhatsApp summaries show USD conversion and exact TRY collection amount', () => {
  const items = [
    { id: 'dress', name: 'Noir Crystal Collar Satin Dress', quantity: 1, unitPrice: 24900 },
    { id: 'home', name: 'Botanical Cross-Stitch Bedding Set', quantity: 1, unitPrice: 7490 },
  ]
  const rate = { usdTry: 50, fetchedAt: '2026-10-16T00:00:00.000Z', rateDate: '2026-10-15' }
  const en = buildWhatsappOrderMessage(items, undefined, undefined, { locale: 'en', rate })
  assert.match(en, /Products subtotal:.*\$647\.80/)
  assert.match(en, /Total due:.*\$647\.80/)
  assert.doesNotMatch(en, /Opening offer|20%|discount/i)
  assert.match(en, /Amount charged by Garanti BBVA:.*TRY\s*32,390\.00/)
  const ar = buildWhatsappOrderMessage(items, undefined, undefined, { locale: 'ar', rate })
  assert.match(ar, /TRY\s*32,390\.00/)
  assert.match(ar, /الليرة التركية/)
})

test('WhatsApp does not invent a USD amount when no fresh rate is available', () => {
  const message = buildWhatsappOrderMessage([{ id: 'dress', name: 'Dress', quantity: 1, unitPrice: 24900 }], undefined, undefined, { locale: 'en', rate: null })
  assert.match(message, /TRY/)
  assert.match(message, /exchange rate is unavailable/)
  assert.doesNotMatch(message, /\$398\.40/)
})
