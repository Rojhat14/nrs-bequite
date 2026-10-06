const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadSource(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : originalRequire(name);
  loaded._compile(output, filename);
  return loaded.exports;
}
const storage = loadSource('src/lib/storage/products.ts');
const feedModule = loadSource('src/lib/meta-product-feed.ts', {
  'server-only': {}, '@/lib/storage/products': storage,
});

function fixture(rowCap = 2) {
  const product = id => ({ id, name: 'NRS "Elbise", özel', slug: `elbise ${id}`, description: 'İlk satır\nİkinci satır', price_amount: '125.50', currency: 'TRY', compare_at_price: '200', in_stock: true, status: 'active', internal_secret: 'PRIVATE-DATA' });
  const image = (id, product_id, options = {}) => ({ id, product_id, provider: 'external', storage_key: null, url: `https://images.example/${id}.jpg`, is_primary: false, sort_order: 0, created_at: '2026-01-01', ...options });
  const tables = {
    products: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(product),
    product_images: [image('i1', 'p1'), image('i2', 'p1', { is_primary: true, sort_order: 20, provider: 'supabase', storage_key: 'primary.jpg' }), image('i3', 'p2', { sort_order: 10 }), image('i4', 'p2', { sort_order: 2 }), image('i5', 'p3'), image('i6', 'p4', { url: '/legacy.jpg' }), image('i7', 'p5'), image('i8', 'p6')],
    product_variants: [
      { id: 'v2', product_id: 'p1', sku: 'SKU-B', is_active: true, stock_quantity: 2 },
      { id: 'v1', product_id: 'p1', sku: 'SKU-A', is_active: true, stock_quantity: 0 },
      { id: 'v3', product_id: 'p2', sku: null, is_active: true, stock_quantity: 0 },
      { id: 'v4', product_id: 'p2', sku: 'INACTIVE', is_active: false, stock_quantity: 10 },
    ],
  };
  tables.products[0].in_stock = false;
  tables.products[4].status = 'draft';
  tables.products[5].status = 'archived';
  const calls = [];
  let failTable, failAfter = 0;
  const client = {
    storage: { from(bucket) { assert.equal(bucket, 'product-images'); return { getPublicUrl(key) { return { data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${bucket}/${key}` } }; } }; } },
    from(table) {
      let rows = [...tables[table]], columns, limit = 500;
      const filters = []; let relationSize;
      const query = {
        select(value) { columns = value; return query; },
        eq(key, value) { filters.push(['eq', key, value]); rows = rows.filter(row => row[key] === value); return query; },
        in(key, values) { relationSize = values.length; rows = rows.filter(row => values.includes(row[key])); return query; },
        gt(key, value) { filters.push(['gt', key, value]); rows = rows.filter(row => row[key] > value); return query; },
        order(key) { rows.sort((a, b) => a[key].localeCompare(b[key])); return query; },
        limit(value) { limit = value; return query; },
        then(resolve, reject) {
          calls.push({ table, columns, filters, relationSize });
          assert.ok(columns && !columns.includes('*'));
          const shouldFail = table === failTable && calls.filter(call => call.table === table).length > failAfter;
          const data = rows.slice(0, Math.min(limit, rowCap)).map(row => Object.fromEntries(columns.split(',').map(key => [key, row[key]])));
          return Promise.resolve(shouldFail ? { data: null, error: { message: 'PRIVATE-CREDENTIAL' } } : { data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, tables, calls, fail(table, after = 0) { failTable = table; failAfter = after; } };
}

// RFC 4180 parser: quoted commas, doubled quotes, and embedded newlines.
function parseCsv(csv) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') { if (quoted && csv[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\r' && csv[i + 1] === '\n' && !quoted) { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  assert.equal(quoted, false);
  const [headers, ...values] = rows;
  return values.map(values => Object.fromEntries(headers.map((key, i) => [key, values[i]])));
}

test('Meta feed paginates below requested row cap, excludes draft/archive/local images, and escapes CSV', async () => {
  const f = fixture();
  const result = await feedModule.createMetaProductFeed(f.client);
  const rows = parseCsv(result.csv);
  assert.equal(result.included, 3);
  assert.equal(result.skippedImages, 1);
  assert.deepEqual(rows.map(row => row.id), ['p1', 'p2', 'p3']);
  assert.equal(rows[0].title, 'NRS "Elbise", özel');
  assert.equal(rows[0].description, 'İlk satır\nİkinci satır');
  assert.equal(rows[0].link, 'https://nrsbequiteluminous.com/product/elbise%20p1');
  assert.equal(rows[0].price, '125.50 TRY');
  assert.equal(rows[0].image_link, 'https://project.supabase.co/storage/v1/object/public/product-images/primary.jpg');
  assert.equal(rows[1].image_link, 'https://images.example/i4.jpg');
  assert.deepEqual(rows.map(row => row.availability), ['in stock', 'out of stock', 'in stock']);
  assert.deepEqual(rows.map(row => row.custom_label_0), ['SKU-A', '', '']);
  assert.equal(rows[0].brand, 'NRS Bequite Luminous');
  assert.ok(!result.csv.includes('PRIVATE-DATA'));
  assert.ok(f.calls.filter(call => call.table === 'products').length >= 3);
  assert.ok(f.calls.filter(call => call.table === 'products').every(call => call.filters.some(filter => filter[0] === 'eq' && filter[1] === 'status' && filter[2] === 'active')));
  assert.ok(f.calls.filter(call => call.table === 'product_variants').every(call => call.filters.some(filter => filter[1] === 'is_active' && filter[2] === true)));
});

test('Meta feed omits a genuinely imageless product and uses in_stock without active variants', async () => {
  const f = fixture();
  f.tables.product_images = f.tables.product_images.filter(image => image.product_id !== 'p3');
  f.tables.product_variants = [];
  const result = await feedModule.createMetaProductFeed(f.client);
  assert.equal(result.skippedImages, 2);
  assert.deepEqual(parseCsv(result.csv).map(row => row.availability), ['out of stock', 'in stock']);
});

test('Meta feed reads beyond 500 products and caps related ID batches at 100', async () => {
  const f = fixture(1000);
  const source = f.tables.products[0];
  f.tables.products = Array.from({ length: 601 }, (_, i) => ({ ...source, id: `p${String(i).padStart(4, '0')}`, slug: `product-${i}` }));
  f.tables.product_images = f.tables.products.map((product, i) => ({ ...f.tables.product_images[0], id: `i${String(i).padStart(4, '0')}`, product_id: product.id }));
  f.tables.product_variants = [];
  const result = await feedModule.createMetaProductFeed(f.client);
  const rows = parseCsv(result.csv);
  assert.equal(rows.length, 601);
  assert.equal(new Set(rows.map(row => row.id)).size, 601);
  assert.equal(f.calls.filter(call => call.table === 'products').length, 3);
  assert.ok(f.calls.filter(call => call.table !== 'products').every(call => call.relationSize <= 100));
});

for (const table of ['products', 'product_images', 'product_variants']) {
  test(`Meta feed rejects ${table} errors including later pagination; never returns partial fallback`, async () => {
    const f = fixture(); f.fail(table, 1);
    await assert.rejects(feedModule.createMetaProductFeed(f.client), feedModule.MetaFeedError);
  });
}

test('Meta feed fails closed on missing required data or invalid price, image and stock', async () => {
  for (const mutate of [
    f => { f.tables.products[0].description = null; },
    f => { f.tables.products[0].slug = ''; },
    f => { f.tables.products[0].price_amount = 'bad'; },
    f => { f.tables.products[0].currency = 'bad currency'; },
    f => { f.tables.product_variants[0].stock_quantity = -1; },
    f => { f.tables.product_images[1].provider = 'external'; f.tables.product_images[1].url = 'https://user:secret@images.example/image.jpg'; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(feedModule.createMetaProductFeed(f.client), feedModule.MetaFeedError);
  }
});

test('Meta GET emits CSV with no-store/noindex and an anonymous client; errors return 500 safely', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon';
  const f = fixture();
  const route = loadSource('src/app/api/meta/products/route.ts', {
    '@/lib/meta-product-feed': feedModule,
    '@supabase/supabase-js': { createClient(url, key, options) {
      assert.equal(url, 'https://project.supabase.co'); assert.equal(key, 'public-anon');
      assert.deepEqual(options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
      assert.equal(typeof options.global.fetch, 'function'); return f.client;
    } },
  });
  const oldError = console.error;
  try {
    const response = await route.GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(parseCsv(await response.text()).length, 3);
    f.fail('products'); console.error = () => {};
    const failed = await route.GET();
    assert.equal(failed.status, 500);
    assert.ok(!(await failed.text()).includes('PRIVATE-CREDENTIAL'));
  } finally {
    console.error = oldError;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
