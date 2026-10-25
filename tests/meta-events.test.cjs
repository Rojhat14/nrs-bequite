const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loader } = require('./source-loader.cjs');

const load = () => loader({
  '@/components/MetaPixel': { META_PIXEL_ID: 'pixel-1' },
  '@/store/useCart': { parsePrice: value => Number(String(value).replace(/[^\d,]/g, '').replace(',', '.')) },
})(path.resolve(__dirname, '..', 'src/lib/meta-events.ts'));

test('commerce events are sent only after the consented pixel has loaded', () => {
  const events = load();
  global.window = {};
  events.trackAddToCart({ id: 'dress', name: 'Dress', priceAmount: 4290, price: '₺4.290' }, 1);
  const calls = [];
  window.fbq = (...args) => calls.push(args);
  events.trackViewContent({ id: 'dress', name: 'Dress', priceAmount: 4290, price: '₺4.290' });
  events.trackAddToCart({ id: 'dress', name: 'Dress', priceAmount: null, price: '₺4.290,00' }, 2);
  events.trackInitiateCheckout([{ id: 'dress', price: '₺4.290,00', quantity: 2 }, { id: 'suit', price: '₺6.490,00', quantity: 1 }]);
  delete global.window;
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => [call[0], call[1], call[2]]), [['trackSingle', 'pixel-1', 'ViewContent'], ['trackSingle', 'pixel-1', 'AddToCart'], ['trackSingle', 'pixel-1', 'InitiateCheckout']]);
  assert.deepEqual(calls[1][3].content_ids, ['dress']);
  assert.equal(calls[1][3].value, 8580);
  assert.equal(calls[1][3].currency, 'TRY');
  assert.deepEqual(calls[2][3].content_ids, ['dress', 'suit']);
  assert.equal(calls[2][3].num_items, 3);
  assert.equal(calls[2][3].value, 15070);
});

test('a paid order reports Purchase with the order total and a dedupe event ID', () => {
  const events = load();
  const calls = [];
  global.window = { fbq: (...args) => calls.push(args) };
  events.trackPurchase('order-uuid', [{ productId: 'dress', quantity: 1, unitPrice: 4290 }, { productId: 'suit', quantity: 2, unitPrice: 6490 }], 17270);
  delete global.window;
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], 'Purchase');
  assert.deepEqual(calls[0][3].content_ids, ['dress', 'suit']);
  assert.equal(calls[0][3].value, 17270);
  assert.equal(calls[0][3].num_items, 3);
  assert.deepEqual(calls[0][4], { eventID: 'order-order-uuid' });
});

test('checkout pages stay unmeasured except the paid-order result page', () => {
  const source = require('node:fs').readFileSync(path.resolve(__dirname, '..', 'src/components/MetaPixel.tsx'), 'utf8');
  const rule = source.match(/if \(!allowed \|\| !pathname \|\| (.*)\) return/)[1];
  const excluded = new Function('pathname', `return ${rule}`);
  assert.equal(excluded('/checkout'), true);
  assert.equal(excluded('/checkout/verify'), true);
  assert.equal(excluded('/checkout/failure'), true);
  assert.equal(excluded('/profile'), true);
  assert.equal(excluded('/checkout/success'), false);
  assert.equal(excluded('/product/dress'), false);
  const result = require('node:fs').readFileSync(path.resolve(__dirname, '..', 'src/components/payment/PaymentResult.tsx'), 'utf8');
  assert.match(result, /const reportPurchase = paid && /);
});
