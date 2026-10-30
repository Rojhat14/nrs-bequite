const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loader } = require('./source-loader.cjs');

const chart = loader({})(path.resolve(__dirname, '..', 'src/lib/size-chart.ts'));
const looks = loader({})(path.resolve(__dirname, '..', 'src/lib/look-families.ts'));

test('letter and number sizes share one chart and hand-typed labels are normalised', () => {
  assert.equal(chart.sizeButtonLabel('S'), 'S · 36');
  assert.equal(chart.sizeButtonLabel('38'), '38 · M');
  assert.equal(chart.sizeButtonLabel('Xl'), 'XL · 42');
  assert.equal(chart.normalizeSizeLabel('X'), 'XL');
  assert.equal(chart.sizeButtonLabel('Standart'), 'STANDART');
});

test('size finder picks the smallest size that covers every measurement', () => {
  const letters = ['S', 'M', 'L', 'XL'];
  assert.equal(chart.recommendSize({ chest: 88, waist: 69, hips: 96 }, letters).row.letter, 'S');
  // Hips decide when they need the larger size.
  const hips = chart.recommendSize({ chest: 88, waist: 69, hips: 103 }, letters);
  assert.equal(hips.row.letter, 'L');
  assert.equal(chart.matchingSize(hips.row, letters), 'L');
  // Dresses use numbers; the same body maps to 40.
  assert.equal(chart.matchingSize(hips.row, ['32', '34', '36', '38', '40', '42', '44']), '40');
  // Top of a range is flagged so the shopper adds measurements.
  assert.equal(chart.recommendSize({ chest: 93 }, letters).between, true);
  // Above the largest offered size: offer the largest and ask for measurements.
  const large = chart.recommendSize({ hips: 120 }, letters);
  assert.equal(large.row.letter, 'XL');
  assert.equal(large.fitsChart, false);
  assert.equal(chart.recommendSize({}, letters), null);
});

test('every look family has exactly one complete set and distinct products', () => {
  const ids = new Set();
  for (const family of looks.LOOK_FAMILIES) {
    assert.equal(Object.values(family).filter(kind => kind === 'set').length, 1);
    for (const id of Object.keys(family)) { assert.ok(!ids.has(id), id); ids.add(id); }
  }
  assert.equal(looks.lookFamilyOf('marquise-asimetrik-katli-bordo-bol-paca-pantolon').kind, 'trousers');
  assert.equal(looks.lookFamilyOf('aura-gold-detayli-asimetrik-beyaz-tulum'), null);
});
