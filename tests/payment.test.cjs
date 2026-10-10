const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./source-loader.cjs');
const load = loader();
const { initiatePayment, processPaymentCallback } = load('src/lib/payment/service.ts');
const { parsePaymentRequest } = load('src/lib/payment/request.ts');
const { createLegalAcceptance } = load('src/lib/legal/acceptance.ts');
const { newGuestToken, hashGuestToken } = load('src/lib/payment/access.ts');
const { paymentAvailable, getPaymentProvider } = load('src/lib/payment/provider.ts');
const key = '11111111-1111-4111-8111-111111111111';
const request = { ...createLegalAcceptance(true), items: [{ productId: 'product', variantId: key, quantity: 2, measurements: {chest:92,waist:72,hips:98,height:168} }],
  customer: { firstName: 'Test', lastName: 'Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Beytepe', city: 'Ankara', district: 'Çankaya', postalCode: '06800' },
  idempotencyKey: key, quoteHash: 'a'.repeat(64), price: 1, total: 1, shipping: 0, userId: 'forged' };
function fixture() {
  const calls = [];
  const repository = {
    async findExisting() { return null },
    async quote() { calls.push('quote'); return { hash: request.quoteHash, summary: {} }; },
    async createAtomic(input, userId, guestHash) { calls.push({ input, userId, guestHash }); return { created: true, order: { id: key, amountMinor: 20000, state: 'initiating' } }; },
    async storeRedirect() { calls.push('store'); }, async getRedirect() { return { redirectUrl: 'https://bank.invalid/checkout' }; },
    async finalizeAtomic(payment) { calls.push(payment); },
  };
  const provider = { name: 'test-only', merchantId: 'test-merchant', allowedRedirectOrigins: ['https://bank.invalid'],
    async initiate(order) { calls.push(order.amountMinor); return { redirectUrl: 'https://bank.invalid/checkout' }; },
    async verifyCallback() { return { eventId: 'event', merchantId: 'test-merchant', merchantReference: key,
      transactionId: 'transaction', amountMinor: 20000, currency: 'TRY', status: 'paid', threeDS: 'authenticated' }; } };
  return { calls, repository, provider };
}

test('Server consent is enforced before any quote, order, or provider call', async () => {
  const { repository, provider, calls } = fixture();
  for (const contractAccepted of [undefined, false, 'true']) {
    await assert.rejects(initiatePayment({ ...request, contractAccepted }, null, 'hash', repository, provider), /kabul edin/);
  }
  assert.equal(calls.length, 0);
});
test('Payment payload excludes client prices, user ID, shipping and totals; trusted user is passed separately', async () => {
  const f = fixture();
  const result = await initiatePayment(request, 'server-user', null, f.repository, f.provider);
  assert.equal(result.orderId, key);
  assert.equal(f.calls[1].userId, 'server-user');
  assert.equal(f.calls[1].input.total, undefined);
  assert.equal(f.calls[1].input.shipping, undefined);
  assert.equal(f.calls[1].input.userId, undefined);
  assert.equal(f.calls[2], 20000);
});
test('Stale commercial quote cannot create an order', async () => {
  const f = fixture();
  await assert.rejects(initiatePayment({ ...request, quoteHash: 'b'.repeat(64) }, 'server-user', null, f.repository, f.provider), /yeniden inceleyip/);
  assert.deepEqual(f.calls, ['quote']);
});
test('Repeated initiation uses cached redirect and never calls provider again; ambiguous result is blocked', async () => {
  const f = fixture();
  f.repository.createAtomic = async () => ({ created: false, order: { id: key, state: 'pending' } });
  f.provider.initiate = () => { throw new Error('Duplicate provider request'); };
  assert.equal((await initiatePayment(request, 'server-user', null, f.repository, f.provider)).orderId, key);
  f.repository.getRedirect = async () => null;
  await assert.rejects(initiatePayment(request, 'server-user', null, f.repository, f.provider), /tekrar ödeme başlatılmadı/);
});
test('Untrusted redirect is rejected before saving', async () => {
  const f = fixture();
  f.provider.initiate = async () => ({ redirectUrl: 'https://attacker.invalid/pay' });
  await assert.rejects(initiatePayment(request, 'server-user', null, f.repository, f.provider), /yönlendirmesi/);
  assert.ok(!f.calls.includes('store'));
});
test('Unauthenticated callbacks never mutate order state', async () => {
  const f = fixture();
  f.provider.verifyCallback = async () => { throw new Error('Invalid signature'); };
  await assert.rejects(processPaymentCallback('forged', new Headers(), f.repository, f.provider));
  assert.equal(f.calls.length, 0);
});
test('Merchant, amount, currency and 3DS failures are rejected before persistence', async () => {
  for (const changes of [{ merchantId: 'other' }, { amountMinor: 0 }, { amountMinor: NaN }, { currency: 'USD' }, { threeDS: 'failed' }, { status: 'unknown' }]) {
    const f = fixture(); const verified = await f.provider.verifyCallback();
    f.provider.verifyCallback = async () => ({ ...verified, ...changes });
    await assert.rejects(processPaymentCallback('signed', new Headers(), f.repository, f.provider));
    assert.equal(f.calls.length, 0);
  }
});
test('Verified callback is handed to the atomic DB operation', async () => {
  const f = fixture();
  await processPaymentCallback('signed', new Headers(), f.repository, f.provider);
  assert.equal(f.calls[0].status, 'paid');
});
test('No registered real provider means activation fails closed, even with enabled flag', () => {
  const previous = process.env.PAYMENT_ENABLED;
  process.env.PAYMENT_ENABLED = 'true';
  try { assert.equal(paymentAvailable(), false); assert.throws(getPaymentProvider); }
  finally { if (previous === undefined) delete process.env.PAYMENT_ENABLED; else process.env.PAYMENT_ENABLED = previous; }
});
test('Guest capabilities are random 256-bit secrets; hashes cannot be order IDs', () => {
  const first = newGuestToken(), second = newGuestToken();
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, second); assert.notEqual(hashGuestToken(first), first);
  assert.throws(() => hashGuestToken(key));
});
test('Variant duplicates, invalid quantities and missing address cannot reach payment service', () => {
  for (const items of [[request.items[0], request.items[0]], [{ ...request.items[0], quantity: 0 }], [{ ...request.items[0], quantity: 1.5 }], [{ ...request.items[0], variantId: 'fake' }]]) {
    assert.throws(() => parsePaymentRequest({ ...request, items }));
  }
  assert.throws(() => parsePaymentRequest({ ...request, customer: { ...request.customer, address: '' } }));
});

test('Repository calculates prices, discount and stock from catalog rather than browser values', async () => {
  const previous = { ...process.env };
  Object.assign(process.env, { PAYMENT_DATABASE_VERIFIED: 'true', SUPABASE_SERVICE_ROLE_KEY: 'test-only', PAYMENT_SHIPPING_MINOR: '2500', PAYMENT_DELIVERY_TERMS: 'İşletmenin teyit ettiği süre' });
  let stock = 2;
  const db = { from(table) { return { select() { return this; }, async in() { return { data: table === 'products'
    ? [{ id: 'product', name: 'Elbise', description: 'Pamuk', price_amount: '99.90', compare_at_price: '120.00', currency: 'TRY', status: 'active', in_stock: false }]
    : [{ id: key, product_id: 'product', size: 'M', stock_quantity: stock, is_active: true }], error: null }; } }; } };
  const local = loader({ '@supabase/supabase-js': { createClient: () => db }, '@/lib/supabase/server': {}, 'next/headers': {} });
  try {
    const repository = local('src/lib/payment/repository.ts').createPaymentRepository();
    const quote = await repository.quote(request.items, request.customer);
    assert.equal(quote.summary.total, 199.8); assert.equal(quote.summary.discount, 40.2);
    assert.equal(quote.summary.shipping, 0); assert.equal(quote.summary.items[0].unitPrice, 99.9);
    assert.equal(local('src/lib/payment/repository.ts').quoteHash({ ...quote.summary, orderedAt: '2099-01-01' }), quote.hash);
    stock = 1; await assert.rejects(repository.quote(request.items, request.customer), /stokta yok/);
  } finally {
    for (const k of ['PAYMENT_DATABASE_VERIFIED','SUPABASE_SERVICE_ROLE_KEY','PAYMENT_SHIPPING_MINOR','PAYMENT_DELIVERY_TERMS']) {
      if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k];
    }
  }
});
test('Advertising consent starts denied, rejects malformed/expired consent and stores separate purpose', () => {
  let value = null; const previousStorage = global.localStorage, previousWindow = global.window;
  global.localStorage = { getItem: () => value, setItem: (_, text) => { value = text; } };
  global.window = { dispatchEvent() {} };
  try {
    const consent = load('src/lib/cookie-consent.ts');
    assert.equal(consent.readAdvertisingConsent(), null);
    consent.saveAdvertisingConsent(false); assert.equal(consent.readAdvertisingConsent(), false);
    consent.saveAdvertisingConsent(true); assert.equal(consent.readAdvertisingConsent(), true);
    value = JSON.stringify({ version: 1, advertising: true, savedAt: 0 }); assert.equal(consent.readAdvertisingConsent(), null);
    value = 'invalid'; assert.equal(consent.readAdvertisingConsent(), null);
  } finally { global.localStorage = previousStorage; global.window = previousWindow; }
});

test('Payment context crosses Next server/client boundary through a function component', () => {
  const flags = load('src/lib/feature-flags.ts');
  assert.equal(typeof flags.CardPaymentProvider, 'function');
  const React = require('react');
  const html = require('react-dom/server').renderToStaticMarkup(React.createElement(flags.CardPaymentProvider, { value: false }, React.createElement('p', null, 'safe')));
  assert.equal(html, '<p>safe</p>');
});

test('Guest initiation is blocked before any database/provider side effect', async () => {
 const f = fixture();
 await assert.rejects(initiatePayment(request, null, 'hash', f.repository, f.provider), /giriş yapın/);
});

test('Cached payment redirects also require HTTPS and provider origin allowlist',async()=>{
 for(const redirectUrl of ['http://bank.invalid/pay','https://attacker.invalid/pay','https://user:pass@bank.invalid/pay']) {
  const f=fixture(); f.repository.findExisting=async()=>({id:key,state:'pending'});
  f.repository.getRedirect=async()=>({redirectUrl});
  await assert.rejects(initiatePayment(request,'server-user',null,f.repository,f.provider),/yönlendirmesi/);
  assert.equal(f.calls.length,0);
 }
});

test('Admin paid-order UI only enables preparation for a server-verified payment',()=>{
 const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server');
 const local=loader({react:{...React,useState:initial=>[initial,()=>{}]},'next/navigation':{useRouter:()=>({refresh(){}})},'@/app/admin/(protected)/actions':{updateOrderStatus:async()=>({ok:true,message:'ok'})}});
 const Form=local('src/components/admin/OrderStatusForm.tsx').default;
 const legacy=renderToStaticMarkup(React.createElement(Form,{orderId:key,status:'paid'}));
 assert.doesNotMatch(legacy,/name="status"/); assert.doesNotMatch(legacy,/Ödeme doğrulandı/);
 const verified=renderToStaticMarkup(React.createElement(Form,{orderId:key,status:'paid',verifiedPayment:true}));
 assert.match(verified,/value="processing"/); assert.doesNotMatch(verified,/value="cancelled"/);
 const processing=renderToStaticMarkup(React.createElement(Form,{orderId:key,status:'processing',verifiedPayment:true}));
 assert.match(processing,/value="shipped"/); assert.doesNotMatch(processing,/value="cancelled"/);
});

test('Profile history links to server-authorized payment status without accepting client paid claims',()=>{
 const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server'); let slot=0;
 const local=loader({react:{...React,useEffect(){},useState:initial=>[slot++===0?[{id:key,created_at:'2026-10-09',status:'processing',total_amount:100}]:typeof initial==='boolean'?false:initial,()=>{}]},
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  '@/lib/supabase':{supabase:{}},'@/context/AuthContext':{useAuth:()=>({user:{id:'server-user'}})},
  '@/components/legal/OrderLegalDocuments':{__esModule:true,default:()=>null},'framer-motion':{m:{div:({children,...props})=>React.createElement('div',props,children)}}});
 const History=local('src/app/profile/components/OrderHistory.tsx').default;
 const html=renderToStaticMarkup(React.createElement(History));
 assert.match(html,new RegExp('/checkout/verify\\?orderId='+key));
 assert.match(html,/Ödeme durumu ve sipariş özeti/); assert.doesNotMatch(html,/status=paid/);
});
