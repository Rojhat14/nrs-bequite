const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./source-loader.cjs');
const { readPaymentConfig, requirePaymentMode } = loader()('src/lib/payment/config.ts');

test('Payment requires an explicit sandbox/live mode; a missing or guessed mode cannot activate it', () => {
  for (const value of [undefined, '', 'test', 'production', 'LIVE']) {
    const env = { PAYMENT_MODE: value };
    assert.equal(readPaymentConfig(env).mode, null);
    assert.throws(() => requirePaymentMode(env), /explicitly configured/);
  }
  assert.equal(readPaymentConfig({}).enabled, false);
});

test('Sandbox is rejected in Vercel Production and accepted in Preview/local tests', () => {
  assert.throws(() => requirePaymentMode({ PAYMENT_MODE: 'sandbox', VERCEL_ENV: 'production' }), /cannot run in Production/);
  assert.equal(requirePaymentMode({ PAYMENT_MODE: 'sandbox', VERCEL_ENV: 'preview' }), 'sandbox');
  assert.equal(requirePaymentMode({ PAYMENT_MODE: 'sandbox' }), 'sandbox');
  assert.equal(requirePaymentMode({ PAYMENT_MODE: 'live', VERCEL_ENV: 'production' }), 'live');
});

test('Mode and enabled flags alone cannot activate payment without a registered real provider', () => {
  const names = ['PAYMENT_ENABLED', 'PAYMENT_MODE', 'PAYMENT_PROVIDER', 'VERCEL_ENV'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const mode of ['sandbox', 'live']) {
      Object.assign(process.env, { PAYMENT_ENABLED: 'true', PAYMENT_MODE: mode, PAYMENT_PROVIDER: 'unregistered', VERCEL_ENV: 'preview' });
      const provider = loader()('src/lib/payment/provider.ts');
      assert.equal(provider.paymentAvailable(), false);
      assert.throws(provider.getPaymentProvider, /unavailable/);
    }
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
