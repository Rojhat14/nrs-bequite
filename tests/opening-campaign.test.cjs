const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loader } = require('./source-loader.cjs')
const load = loader()
const campaign = load('src/lib/opening-campaign.ts')

test('Storefront renders the campaign as its only top announcement', () => {
  const navigation = fs.readFileSync(path.join(__dirname, '../src/components/Navigation.tsx'), 'utf8')
  const shell = fs.readFileSync(path.join(__dirname, '../src/components/StorefrontShell.tsx'), 'utf8')
  assert.doesNotMatch(navigation, /Kargo ve Teslimat Bilgileri Sipariş Teyidinde Paylaşılır/)
  assert.match(navigation, /openingCampaign &&/)
  assert.match(navigation, /t\('campaign'\)/)
  assert.doesNotMatch(shell, /getOpeningCampaign|role="status"/)
})

function moneyPair(lines) {
  const result = campaign.calculateOpeningTotals(lines.map(([price, quantity]) => ({ unitPriceMinor: price * 100, quantity })))
  return [result.subtotalMinor / 100, result.discountMinor / 100, result.totalMinor / 100]
}

test('Opening campaign acceptance examples are exact in integer kuruş', () => {
  assert.deepEqual(moneyPair([[24900, 1]]), [24900, 4980, 19920])
  assert.deepEqual(moneyPair([[7490, 1]]), [7490, 1498, 5992])
  assert.deepEqual(moneyPair([[28900, 1]]), [28900, 5780, 23120])
  assert.deepEqual(moneyPair([[24900, 1], [7490, 1]]), [32390, 6478, 25912])
})

test('Kuruş rounding is per unit and repeated quantities preserve line totals', () => {
  const one = campaign.calculateOpeningTotals([{ unitPriceMinor: 1001, quantity: 1 }])
  const three = campaign.calculateOpeningTotals([{ unitPriceMinor: 1001, quantity: 3 }])
  assert.deepEqual([one.subtotalMinor, one.discountMinor, one.totalMinor], [1001, 200, 801])
  assert.deepEqual([three.subtotalMinor, three.discountMinor, three.totalMinor], [3003, 600, 2403])
})

test('Turning the central campaign switch off removes its display config and discount', () => {
  const previous = process.env.NEXT_PUBLIC_OPENING_CAMPAIGN_ACTIVE
  process.env.NEXT_PUBLIC_OPENING_CAMPAIGN_ACTIVE = 'false'
  try {
    assert.equal(campaign.getOpeningCampaign(), null)
    assert.deepEqual(moneyPair([[24900, 1]]), [24900, 0, 24900])
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_OPENING_CAMPAIGN_ACTIVE
    else process.env.NEXT_PUBLIC_OPENING_CAMPAIGN_ACTIVE = previous
  }
})

test('WhatsApp order messages show normal subtotal, campaign reduction, and payable total from shared calculation', () => {
  const { buildWhatsappOrderMessage } = load('src/lib/whatsapp-order.ts')
  const message = buildWhatsappOrderMessage([
    { id: 'dress', name: 'Elbise', slug: 'elbise', quantity: 1, unitPrice: 24900, compareAtPrice: 30000 },
    { id: 'home', name: 'Nevresim', slug: 'nevresim', quantity: 1, unitPrice: 7490 },
  ], 1)
  assert.match(message, /Ürünler toplamı: ₺32\.390,00/)
  assert.match(message, /Açılışa Özel %20 İndirim: −₺6\.478,00/)
  assert.match(message, /Ödenecek toplam: ₺25\.912,00/)
  assert.doesNotMatch(message, /30\.000/)
})
