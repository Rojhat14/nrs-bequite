export const MEASUREMENT_LABELS = {
  chest: 'Göğüs çevresi', waist: 'Bel çevresi', hips: 'Basen çevresi', height: 'Boy', shoulder: 'Omuz genişliği', sleeve: 'Kol boyu', length: 'İstenen ürün boyu', inseam: 'İç bacak boyu',
} as const
export type Measurements = Partial<Record<keyof typeof MEASUREMENT_LABELS, number>>
export type MeasurementKind = 'dress' | 'trousers' | 'skirt' | 'top' | 'suit' | 'accessory'
export const MEASUREMENT_HELP = {
  chest: 'Mezurayı göğsün en dolgun noktasından yatay geçirin.', waist: 'Doğal bel hattını sıkmadan çevreleyin.', hips: 'Kalçanın en geniş yerini yatay ölçün.', height: 'Ayakkabısız, başın tepesinden yere kadar ölçün.', shoulder: 'Sırtta iki omuz ucu arasını ölçün.', sleeve: 'Omuz ucundan hafif bükülü kol üzerinden bileğe ölçün.', length: 'Elbise/üstte omuzdan, alt giyimde belden istediğiniz bitiş noktasına ölçün.', inseam: 'Bacak içinden ağ noktasından istediğiniz paça bitişine ölçün.',
} as const
export const MEASUREMENT_RANGES = { chest: [50,180], waist: [40,180], hips: [50,200], height: [120,220], shoulder: [20,70], sleeve: [10,100], length: [20,200], inseam: [30,120] } as const
export function measurementKind(category: string): MeasurementKind {
  const type = category.toLocaleLowerCase('tr-TR')
  if (/şal|eşarp|aksesuar/.test(type)) return 'accessory'
  if (/takım|takim/.test(type)) return 'suit'
  if (/elbise/.test(type)) return 'dress'
  if (/pantolon/.test(type)) return 'trousers'
  if (/etek/.test(type)) return 'skirt'
  if (/ceket|blazer|bluz|üst|ust|gömlek|gomlek|dış|dis-giyim/.test(type)) return 'top'
  return 'dress'
}
export function requiredMeasurements(kind: MeasurementKind): (keyof Measurements)[] {
  switch(kind) {
    case 'accessory': return []
    case 'trousers': return ['waist','hips','inseam','length']
    case 'skirt': return ['waist','hips','length']
    case 'top': return ['chest','waist','shoulder','sleeve','length']
    case 'suit': return ['chest','waist','hips','height','shoulder','sleeve','length','inseam']
    default: return ['chest','waist','hips','height']
  }
}
export function measurementFields(category: string): (keyof Measurements)[] {
  const kind = measurementKind(category)
  return kind === 'dress' ? [...requiredMeasurements(kind),'shoulder','sleeve','length'] : requiredMeasurements(kind)
}
export function parseMeasurements(value: unknown): Measurements {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ölçüler geçersiz.')
  const result: Measurements = {}
  for (const [key, size] of Object.entries(value)) {
    if (!Object.hasOwn(MEASUREMENT_LABELS, key) || typeof size !== 'number' || !Number.isFinite(size)) throw new Error('Ölçüler geçersiz.')
    const field = key as keyof Measurements
    const [min,max] = MEASUREMENT_RANGES[field]
    if (size < min || size > max) throw new Error(`${MEASUREMENT_LABELS[field]} ${min}–${max} cm arasında olmalıdır.`)
    result[field] = size
  }
  return result
}
export function validateRequiredMeasurements(value: unknown, kind: MeasurementKind): Measurements {
  const result = parseMeasurements(value)
  for (const field of requiredMeasurements(kind)) if (result[field] === undefined) throw new Error(`${MEASUREMENT_LABELS[field]} zorunludur.`)
  return result
}
export function formatMeasurements(value: Measurements) {
  return Object.entries(value).map(([key, cm]) => `${MEASUREMENT_LABELS[key as keyof Measurements]}: ${cm} cm`).join(' · ')
}
