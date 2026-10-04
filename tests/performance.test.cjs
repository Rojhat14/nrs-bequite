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

const { createWishlistLookup } = loadSource('src/lib/wishlistLookup.ts');

test('showcase keeps the visible track covered at every supported viewport and animation endpoint', () => {
  const { getShowcaseItemCount, SHOWCASE_TRAVEL } = loadSource('src/lib/showcase.ts');
  for (const viewport of [320, 390, 768, 1024, 1440, 1920, 3840, 7680]) {
    const count = getShowcaseItemCount(viewport);
    const trackWidth = count * 250 + (count - 1) * 32;
    assert.ok(trackWidth - SHOWCASE_TRAVEL >= viewport);
    assert.ok(count < 183);
  }
});

test('61 simultaneous card lookups use one read, including duplicate product IDs', async () => {
  const calls = [];
  const lookup = createWishlistLookup(async (user, ids) => {
    calls.push({ user, ids });
    return ['p3'];
  });
  const values = await Promise.all([...Array.from({ length: 61 }, (_, i) => lookup('user-a', `p${i}`)), lookup('user-a', 'p3')]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ids.length, 61);
  assert.equal(values[3], true);
  assert.equal(values[61], true);
  assert.equal(values.filter(Boolean).length, 2);
});

test('wishlist reads isolate users, cap IN batches, and never reuse completed data', async () => {
  const calls = [];
  let favorites = ['p0'];
  const lookup = createWishlistLookup(async (user, ids) => {
    calls.push({ user, ids });
    return user === 'user-a' ? favorites : [];
  });
  const values = await Promise.all([
    ...Array.from({ length: 205 }, (_, i) => lookup('user-a', `p${i}`)),
    lookup('user-b', 'p0'),
  ]);
  assert.equal(calls.filter(call => call.user === 'user-a').length, 3);
  assert.ok(calls.every(call => call.ids.length <= 100));
  assert.equal(values[0], true);
  assert.equal(values[205], false);
  favorites = [];
  assert.equal(await lookup('user-a', 'p0'), false);
  assert.equal(calls.length, 5);
});

test('failed wishlist batches settle every caller and allow a fresh retry', async () => {
  let fail = true;
  const lookup = createWishlistLookup(async () => {
    if (fail) throw new Error('Read failed');
    return ['p1'];
  });
  const results = await Promise.allSettled([lookup('a', 'p1'), lookup('a', 'p2')]);
  assert.ok(results.every(result => result.status === 'rejected'));
  fail = false;
  assert.equal(await lookup('a', 'p1'), true);
});

test('only local and allowlisted public image sources use the optimizer', () => {
  const { canOptimizeImage } = loadSource('src/lib/imageOptimization.ts');
  const host = 'https://example.supabase.co';
  assert.equal(canOptimizeImage('/images/products/item.png', host), true);
  assert.equal(canOptimizeImage('https://images.unsplash.com/photo-1', host), true);
  assert.equal(canOptimizeImage(`${host}/storage/v1/object/public/product-images/item.png`, host), true);
  for (const url of ['https://other.example/item.jpg', '//other.example/item.jpg', 'https://images.unsplash.com:444/photo-1', `${host}/storage/v1/object/sign/item.jpg`, 'data:image/png;base64,x', 'invalid']) {
    assert.equal(canOptimizeImage(url, host), false);
  }
});

function catalogFixture() {
  const tables = {
    products: [{ id: 'p1', slug: 'dress', name: 'Dress', category_id: 'c1', description: 'Description', price_amount: '125.50', currency: 'TRY', compare_at_price: '150', in_stock: false, fabric: 'Cotton', care: 'Wash', status: 'active', created_at: '2026-01-01' }],
    categories: [{ id: 'c1', name: 'Elbiseler', slug: 'elbiseler', description: null, sort_order: 1, is_active: true }],
    collections: [{ id: 'c2', name: 'Gece', slug: 'gece', description: null, sort_order: 1, is_active: true }],
    product_images: [
      { id: 'i1', product_id: 'p1', url: '/first.jpg', provider: 'external', storage_key: null, alt_text: 'First', sort_order: 0, is_primary: false, created_at: '2026-01-01' },
      { id: 'i2', product_id: 'p1', url: '/primary.jpg', provider: 'external', storage_key: null, alt_text: 'Primary', sort_order: 1, is_primary: true, created_at: '2026-01-01' },
    ],
    product_variants: [
      { id: 'v1', product_id: 'p1', size: 'M', stock_quantity: 3, is_active: true },
      { id: 'v2', product_id: 'p1', size: 'L', stock_quantity: 9, is_active: false },
    ],
    product_collections: [{ product_id: 'p1', collection_id: 'c2' }],
  };
  const calls = [];
  const supabase = { from(table) {
    let rows = tables[table] || [], columns = '*', single = false;
    const query = {
      select(value) { columns = value; return query; },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return query; },
      in(key, values) { rows = rows.filter(row => values.includes(row[key])); return query; },
      order() { return query; },
      maybeSingle() { single = true; return query; },
      then(resolve, reject) {
        calls.push({ table, columns });
        const projected = columns === '*' ? rows : rows.map(row => Object.fromEntries(columns.split(',').map(key => [key.trim(), row[key.trim()]])));
        return Promise.resolve({ data: single ? projected[0] ?? null : projected, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  // Model React's per-render memoization. Each fixture is a separate request;
  // this is a query-contract test, not a measurement of Next's network cache.
  const cache = fn => {
    const memo = new Map();
    return (...args) => {
      const key = JSON.stringify(args);
      if (!memo.has(key)) memo.set(key, fn(...args));
      return memo.get(key);
    };
  };
  const api = loadSource('src/lib/products.ts', {
    'server-only': {}, react: { cache },
    '@/data/products': { PRODUCTS: [] },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => supabase },
    '@/lib/storage/products': { getProductImageUrl: (_client, image) => image.url },
  });
  return { api, tables, calls };
}

test('catalog mapping preserves primary image, variants, price, aliases and collections', async () => {
  const { api } = catalogFixture();
  const product = await api.getStorefrontProduct('dress');
  assert.equal(product.id, 'p1');
  assert.equal(product.image, '/primary.jpg');
  assert.deepEqual(product.galleryImages.map(image => image.url), ['/first.jpg', '/primary.jpg']);
  assert.equal(product.priceAmount, 125.5);
  assert.equal(product.inStock, true);
  assert.deepEqual(product.variants, [{ id: 'v1', size: 'M', stock_quantity: 3 }]);
  assert.deepEqual(product.collections, [{ id: 'c2', name: 'Gece', slug: 'gece' }]);
  assert.deepEqual(await api.getStorefrontProduct('p1'), product);
  assert.equal(await api.getStorefrontProduct('missing'), null);
  assert.deepEqual((await api.getCategoryCatalog('dresses')).products, [product]);
  assert.deepEqual((await api.getCollectionCatalog('gece')).products, [product]);
});

test('metadata/page reads coalesce within a render and categories are reused by navigation', async () => {
  const { api, calls } = catalogFixture();
  const [first, second] = await Promise.all([api.getStorefrontProduct('dress'), api.getStorefrontProduct('dress'), api.getStorefrontNavigationData()]);
  assert.equal(first, second);
  assert.equal(calls.filter(call => call.table === 'products').length, 1);
  assert.equal(calls.filter(call => call.table === 'categories').length, 1);
  assert.ok(calls.every(call => call.columns !== '*'));
  const nextRequest = catalogFixture();
  nextRequest.tables.products[0].price_amount = '99';
  assert.equal((await nextRequest.api.getStorefrontProduct('dress')).priceAmount, 99);
});
