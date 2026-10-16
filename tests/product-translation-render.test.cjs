const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { loader } = require('./source-loader.cjs')

const sourceRows = JSON.parse(fs.readFileSync('tests/fixtures/product-translation-render-source.json', 'utf8'))
const authored = Object.assign({}, ...fs.readdirSync('src/data/product-translations')
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(fs.readFileSync(`src/data/product-translations/${name}`, 'utf8'))))

function productSourceHash(product) {
  const source = JSON.stringify([product.name, product.description, product.fabric, product.care]
    .map((value) => (value ?? '').normalize('NFC')))
  return crypto.createHash('sha256').update(source, 'utf8').digest('hex')
}

function createQuery(table, data) {
  const filters = new Map()
  const query = {
    select: () => query,
    eq: (key, value) => (filters.set(key, value), query),
    in: (key, value) => (filters.set(key, value), query),
    order: () => query,
    maybeSingle: async () => ({ data: data(table, filters, true), error: null }),
    then: (resolve, reject) => Promise.resolve({ data: data(table, filters, false), error: null }).then(resolve, reject),
  }
  return query
}

async function loadLocalizedCatalog(locale) {
  const rows = sourceRows.map((row) => ({
    ...row,
    category_id: null,
    price_amount: 0,
    currency: 'TRY',
    compare_at_price: null,
    in_stock: true,
  }))
  const dbReadbackPath = '.product-translation-readback.json'
  const translationRows = fs.existsSync(dbReadbackPath)
    ? JSON.parse(fs.readFileSync(dbReadbackPath, 'utf8')).filter((row) => row.locale === locale && rows.some((product) => product.id === row.entity_id))
    : rows.map((row) => ({ entity_id: row.id, source_hash: productSourceHash(row), payload: authored[row.id][locale], locale }))
  const supabase = {
    from(table) {
      return createQuery(table, (requestedTable, filters, single) => {
        if (requestedTable === 'products') {
          const filtered = rows.filter((row) => [...filters].every(([key, value]) => row[key] === value))
          return single ? filtered[0] ?? null : filtered
        }
        if (requestedTable === 'storefront_translations') {
          return translationRows.filter((row) => {
            const localeMatches = !filters.has('locale') || filters.get('locale') === locale
            const entityMatches = !filters.has('entity_id') || filters.get('entity_id').includes(row.entity_id)
            return localeMatches && entityMatches
          })
        }
        return []
      })
    },
  }

  const load = loader({
    react: { cache: (fn) => fn },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => supabase },
    '@/lib/i18n/request-locale': { getRequestLocale: async () => locale },
    '@/lib/storage/products': { getProductImageUrl: () => null },
    '@/lib/storage/category-covers': { getHomeCategoryCover: async () => '' },
    '@/lib/home-category': { isHomeCategory: () => false },
  })
  const { getStorefrontProducts, getStorefrontProduct } = load('src/lib/products.ts')
  return { products: await getStorefrontProducts(), getStorefrontProduct }
}

test('the storefront product loader applies source-hash-matched persistent EN/AR translations', async () => {
  const samples = [
    ['noir-crystal-collar-saten-elbise', 'dress'],
    ['ivory-sculpted-asimetrik-yelek-takim', 'set'],
    ['ivory-sculpted-asimetrik-yelek-takim-kopya-kopya', 'separate piece'],
    ['violet-dokulu-gomlek-ceket', 'first Violet'],
    ['violet-dokulu-gomlek-ceket-kopya', 'second Violet'],
    ['botanical-cross-stitch-nakisli-nevresim-takimi', 'Home bedding'],
  ]
  for (const locale of ['en', 'ar']) {
    const { products, getStorefrontProduct } = await loadLocalizedCatalog(locale)
    assert.equal(products.length, 6, `${locale}: all six representative products should load`)
    const byId = new Map(products.map((product) => [product.id, product]))
    for (const [id, label] of samples) {
      const rendered = byId.get(id)
      const expected = authored[id][locale]
      assert.ok(rendered, `${locale}: ${label} should be present`)
      for (const field of ['name', 'description']) assert.equal(rendered[field], expected[field], `${locale}: ${label} ${field}`)
      assert.equal(rendered.details.fabric, expected.fabric, `${locale}: ${label} fabric`)
      assert.equal(rendered.details.care, expected.care, `${locale}: ${label} care`)
      const productRow = sourceRows.find((row) => row.id === id)
      const detail = await getStorefrontProduct(productRow.slug)
      assert.equal(detail.name, expected.name, `${locale}: product page ${label} name`)
      assert.equal(detail.description, expected.description, `${locale}: product page ${label} description`)
      assert.equal(detail.details.fabric, expected.fabric, `${locale}: product page ${label} fabric`)
      assert.equal(detail.details.care, expected.care, `${locale}: product page ${label} care`)
    }
  }
})
