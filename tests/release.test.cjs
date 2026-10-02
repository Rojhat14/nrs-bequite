const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Compile the existing TypeScript in memory; no test dependency or DB access.
function loadSource(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
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
