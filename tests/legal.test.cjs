const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loader(mocks = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = new Module(filename, module);
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const standardRequire = loaded.require.bind(loaded);
    loaded.require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === '@/context/LocaleContext') return { useLocale: () => ({ locale: 'tr', rate: null, fxAvailable: false,
        t: key => ({ checkout: 'Ödemeye geç',
          categories: 'Kategoriler', collections: 'Koleksiyonlar', all: 'Tümünü gör', bag: 'Alışveriş çantası', wishlist: 'Favorilerim',
          menu: 'Menüyü aç', closeMenu: 'Menüyü kapat', search: 'Ürün ara', account: 'Hesabım', favorites: 'Favoriler', cart: 'Sepet',
          productTotal: 'Ürünler toplamı', discount: 'Açılış indirimi', shipping: 'Kargo', total: 'Ödenecek toplam',
          currencyNote: 'USD tutarları güncel kura göre yaklaşık karşılıktır. Ödeme Türk lirası olarak alınır.',
          fxUnavailable: 'Güncel kur bilgisi alınamadı; fiyatlar Türk lirası olarak gösteriliyor.', paymentTry: 'Ödeme Türk lirası olarak alınacaktır.',
          goToBank: 'Garanti BBVA ödeme sayfasına geç', bankRedirecting: 'Garanti BBVA’ya yönlendiriliyorsunuz…',
          reviewSummary: 'Özeti incele', cardPayment: 'Kartla Ödeme Yap', saveTransferRequest: 'Havale / WhatsApp sipariş talebini kaydet',
          resumeTestOrder: 'Bekleyen test siparişine devam et', checkingCartPrices: 'Sepet fiyatları kontrol ediliyor…',
          measurementRequired: 'zorunlu', measurementOptional: 'isteğe bağlı', measurementValidationError: 'Ölçüleri tamamlayıp kontrol edin.',
          checkoutQuoteError: 'Sipariş özeti doğrulanamadı.', checkoutSaveError: 'Sipariş talebi kaydedilemedi.',
          checkoutConsentError: 'Sipariş özetini yeniden inceleyip sözleşmeleri kabul edin.', checkoutPaymentError: 'Ödeme başlatılamadı; sipariş özetini yeniden doğrulayın.' })[key] || key,
        money: amount => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount),
        minorMoney: minor => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(minor / 100),
      }), LocaleProvider: ({ children }) => children };
      if (name === 'server-only') return {};
      if (name.startsWith('@/') || name.startsWith('./')) {
        const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(filename), name);
        const target = ['.ts', '.tsx', ''].map(ext => base + ext).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
        if (target) return load(target);
      }
      return standardRequire(name);
    };
    cache.set(filename, loaded);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    return loaded.exports;
  }
  return load;
}
const load = loader();
const acceptance = load('src/lib/legal/acceptance.ts');
const documents = load('src/lib/legal/documents.ts');
const preflight = load('src/lib/legal/payment-preflight.ts');
const summary = {
  items: [{ productId: 'product', name: 'Test Ürün', description: 'Pamuklu standart ürün', size: 'M', quantity: 2, unitPrice: 99.9 }],
  buyer: { name: 'Test Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Çankaya / Ankara' },
  subtotal: 240, discount: 40.2, shipping: 20, total: 219.8, currency: 'TRY', paymentMethod: 'Havale / EFT',
  deliveryTerms: '5 iş günü içinde teslimat', orderedAt: '2026-10-08T10:00:00Z',
};
const orderId = '11111111-1111-4111-8111-111111111111';

test('A/D: legal acceptance rejects missing, false, string true, and forged/old versions server-side', () => {
  for (const value of [undefined, null, {}, { contractAccepted: false }, { contractAccepted: 'true', contractVersion: 'v1.0', preInformationVersion: 'v1.0' },
    { contractAccepted: true }, { contractAccepted: true, contractVersion: 'v0.9', preInformationVersion: 'v1.0' },
    { contractAccepted: true, contractVersion: 'v1.0', preInformationVersion: 'v0.9' }]) {
    assert.ok(acceptance.validateLegalAcceptance(value));
    assert.throws(() => preflight.assertPaymentLegalAcceptance(value));
    assert.throws(() => preflight.prepareOrderLegalRecord(orderId, value, summary));
  }
  assert.throws(() => acceptance.withLegalAcceptance({ items: [] }, false), /kabul edin/);
});

test('B/C: accepted current versions bind to payload and server-dated immutable record without extra personal metadata', () => {
  const payload = acceptance.withLegalAcceptance({ totalAmount: 219.8, accepted_at: 'forged', ip: 'forged' }, true);
  assert.equal(acceptance.validateLegalAcceptance(payload), null);
  const record = preflight.prepareOrderLegalRecord(orderId, payload, { ...summary, ip: 'forged', userAgent: 'forged' });
  assert.equal(record.order_id, orderId);
  assert.equal(record.contract_accepted, true);
  assert.equal(record.contract_version, 'v1.5');
  assert.equal(record.pre_information_version, 'v1.5');
  assert.notEqual(record.accepted_at, 'forged');
  assert.ok(Math.abs(Date.now() - Date.parse(record.accepted_at)) < 2000);
  assert.match(record.document_hash, /^[0-9a-f]{64}$/);
  assert.match(record.summary_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(record.order_summary, summary);
  assert.doesNotMatch(JSON.stringify(record), /userAgent|user_agent|"ip"|forged/);
  const changed = preflight.prepareOrderLegalRecord(orderId, payload, { ...summary, buyer: { ...summary.buyer, name: 'Başka Alıcı' } });
  assert.notEqual(record.summary_hash, changed.summary_hash);
  assert.equal(record.document_hash, changed.document_hash);
  const current=documents.LEGAL_DOCUMENT_ARCHIVE['v1.5'];
  assert.equal(record.document_hash,require('node:crypto').createHash('sha256').update(JSON.stringify({seller:current.seller,contract:current.documents['mesafeli-satis-sozlesmesi'],preInformation:current.documents['on-bilgilendirme-formu']})).digest('hex'));
  // Pin the accepted text archive: changing published v1.0 requires a NEW version.
  const archive = documents.LEGAL_DOCUMENT_ARCHIVE['v1.0'];
  assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify({ seller: archive.seller, contract: archive.documents['mesafeli-satis-sozlesmesi'], preInformation: archive.documents['on-bilgilendirme-formu'] })).digest('hex'), '9af5d0a13effd261283cb9a4b3ddbd141e9a49f1803e19c85888cd77068d0ce9');
});

test('Server record preparation rejects unknown shipping, missing buyer/date, and inconsistent money', () => {
  const accepted = acceptance.createLegalAcceptance(true);
  for (const invalid of [{ ...summary, shipping: null }, { ...summary, buyer: { ...summary.buyer, address: '' } },
    { ...summary, orderedAt: undefined }, { ...summary, total: 1 }, { ...summary, subtotal: NaN },
    { ...summary, items: [{ ...summary.items[0], quantity: 0 }] }]) {
    assert.throws(() => preflight.prepareOrderLegalRecord(orderId, accepted, invalid));
  }
});

const linkMock = { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
const imageMock = { __esModule: true, default: ({ fill, priority, ...props }) => React.createElement('img', props) };
const animationMock = { m: new Proxy({}, { get: (_, tag) => ({ children, initial, animate, exit, transition, ...props }) => React.createElement(tag, props, children) }), AnimatePresence: ({ children }) => children };
const uiLoad = loader({ 'next/link': linkMock, 'next/image': imageMock, 'framer-motion': animationMock,
  'next/navigation': { notFound() { throw new Error('NOT_FOUND'); }, permanentRedirect(href) { throw new Error('REDIRECT ' + href); } } });

test('E: eight legal pages and every footer legal/service link render; invalid archive does not silently show current text', async () => {
  const Footer = uiLoad('src/components/Footer.tsx').default;
  const footer = renderToStaticMarkup(React.createElement(Footer));
  assert.match(footer, /Yasal/);
  for (const route of documents.LEGAL_ROUTES) {
    const Page = uiLoad('src/app' + route + '/page.tsx').default;
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    assert.ok(footer.includes(`href="${route}"`));
    assert.match(html, /NRS BOUTQUE LUMINOUS/);
    assert.match(html, /rojhat1maman@gmail.com/);
    assert.match(html, /v1.5/);
  }
  assert.equal(documents.getLegalDocument('mesafeli-satis-sozlesmesi', 'v999'), null);
  assert.equal(documents.getLegalDocument('__proto__'), null);
  assert.throws(() => uiLoad('src/app/returns/page.tsx').default(), /REDIRECT \/iade-ve-degisim/);
  assert.throws(() => uiLoad('src/app/shipping/page.tsx').default(), /REDIRECT \/kargo-ve-teslimat/);
});

function checkoutHarness(enabled, confirmed = false, { initialStep = enabled ? 2 : 3, itemMeasurements = {chest:92,waist:72,hips:98,height:168}, guest = false } = {}) {
  const slots = [];
  let cursor = 0;
  const cart = { items: [{ id: 'product', title: 'Test Ürün', price: '₺99,90', size: 'M', variantId: orderId, quantity: 2, measurements: itemMeasurements }],
    subtotalAmount: 240, discountAmount: 40.2, shippingAmount: 0, totalAmount: 199.8, catalogPricesSynced: true,
    catalogPricesSyncedFor: `tr:${guest ? 'guest' : orderId}:product`, activeCartVariants: [{ id: '22222222-2222-4222-8222-222222222222', productId: 'product', size: '36' }], openDrawer() {}, updateMeasurements() {}, removeItem() {},
    replaceItemVariant(cartItemId, variantId, size) { cart.items[0] = { ...cart.items[0], variantId, size }; return true } };
  const fakeReact = { ...React, useEffect(effect) { effect(); }, useState(initial) {
    const index = cursor++;
    if (!(index in slots)) {
      const customer = { firstName: 'Test', lastName: 'Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Beytepe', city: 'Ankara', district: 'Çankaya', postalCode: '06800', orderNote: '' };
      const inputKey = JSON.stringify({ items: cart.items, measurements: { ['product::'+orderId]: cart.items[0].measurements }, formData: customer, subtotalAmount: cart.subtotalAmount, discountAmount: cart.discountAmount, shippingAmount: cart.shippingAmount, totalAmount: cart.totalAmount });
      slots[index] = index === 0 ? initialStep : index === 1 ? true : confirmed && index === 5 ? { summary, hash: 'a'.repeat(64) }
        : confirmed && index === 6 ? inputKey : confirmed && index === 7 ? orderId : index === 14 ? customer : typeof initial === 'function' ? initial() : initial;
    }
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  } };
  const checkoutLoad = loader({ react: fakeReact, 'next/link': linkMock, 'next/image': imageMock,
    'framer-motion': animationMock, 'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/lib/feature-flags': { useCardPaymentEnabled: () => enabled },
    '@/context/AuthContext': { useAuth: () => ({ user: guest ? null : { id: orderId, email: 'test@example.com', user_metadata: {} }, profile: null, loading: false, profileLoading: false }) },
    '@/components/AccountModal': { __esModule: true, default: () => null },
    '@/store/useCart': { getCartItemId: item => item.id + '::' + item.variantId, useCart: () => cart, parsePrice: price => Number(price.replace('₺', '').replace(',', '.')) } });
  const Checkout = checkoutLoad('src/app/checkout/page.tsx').default;
  return { cart, render() { cursor = 0; return Checkout(); } };
}
function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.map(child => findElement(child, predicate)).find(Boolean) || null;
  if (predicate(node)) return node;
  return findElement(node.props?.children, predicate);
}

test('A/B/F: real checkout blocks unticked acceptance; one accepted click quotes and creates payment; changes reset consent', async () => {
  const harness = checkoutHarness(true);
  const oldFetch = global.fetch;
  let requests = 0;
  global.fetch = async url => {
    requests++;
    return url === '/api/payment/quote'
      ? { ok: true, json: async () => ({ summary, hash: 'a'.repeat(64) }) }
      : { ok: false, json: async () => ({ error: 'Test: payment unavailable' }) };
  };
  try {
    let tree = harness.render();
    const button = findElement(tree, node => node.type === 'button' && node.props.children === 'Garanti BBVA ödeme sayfasına geç');
    assert.ok(button);
    button.props.onClick();
    tree = harness.render();
    let consent = findElement(tree, node => node.type?.name === 'CheckoutLegalConsent');
    assert.match(consent.props.error, /kabul edin/);
    assert.equal(consent.props.accepted, false);
    consent.props.onChange(true);
    tree = harness.render();
    consent = findElement(tree, node => node.type?.name === 'CheckoutLegalConsent');
    assert.equal(consent.props.accepted, true);
    findElement(tree, node => node.type === 'button' && node.props.children === 'Garanti BBVA ödeme sayfasına geç').props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    tree = harness.render();
    consent = findElement(tree, node => node.type?.name === 'CheckoutLegalConsent');
    assert.equal(requests, 2);
    const html = renderToStaticMarkup(consent);
    assert.match(html, /type="checkbox"/);
    assert.match(html, /required=""/);
    assert.match(html, /for="checkout-contract"/);
    assert.match(html, /href="\/mesafeli-satis-sozlesmesi\?version=v1\.5"/);
    assert.match(html, /href="\/on-bilgilendirme-formu\?version=v1\.5"/);
    assert.match(html, /min-h-11/);
    assert.match(html, /min-w-0/);
    assert.doesNotMatch(html, /KVKK.*kabul ediyorum/);
    harness.cart.totalAmount = 200;
    assert.equal(findElement(harness.render(), node => node.type?.name === 'CheckoutLegalConsent').props.accepted, false);
  } finally { global.fetch = oldFetch; }
});

test('Guest checkout opens at delivery details without an auth prompt; optional note and measurements do not block continuation', () => {
  const harness = checkoutHarness(true, false, { initialStep: 2, itemMeasurements: {}, guest: true });
  const tree = harness.render();
  assert.ok(findElement(tree, node => node.type === 'h2' && node.props.children === 'customerDelivery'));
  assert.equal(findElement(tree, node => node.type === 'h2' && node.props.children === 'Hesabınızla devam edin'), null);
  assert.equal(findElement(tree, node => node.type?.name === 'AccountModal'), null);
  assert.ok(findElement(tree, node => node.type === 'button' && node.props.children === 'Garanti BBVA ödeme sayfasına geç'));
});

test('Payment flag remains false and WhatsApp does not require card consent', () => {
  assert.equal(load('src/lib/feature-flags.ts').ENABLE_CARD_PAYMENT, false);
  const tree = checkoutHarness(false).render();
  assert.equal(findElement(tree, node => node.type?.name === 'CheckoutLegalConsent'), null);
  assert.equal(findElement(tree, node => node.type === 'button' && node.props.children === 'Siparişi Ver ve Ödeme Yap'), null);
  const cardButton = findElement(tree, node => node.type === 'button' && node.props.children === 'Kartla Ödeme Yap');
  assert.ok(cardButton);
  assert.equal(cardButton.props.disabled, true);
  assert.equal(cardButton.props.onClick, undefined);
  assert.match(renderToStaticMarkup(tree), /Kartla ödeme şu anda kullanılamıyor\. Sipariş talebinizi WhatsApp üzerinden iletebilirsiniz\./);
  assert.ok(findElement(tree, node => node.type?.name === 'CartWhatsappOrder'));
});

test('Checkout requests a server quote with no personal measurements and keeps them optional', async () => {
  const harness = checkoutHarness(false, false, { initialStep: 2, itemMeasurements: {} });
  let request;
  const oldFetch = global.fetch;
  global.fetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ summary, hash: 'b'.repeat(64) }) };
  };
  try {
    const tree = harness.render();
    const measurements = findElement(tree, node => node.type === 'details' && node.props.children?.[0]?.props?.id === 'checkout-measurements-summary');
    assert.ok(measurements);
    assert.notEqual(measurements.props.open, true);
    const review = findElement(tree, node => node.type === 'button' && node.props.children === 'Özeti incele');
    review.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(request.url, '/api/orders/quote');
    assert.equal(Object.hasOwn(request.body.items[0], 'measurements'), false);
    assert.equal(harness.cart.items[0].measurements && Object.keys(harness.cart.items[0].measurements).length, 0);
  } finally { global.fetch = oldFetch; }
});

test('A stale pre-auth variant asks for only a new size and keeps the same cart line and optional measurements', async () => {
  const itemMeasurements = { chest: 92, waist: 72 };
  const harness = checkoutHarness(false, false, { initialStep: 2, itemMeasurements });
  const oldFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 409, json: async () => ({ code: 'VARIANT_UNAVAILABLE', productId: 'product' }) });
  try {
    findElement(harness.render(), node => node.type === 'button' && node.props.children === 'Özeti incele').props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    const tree = harness.render();
    const selector = findElement(tree, node => node.type === 'select');
    assert.ok(selector);
    selector.props.onChange({ target: { value: '22222222-2222-4222-8222-222222222222' } });
    assert.equal(harness.cart.items.length, 1);
    assert.equal(harness.cart.items[0].variantId, '22222222-2222-4222-8222-222222222222');
    assert.equal(harness.cart.items[0].size, '36');
    assert.equal(harness.cart.items[0].quantity, 2);
    assert.deepEqual(harness.cart.items[0].measurements, itemMeasurements);
    assert.equal(findElement(harness.render(), node => node.type === 'div' && node.props.role === 'alert' && node.props.className?.includes('amber')), null);
  } finally { global.fetch = oldFetch; }
});

test('Unavailable card payment keeps customer fields and verified manual-order consent available', () => {
  const tree = checkoutHarness(false, true).render();
  assert.ok(findElement(tree, node => node.type === 'input' && node.props.id === 'checkout-firstName'));
  assert.ok(findElement(tree, node => node.type === 'textarea' && node.props.id === 'checkout-address'));
  const consent = findElement(tree, node => node.type?.name === 'CheckoutLegalConsent');
  assert.ok(consent);
  assert.equal(consent.props.accepted, false);
  assert.ok(findElement(tree, node => node.type === 'button' && node.props.children === 'Havale / WhatsApp sipariş talebini kaydet'));
});

for (const route of ['create', 'callback']) {
  test(`D: payment ${route} keeps 503 for missing and valid acceptance`, async () => {
    const { POST } = load(`src/app/api/payment/${route}/route.ts`);
    for (const payload of [{}, acceptance.createLegalAcceptance(true)]) {
      const response = await POST(new Request('http://localhost/api/payment/' + route,
        { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }));
      assert.equal(response.status, 503);
    }
  });
}

async function orderDocumentsHarness(result) {
  const states = [];
  let cursor = 0;
  const queries = [];
  const fakeReact = { ...React, useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], value => { states[index] = value; }];
  } };
  const orderLoad = loader({ react: fakeReact, 'next/link': linkMock,
    '@/lib/supabase': { supabase: { from(table) { queries.push(table); return {
      select() { return this; }, eq(key, value) { queries.push({ key, value }); return this; }, async maybeSingle() { return result; },
    }; } } } });
  const Component = orderLoad('src/components/legal/OrderLegalDocuments.tsx').default;
  const render = () => { cursor = 0; return Component({ orderId }); };
  let tree = render();
  findElement(tree, node => node.type === 'button').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  return { tree, html: renderToStaticMarkup(tree), queries };
}

test('Account documents use saved summary/version, not live product data, with order-scoped query', async () => {
  const record = preflight.prepareOrderLegalRecord(orderId, acceptance.createLegalAcceptance(true), summary);
  const result = await orderDocumentsHarness({ data: record, error: null });
  assert.deepEqual(result.queries, ['order_legal_records', { key: 'order_id', value: orderId }]);
  assert.match(result.html, /Test Alıcı/);
  assert.match(result.html, /Pamuklu standart ürün/);
  assert.match(result.html, /Kabul zamanı/);
  assert.match(result.html, /mesafeli-satis-sozlesmesi\?version=v1.5/);
  assert.match(result.html, /on-bilgilendirme-formu\?version=v1.5/);
});

test('Legacy orders and missing migration preserve history and never invent contract acceptance', async () => {
  const legacy = await orderDocumentsHarness({ data: null, error: null });
  assert.match(legacy.html, /kayıtlı sözleşme kabulü bulunamadı/);
  assert.doesNotMatch(legacy.html, /Kabul zamanı/);
  const unavailable = await orderDocumentsHarness({ data: null, error: { code: 'PGRST205' } });
  assert.match(unavailable.html, /şu anda yüklenemiyor/);
  assert.doesNotMatch(unavailable.html, /Kabul zamanı/);
});

test('Unknown historical version is reported instead of replacing it with a current contract', async () => {
  const record = preflight.prepareOrderLegalRecord(orderId, acceptance.createLegalAcceptance(true), summary);
  record.contract_version = 'v0.1';
  const result = await orderDocumentsHarness({ data: record, error: null });
  assert.match(result.html, /Bu belge sürümü arşivde bulunamadı/);
  assert.doesNotMatch(result.html, /href="\/mesafeli-satis-sozlesmesi\?version=v1.0"/);
});

test('Real checkout sends only IDs/quantities and versioned consent after confirmed quote and checkbox', async () => {
  const harness = checkoutHarness(true, true);
  const oldFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return url === '/api/payment/quote'
      ? { ok: true, json: async () => ({ summary, hash: 'a'.repeat(64) }) }
      : { ok: false, json: async () => ({ error: 'Test: ödeme kapalı' }) };
  };
  try {
    let tree = harness.render();
    const findButton = node => findElement(node, element => element.type === 'button' && element.props.children === 'Garanti BBVA ödeme sayfasına geç');
    findButton(tree).props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 0);
    tree = harness.render();
    findElement(tree, node => node.type?.name === 'CheckoutLegalConsent').props.onChange(true);
    tree = harness.render(); findButton(tree).props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 2); assert.equal(calls[0].url, '/api/payment/quote');
    assert.equal(calls[1].url, '/api/payment/create');
    assert.equal(calls[1].body.contractAccepted, true); assert.equal(calls[1].body.contractVersion, 'v1.5');
    assert.equal(calls[1].body.quoteHash, 'a'.repeat(64));
    assert.equal(calls[1].body.totalAmount, undefined); assert.equal(calls[1].body.items[0].price, undefined);
  } finally { global.fetch = oldFetch; }
});

test('Payment start failure shows one Turkish checkout alert with the server reference and preserves customer input', async () => {
  const harness = checkoutHarness(true, true), oldFetch = global.fetch;
  global.fetch = async url => url === '/api/payment/quote'
    ? { ok: true, json: async () => ({ summary, hash: 'a'.repeat(64) }) }
    : { ok: false, status: 409, json: async () => ({ error: 'private internal detail', errorCode: 'NRS-PAY-RPC', trackingNumber: 'A7F2C9D8B1E4F603' }) };
  try {
    let tree = harness.render();
    findElement(tree, node => node.type?.name === 'CheckoutLegalConsent').props.onChange(true);
    tree = harness.render();
    findElement(tree, node => node.type === 'button' && node.props.children === 'Garanti BBVA ödeme sayfasına geç').props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    tree = harness.render();
    const alerts = [];
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (node.props?.role === 'alert') alerts.push(node);
      visit(node.props?.children);
    };
    visit(tree);
    assert.equal(alerts.length, 1);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /Ödeme başlatılamadı/);
    assert.match(html, /NRS-PAY-RPC/);
    assert.match(html, /A7F2C9D8B1E4F603/);
    assert.doesNotMatch(html, /Payment could not be started|private internal detail/);
    assert.match(html, /value="Test"/);
    assert.match(html, /value="test@example\.com"/);
  } finally { global.fetch = oldFetch; }
});

test('Pending-order recovery link is visible after a quote when payment creation returns an owned order', async () => {
  const harness = checkoutHarness(true, true), oldFetch = global.fetch;
  const resumeUrl = '/checkout/verify?orderId=11111111-1111-4111-8111-111111111111';
  let calls = 0;
  global.fetch = async url => {
    calls++;
    return url === '/api/payment/quote'
      ? { ok: true, json: async () => ({ summary, hash: 'a'.repeat(64) }) }
      : { ok: false, json: async () => ({ error: 'Bekleyen sipariş', code: 'UNRESOLVED_PAYMENT', resumeUrl }) };
  };
  try {
    let tree = harness.render();
    findElement(tree, node => node.type?.name === 'CheckoutLegalConsent').props.onChange(true);
    tree = harness.render();
    findElement(tree, node => node.type === 'button' && node.props.children === 'Garanti BBVA ödeme sayfasına geç').props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    tree = harness.render();
    const link = findElement(tree, node => node.props?.href === resumeUrl);
    assert.ok(link); assert.equal(link.props.children, 'Bekleyen test siparişine devam et'); assert.equal(calls, 2);
  } finally { global.fetch = oldFetch; }
});
