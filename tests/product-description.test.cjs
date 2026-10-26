const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loader } = require('./source-loader.cjs');
const { parseProductDescription } = loader()(path.resolve(__dirname, '..', 'src/lib/product-description.ts'));

test('inline feature bullets become a titled list without losing the prose', () => {
  const parsed = parseProductDescription('Gece mavisi saten. Davetler için ideal. Öne Çıkan Özellikler: • Kesim: Kayık yaka • Detay: Drape • Saf metin maddesi');
  assert.deepEqual(parsed.paragraphs, ['Gece mavisi saten. Davetler için ideal.']);
  assert.equal(parsed.heading, 'Öne Çıkan Özellikler');
  assert.deepEqual(parsed.bullets, [{ label: 'Kesim', text: 'Kayık yaka' }, { label: 'Detay', text: 'Drape' }, { text: 'Saf metin maddesi' }]);
});

test('plain and multi-paragraph descriptions stay as paragraphs', () => {
  assert.deepEqual(parseProductDescription('Tek satır.'), { paragraphs: ['Tek satır.'], heading: undefined, bullets: [] });
  assert.deepEqual(parseProductDescription('Bir.\n\nİki\nsatır.').paragraphs, ['Bir.', 'İki satır.']);
  assert.deepEqual(parseProductDescription('').paragraphs, []);
});
