import { SIZE_CHART, matchingSize, sizeChartRow, type SizeChartRow } from '@/lib/size-chart'

/** Size suggestion from height, weight and three shape answers. This is only an
 * estimate of the body, so its figures must never be sent to the atelier as
 * measurements: exact measurements come from SizeGuideDialog. */
export type ShapeAnswer = -1 | 0 | 1
export type FitAnswers = { heightCm: number; weightKg: number; chest: ShapeAnswer; waist: ShapeAnswer; hips: ShapeAnswer }
export type FitArea = 'chest' | 'waist' | 'hips'
export type FitLevel = 'tight' | 'right' | 'relaxed' | 'loose'

/** Off until the estimate is checked against real customers from the atelier.
 * While off, shoppers use the size chart and exact-measurement dialog instead. */
export const FIT_FINDER_ENABLED = false

export const FIT_LIMITS = { height: [145, 195], weight: [40, 130] } as const
export const FIT_DEFAULTS: FitAnswers = { heightCm: 165, weightKg: 60, chest: 0, waist: 0, hips: 0 }

const SHAPE_CM: Record<string, number> = { '-1': -3, 0: 0, 1: 4 }

export function estimateBody(answers: FitAnswers): Record<FitArea, number> {
  const bmi = answers.weightKg / ((answers.heightCm / 100) ** 2)
  const tall = answers.heightCm - 165
  return {
    chest: 91 + (bmi - 22) * 2.4 + tall * 0.12 + SHAPE_CM[answers.chest],
    waist: 72.5 + (bmi - 22) * 2.7 + tall * 0.12 + SHAPE_CM[answers.waist],
    hips: 99.5 + (bmi - 22) * 2.2 + tall * 0.18 + SHAPE_CM[answers.hips],
  }
}

/** Which measurements decide the size for this cut. `give` is the slack in cm
 * before a piece counts as too small. Based on the product's URL name, because
 * category names are translated. */
export function fitRule(productKey: string): { areas: FitArea[]; give: number; length: boolean } {
  if (/pantolon|etek/.test(productKey)) return { areas: ['waist', 'hips'], give: 0, length: true }
  if (/kaban|panco|trench|kimono/.test(productKey)) return { areas: ['chest', 'hips'], give: 3, length: true }
  if (/ceket(?!-takim)|yelek|bluz|gomlek-ceket|t-shirt/.test(productKey) && !/takim/.test(productKey)) return { areas: ['chest', 'waist'], give: 0, length: false }
  return { areas: ['chest', 'waist', 'hips'], give: 0, length: true }
}

export function recommendFit(answers: FitAnswers, available: string[], productKey: string) {
  const rows = SIZE_CHART.filter(row => available.some(size => sizeChartRow(size) === row))
  if (!rows.length) return null
  const body = estimateBody(answers)
  const { areas, give } = fitRule(productKey)
  const fits = rows.find(row => areas.every(area => body[area] <= row[area][1] + give))
  const row: SizeChartRow = fits ?? rows[rows.length - 1]
  return {
    row,
    size: matchingSize(row, available)!,
    over: !fits,
    under: areas.every(area => body[area] < rows[0][area][0] - 4),
  }
}

/** How the chosen size sits at each area, and whether length needs a word. */
export function fitLines(answers: FitAnswers, size: string, productKey: string) {
  const row = sizeChartRow(size)
  if (!row) return { areas: [] as Array<{ area: FitArea; level: FitLevel }>, length: null }
  const body = estimateBody(answers)
  const rule = fitRule(productKey)
  const areas = rule.areas.map(area => {
    const spare = row[area][1] + rule.give - body[area]
    const level: FitLevel = spare < 0 ? 'tight' : spare <= 5 ? 'right' : spare <= 10 ? 'relaxed' : 'loose'
    return { area, level }
  })
  const length = !rule.length ? null : answers.heightCm < 158 ? 'short' as const : answers.heightCm > 178 ? 'tall' as const : 'fine' as const
  return { areas, length }
}
