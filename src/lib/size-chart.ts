/** NRS body-measurement size chart. Every piece is made to order, so these are
 * the body measurements the atelier cuts each size for, not garment flat
 * measurements. Letter sizes map one-to-one onto the numeric sizes so customers
 * see a single system (S = 36, M = 38, L = 40, XL = 42). */
export type SizeChartRow = {
  numeric: string
  letter: string
  chest: [number, number]
  waist: [number, number]
  hips: [number, number]
}

export const SIZE_CHART: SizeChartRow[] = [
  { numeric: '32', letter: 'XXS', chest: [78, 81], waist: [60, 62], hips: [86, 89] },
  { numeric: '34', letter: 'XS', chest: [82, 85], waist: [63, 66], hips: [90, 93] },
  { numeric: '36', letter: 'S', chest: [86, 89], waist: [67, 70], hips: [94, 97] },
  { numeric: '38', letter: 'M', chest: [90, 93], waist: [71, 74], hips: [98, 101] },
  { numeric: '40', letter: 'L', chest: [94, 97], waist: [75, 78], hips: [102, 105] },
  { numeric: '42', letter: 'XL', chest: [98, 101], waist: [79, 82], hips: [106, 109] },
  { numeric: '44', letter: 'XXL', chest: [102, 105], waist: [83, 86], hips: [110, 113] },
]

/** Older catalogue rows were typed by hand ("Xl", "X"); show them uniformly. */
export function normalizeSizeLabel(size: string) {
  const upper = size.trim().toLocaleUpperCase('en-US')
  return upper === 'X' ? 'XL' : upper
}

export function sizeChartRow(size: string | undefined | null) {
  if (!size) return undefined
  const label = normalizeSizeLabel(size)
  return SIZE_CHART.find(row => row.numeric === label || row.letter === label)
}

/** "S" -> "S · 36", "36" -> "36 · S"; unknown labels pass through. */
export function sizeButtonLabel(size: string) {
  const label = normalizeSizeLabel(size)
  const row = sizeChartRow(label)
  if (!row) return label
  return row.numeric === label ? `${row.numeric} · ${row.letter}` : `${row.letter} · ${row.numeric}`
}

export type BodyMeasurements = { chest?: number; waist?: number; hips?: number }

/** Smallest chart row whose upper bound covers every given measurement: a
 * garment cut for the largest of the three fits the other two. Returns
 * `between` when a measurement falls in the gap above one row's upper bound. */
export function recommendSize(body: BodyMeasurements, available: string[]) {
  const fields = (['chest', 'waist', 'hips'] as const).filter(field => typeof body[field] === 'number' && body[field]! > 0)
  if (!fields.length) return null
  const rows = SIZE_CHART.filter(row => available.some(size => sizeChartRow(size) === row))
  if (!rows.length) return null
  const fits = rows.find(row => fields.every(field => body[field]! <= row[field][1]))
  if (!fits) return { row: rows[rows.length - 1], fitsChart: false, between: false }
  const between = fields.some(field => body[field]! > fits[field][1] - 1 && rows.indexOf(fits) < rows.length - 1)
  return { row: fits, fitsChart: true, between }
}

/** The product's own size option that corresponds to a chart row. */
export function matchingSize(row: SizeChartRow, available: string[]) {
  return available.find(size => sizeChartRow(size) === row)
}
