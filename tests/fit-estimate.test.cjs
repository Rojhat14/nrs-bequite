const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loader } = require('./source-loader.cjs');

const fit = loader({})(path.resolve(__dirname, '..', 'src/lib/fit-estimate.ts'));
const letters = ['S', 'M', 'L', 'XL'];
const person = (heightCm, weightKg, shape = {}) => ({ heightCm, weightKg, chest: 0, waist: 0, hips: 0, ...shape });

test('an average shopper gets a middle size and more weight never gets a smaller one', () => {
  assert.equal(fit.recommendFit(person(165, 60), letters, 'dress').size, 'M');
  const order = letters;
  let last = 0;
  for (const weight of [50, 60, 70, 80]) {
    const index = order.indexOf(fit.recommendFit(person(165, weight), letters, 'dress').size);
    assert.ok(index >= last, `weight ${weight}`);
    last = index;
  }
});

test('a fuller answer can raise the size, and only the areas of the cut count', () => {
  const plain = letters.indexOf(fit.recommendFit(person(165, 60), letters, 'x-pantolon').size);
  const fuller = letters.indexOf(fit.recommendFit(person(165, 60, { hips: 1 }), letters, 'x-pantolon').size);
  assert.ok(fuller >= plain);
  assert.deepEqual(fit.fitRule('lace-bol-paca-pantolon').areas, ['waist', 'hips']);
  assert.deepEqual(fit.fitRule('noir-minimal-siyah-blazer-ceket').areas, ['chest', 'waist']);
  assert.deepEqual(fit.fitRule('noir-klapa-islemeli-ceket-takim').areas, ['chest', 'waist', 'hips']);
  assert.deepEqual(fit.fitRule('rosa-ekose-kemerli-yun-kasmir-kaban').areas, ['chest', 'hips']);
});

test('the suggestion uses the product\'s own size label, including numeric dresses', () => {
  assert.equal(fit.recommendFit(person(165, 60), ['36', '38', '40'], 'dress').size, '38');
  assert.equal(fit.recommendFit(person(165, 60), [], 'dress'), null);
});

test('sizes outside the chart are flagged rather than silently fitted', () => {
  const big = fit.recommendFit(person(160, 125), letters, 'dress');
  assert.equal(big.over, true);
  assert.equal(big.size, 'XL');
  assert.equal(fit.recommendFit(person(165, 60), letters, 'dress').under, false);
  assert.equal(fit.recommendFit(person(165, 40), ['XL'], 'dress').under, true);
});

test('lines describe the chosen size honestly', () => {
  const small = fit.fitLines(person(175, 80), 'S', 'dress');
  assert.ok(small.areas.every(line => line.level === 'tight'));
  assert.equal(fit.fitLines(person(165, 60), 'M', 'dress').areas.every(line => line.level === 'right'), true);
  assert.equal(fit.fitLines(person(150, 50), 'S', 'dress').length, 'short');
  assert.equal(fit.fitLines(person(182, 70), 'L', 'dress').length, 'tall');
  assert.equal(fit.fitLines(person(165, 60), 'M', 'noir-siyah-blazer-ceket').length, null);
});
