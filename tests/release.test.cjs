const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loader } = require('./source-loader.cjs');

// Compile the existing TypeScript in memory; no test dependency or DB access.
function loadSource(relativePath) {
  return loader()(path.resolve(__dirname, '..', relativePath));
}

const memory = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key),
} });
globalThis.window = { localStorage: globalThis.localStorage };
const { useCart, parsePrice, getCartItemId } = loadSource('src/store/useCart.ts');

test('Turkish and international prices preserve decimal amounts', () => {
  for (const [input, amount] of [['₺1.234,50', 1234.5], ['₺1,234.50', 1234.5], ['₺1.234', 1234], ['₺1,234', 1234], ['₺99,90', 99.9], ['₺99.90', 99.9], [NaN, 0]]) {
    assert.equal(parsePrice(input), amount);
  }
});

test('Different sizes remain separate and discounts use integer minor units', () => {
  useCart.getState().clearCart();
  const small = { id: 'test-product', title: 'Test', price: '₺99,90', compareAtPrice: 120, size: 'S', variantId: 'small' };
  const large = { ...small, size: 'L', variantId: 'large' };
  useCart.getState().addItem(small, 2);
  useCart.getState().addItem(large);
  assert.equal(useCart.getState().items.length, 2);
  assert.equal(useCart.getState().subtotalAmount, 360);
  assert.equal(useCart.getState().discountAmount, 60.3);
  assert.equal(useCart.getState().totalAmount, 299.7);
  useCart.getState().updateQuantity(getCartItemId(small), 0);
  assert.equal(useCart.getState().items.length, 1);
  assert.equal(useCart.getState().items[0].variantId, 'large');
  assert.equal(useCart.getState().totalAmount, 99.9);
  useCart.getState().clearCart();
});

test('Saved cart items refresh to current catalog prices and recompute totals', () => {
  useCart.getState().clearCart();
  useCart.getState().setCatalogPricesSynced(true);
  useCart.getState().addItem({ id: 'refresh-me', title: 'Ürün', price: '₺100', compareAtPrice: 120 }, 2);

  useCart.getState().syncCatalogPrices([{ id: 'refresh-me', price: 74.9, compareAtPrice: null }]);
  let state = useCart.getState();
  assert.equal(state.items[0].price, '₺74.9');
  assert.equal(state.items[0].compareAtPrice, null);
  assert.equal(state.totalAmount, 149.8);
  assert.equal(state.discountAmount, 0);
  assert.equal(state.catalogPricesSynced, true);
  assert.equal(state.priceUpdateNotice, true);

  useCart.getState().addItem({ id: 'refresh-me', title: 'Ürün', price: '₺69', compareAtPrice: null });
  state = useCart.getState();
  assert.equal(state.items[0].price, '₺69');
  assert.equal(state.totalAmount, 207);
  useCart.getState().clearCart();
});

test('Product structured data uses the normal catalog price and currency, not compare-at price', () => {
  const { buildProductStructuredData } = loadSource('src/lib/product-structured-data.ts');
  const schema = buildProductStructuredData({ id: 'dress-id', slug: 'dress-slug', name: 'Dress', description: 'Description',
    priceAmount: 24900, currency: 'TRY', compareAtPrice: 30000, inStock: true, galleryImages: [{ url: 'https://example.test/dress.webp' }] });
  assert.equal(schema['@type'], 'Product');
  assert.equal(schema.offers.price, 24900);
  assert.equal(schema.offers.priceCurrency, 'TRY');
  assert.equal(schema.offers.availability, 'https://schema.org/InStock');
});

test('Malformed saved carts cannot replace store actions or poison totals', () => {
  const state = useCart.getState();
  const restored = useCart.persist.getOptions().merge({
    clearCart: 'invalid', isDrawerOpen: true,
    items: [null, {}, { id: 'bad', title: 'Bad', price: '₺1', quantity: NaN },
      { id: 'valid', title: 'Valid', price: '₺10', quantity: 2.9, size: 123 }],
    wishlist: ['valid', null, 42],
  }, state);
  assert.equal(restored.clearCart, state.clearCart);
  assert.equal(restored.isDrawerOpen, false);
  assert.equal(restored.items.length, 1);
  assert.equal(restored.items[0].quantity, 2);
  assert.equal(restored.items[0].size, undefined);
  assert.equal(restored.totalAmount, 20);
  assert.deepEqual(restored.wishlist, ['valid']);
});

for (const route of ['create', 'callback']) {
  test(`Unconfigured payment ${route} rejects requests without DB access`, async () => {
    const { POST } = loadSource(`src/app/api/payment/${route}/route.ts`);
    const response = await POST(new Request('http://localhost/api/payment/' + route, {
      method: 'POST', body: JSON.stringify({ orderId: 'forged', status: 'paid', totalAmount: 0 }),
    }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /kullanılamıyor/);
  });
}

test('Invalid contact settings never produce live contact links', () => {
  const originalEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const originalPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  try {
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = 'invalid';
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = '123';
    assert.equal(loadSource('src/lib/storefront-config.ts').contactEmail, null);
    assert.equal(loadSource('src/lib/storefront-config.ts').whatsappNumber, null);
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = 'shop@example.com';
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = '+90 (555) 123 45 67';
    const config = loadSource('src/lib/storefront-config.ts');
    assert.equal(config.contactEmail, 'shop@example.com');
    assert.equal(config.whatsappNumber, '905551234567');
  } finally {
    if (originalEmail === undefined) delete process.env.NEXT_PUBLIC_CONTACT_EMAIL;
    else process.env.NEXT_PUBLIC_CONTACT_EMAIL = originalEmail;
    if (originalPhone === undefined) delete process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
    else process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = originalPhone;
  }
});

test('Missing editorial files do not generate image requests', () => {
  const originalAssets = process.env.NRS_EDITORIAL_ASSETS;
  try {
    process.env.NRS_EDITORIAL_ASSETS = '[]';
    const missing = loadSource('src/lib/editorialImages.ts');
    assert.equal(missing.getCategoryEditorialImage('dresses'), null);
    assert.equal(missing.getCollectionEditorialImage('gunduz'), null);
    process.env.NRS_EDITORIAL_ASSETS = JSON.stringify(['/images/editorial/categories/dresses.jpg']);
    const available = loadSource('src/lib/editorialImages.ts');
    assert.equal(available.getCategoryEditorialImage('dresses'), '/images/editorial/categories/dresses.jpg');
    assert.equal(available.getCategoryEditorialImage('blazers'), null);
  } finally {
    if (originalAssets === undefined) delete process.env.NRS_EDITORIAL_ASSETS;
    else process.env.NRS_EDITORIAL_ASSETS = originalAssets;
  }
});
