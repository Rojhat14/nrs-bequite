const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('./source-loader.cjs')

const load = loader()
const { measurementKind } = load('src/lib/order-measurements.ts')
const { formatLocalizedMeasurements, measurementHelp, measurementLabel } = load('src/lib/i18n/measurements.ts')

test('translated catalogue categories keep their existing measurement requirements', () => {
  for (const [category, kind] of [
    ['Dresses', 'dress'], ['Trousers', 'trousers'], ['Skirts', 'skirt'], ['Tops', 'top'],
    ['Sets', 'suit'], ['Bedding and home', 'accessory'], ['فساتين', 'dress'], ['بنطال', 'trousers'],
    ['تنورة', 'skirt'], ['بلوزات', 'top'], ['أطقم', 'suit'], ['مفروشات', 'accessory'],
  ]) assert.equal(measurementKind(category), kind, category)
})

test('measurement labels, guidance, and saved values follow the selected locale', () => {
  assert.equal(measurementLabel('en', 'chest'), 'Chest circumference')
  assert.equal(measurementLabel('ar', 'waist'), 'محيط الخصر')
  assert.match(measurementHelp('en', 'height'), /barefoot/)
  assert.match(measurementHelp('ar', 'height'), /من دون حذاء/)
  const values = { waist: 72.5, hips: 96 }
  assert.match(formatLocalizedMeasurements(values, 'en'), /Waist circumference: 72\.5 cm/)
  assert.match(formatLocalizedMeasurements(values, 'ar'), /محيط الخصر: ٧٢٫٥ سم/)
})
