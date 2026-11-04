const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./source-loader.cjs');

const { coatStartingPrice } = loader({})(path.resolve(__dirname, '..', 'src/lib/coat-offer.ts'));
const coat = (slug, priceAmount, inStock = true) => ({ id: slug, slug, priceAmount, inStock });

test('the announced coat price is the lowest buyable coat price from the catalogue', () => {
  assert.equal(coatStartingPrice([
    coat('rosa-ekose-kemerli-yun-kasmir-kaban', 19592),
    coat('azure-ekose-kruvaze-yun-kasmir-kaban', 19992),
    coat('some-cheaper-dress', 3000),
  ]), 19592);
});

test('coats that cannot be bought do not set the price, and no coats means no announcement', () => {
  assert.equal(coatStartingPrice([
    coat('rosa-ekose-kemerli-yun-kasmir-kaban', 19592, false),
    coat('azure-ekose-kruvaze-yun-kasmir-kaban', 19992),
  ]), 19992);
  assert.equal(coatStartingPrice([coat('saffron-tuvit-kruvaze-yun-kasmir-kaban', null)]), null);
  assert.equal(coatStartingPrice([]), null);
});

test('the homepage announces a price without claiming a discount', () => {
  const home = fs.readFileSync(path.join(__dirname, '../src/components/HomeLanding.tsx'), 'utf8');
  assert.match(home, /coatFrom/);
  assert.doesNotMatch(home, /indirim|line-through|% ?20|20 ?%|discount/i);
});
