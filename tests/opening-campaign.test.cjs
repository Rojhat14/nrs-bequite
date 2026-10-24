const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loader } = require('./source-loader.cjs')
const load = loader()
const retired = load('src/lib/opening-campaign.ts')

test('Campaign announcement and price labels are absent from active storefront components', () => {
  for (const file of ['src/components/Navigation.tsx', 'src/components/ProductCard.tsx', 'src/components/ProductDetail.tsx', 'src/components/CartDrawer.tsx']) {
    const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    assert.doesNotMatch(content, /openingCampaign|campaignShort|t\('campaign'\)|Açılışa özel sepette|Opening offer at checkout/)
  }
  const messages = fs.readFileSync(path.join(__dirname, '../src/lib/i18n/messages.ts'), 'utf8')
  assert.doesNotMatch(messages, /Sepette %20 indirim|20% off at checkout|خصم 20٪ عند إتمام الطلب/)
})

test('Retired campaign helpers can never reduce a normal sale price', () => {
  const previous = process.env.NEXT_PUBLIC_OPENING_CAMPAIGN_ACTIVE
  process.env.NEXT_PUBLIC_OPENING_CAMPAIGN_ACTIVE = 'true'
  try {
    assert.equal(retired.isOpeningCampaignActive(), false)
    assert.equal(retired.getOpeningCampaign(), null)
    assert.equal(retired.discountForUnitMinor(2490000, true), 0)
    const result = retired.calculateOpeningTotals([{ unitPriceMinor: 2490000, quantity: 1 }], 0, true)
    assert.deepEqual([result.subtotalMinor, result.discountMinor, result.totalMinor], [2490000, 0, 2490000])
    assert.equal(retired.discountedUnitMinor(2490000, true), 2490000)
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_OPENING_CAMPAIGN_ACTIVE
    else process.env.NEXT_PUBLIC_OPENING_CAMPAIGN_ACTIVE = previous
  }
})

test('WhatsApp order message uses normal sale prices regardless of compare-at data', () => {
  const { buildWhatsappOrderMessage } = load('src/lib/whatsapp-order.ts')
  const message = buildWhatsappOrderMessage([
    { id: 'dress', name: 'Elbise', slug: 'elbise', quantity: 1, unitPrice: 24900, compareAtPrice: 30000 },
    { id: 'home', name: 'Nevresim', quantity: 1, unitPrice: 7490 },
  ])
  assert.match(message, /Ürünler toplamı: ₺32\.390,00/)
  assert.match(message, /Ödenecek toplam: ₺32\.390,00/)
  assert.doesNotMatch(message, /discount|indirim|20%|%20|30\.000/i)
})

test('Database migration blocks campaign snapshots and compare-at fallback without touching order data', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261024160000_retire_opening_campaign_rpcs.sql'), 'utf8')
  assert.match(sql, /opening campaign disabled/)
  assert.match(sql, /subtotal_minor:=subtotal_minor\+round\(product\.price_amount\*100\)::bigint\*quantity/)
  assert.match(sql, /subtotal_minor:=subtotal_minor\+round\(product\.price_amount\*100\)::bigint\*qty/)
  assert.doesNotMatch(sql, /UPDATE\s+(public\.)?(orders|order_items|payment_orders|products)\b/i)
  assert.doesNotMatch(sql, /GRANT\s+.*\b(anon|authenticated)\b/i)
})
