const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const loadSource = file => require('./source-loader.cjs').loader()(file);
const { buildWhatsappOrderMessage, whatsappSelectionError } = loadSource('src/lib/whatsapp-order.ts');

test('Product links use public slugs and old carts fall back to supported product IDs', () => {
  const message = buildWhatsappOrderMessage([
    { id: 'id-1', slug: 'ipek-şal', name: 'Şal', unitPrice: 50, quantity: 1 },
    { id: 'old-id', name: 'Eski sepet ürünü', unitPrice: 100, quantity: 1 },
  ]);
  assert.ok(message.includes('Ürün Linki: https://nrsbequiteluminous.com/product/ipek-%C5%9Fal'));
  assert.ok(message.includes('Ürün Linki: https://nrsbequiteluminous.com/product/old-id'));
});

test('Required sizes block WhatsApp requests, sizeless products work, and stock is respected', () => {
  assert.equal(whatsappSelectionError({ requiresSize: true, selected: false, quantity: 1 }), 'Lütfen beden seçiniz.');
  assert.equal(whatsappSelectionError({ requiresSize: false, selected: false, quantity: 1 }), null);
  assert.equal(whatsappSelectionError({ requiresSize: true, selected: true, stock: 2, quantity: 2 }), null);
  assert.match(whatsappSelectionError({ requiresSize: true, selected: true, stock: 0, quantity: 1 }), /stok/);
  assert.match(whatsappSelectionError({ requiresSize: true, selected: true, stock: 2, quantity: 3 }), /stok/);
  assert.match(whatsappSelectionError({ requiresSize: false, selected: false, quantity: NaN }), /adet/);
});

test('All cart variants, decimal prices, quantities and provided totals are preserved', () => {
  const message = buildWhatsappOrderMessage([
    { id: 'p1', name: 'İpek & Şık', size: 'M', unitPrice: 99.9, quantity: 3 },
    { id: 'p1', name: 'İpek & Şık', size: 'L', unitPrice: 99.9, quantity: 1 },
  ], 399.6);
  assert.match(message, /Beden: M/); assert.match(message, /Beden: L/);
  assert.match(message, /Adet: 3/); assert.match(message, /Ara toplam: 299,7 TL/);
  assert.match(message, /Toplam: 399,6 TL/);
  assert.match(message, /Ödeme yöntemi: Havale \/ EFT/);
  assert.doesNotMatch(message, /başarıyla|ödendi|Sipariş numarası/i);
  assert.equal(buildWhatsappOrderMessage([]), null);
  assert.doesNotMatch(buildWhatsappOrderMessage([{ id: 'one', name: 'Şal', quantity: 1, unitPrice: 50 }]), /Beden:/);
});

test('Contact defaults, number normalization and Turkish message encoding round-trip safely', () => {
  const keys = ['NEXT_PUBLIC_CONTACT_EMAIL', 'NEXT_PUBLIC_WHATSAPP_NUMBER', 'NEXT_PUBLIC_BANK_NAME', 'NEXT_PUBLIC_BANK_ACCOUNT_NAME', 'NEXT_PUBLIC_IBAN'];
  const saved = keys.map(key => process.env[key]);
  try {
    for (const key of keys) delete process.env[key];
    const config = loadSource('src/lib/storefront-config.ts');
    assert.equal(config.whatsappNumber, '905454227919');
    assert.equal(config.contactPhoneLabel, '+90 545 422 79 19');
    assert.equal(config.contactEmail, 'rojhat1maman@gmail.com');
    assert.equal(config.whatsappUrl(), 'https://wa.me/905454227919');
    assert.equal(config.normalizeWhatsappNumber('+90 (545) 422 79 19'), '905454227919');
    assert.equal(config.normalizeWhatsappNumber('0090 545 422 79 19'), '905454227919');
    assert.equal(config.normalizeWhatsappNumber('123'), null);
    assert.equal(config.bankTransfer.iban, '');
    const message = buildWhatsappOrderMessage([{ id: 'test', name: 'İpek & Şık #1', size: 'M', quantity: 1, unitPrice: 4500 }], undefined,
      { firstName: 'Çağla', lastName: 'Şen', email: 'test@example.com' });
    const url = new URL(config.whatsappUrl(message));
    assert.equal(url.pathname, '/905454227919');
    assert.equal(url.searchParams.get('text'), message);
    assert.match(message, /Ad Soyad: Çağla Şen/); assert.doesNotMatch(message, /Telefon:/);
    process.env.NEXT_PUBLIC_IBAN = ' supplied-account-value ';
    assert.equal(loadSource('src/lib/storefront-config.ts').bankTransfer.iban, 'supplied-account-value');
  } finally {
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
  }
});
