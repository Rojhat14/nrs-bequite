/** Several looks are sold both as a complete set and as separate pieces, and
 * every product in a look shares the same photographs. Without this map a
 * shopper on the trousers page sees the whole suit at the trousers price and
 * cannot tell what she is buying. IDs are catalogue product IDs. */
export type LookPartKind = 'set' | 'jacket' | 'trousers' | 'skirt' | 'top' | 'vest'

export const LOOK_FAMILIES: Array<Record<string, LookPartKind>> = [
  { 'sky-asimetrik-dantel-detayli-ikili-takim': 'set', 'sky-asimetrik-dantel-detayli-ikili-takim-kopya-kopya': 'top', 'sky-asimetrik-dantel-detayli-ikili-takim-kopya': 'trousers' },
  { 'jade-peplum-kesim-petrol-yesili-ikili-takim': 'set', 'jade-peplum-kesim-petrol-yesili-ikili-takim-kopya': 'jacket', 'jade-peplum-kesim-petrol-yesili-ikili-takim-kopya-kopya': 'trousers' },
  { 'noir-klapa-islemeli-ceket-takim': 'set', 'noir-klapa-islemeli-ceket-takim-kopya': 'jacket', 'noir-klapa-islemeli-ceket-takim-kopya-kopya': 'trousers' },
  { 'scarlet-sal-astar-kirmizi-blazer-ceket': 'set', 'scarlet-sal-astar-kirmizi-blazer-ceket-kopya': 'jacket', 'scarlet-sal-astar-kirmizi-blazer-ceket-kopya-kopya': 'trousers' },
  { 'sovereign-saks-mavi-blazer-ceket': 'set', 'sovereign-saks-mavi-blazer-ceket-kopya': 'jacket', 'sovereign-saks-mavi-blazer-ceket-kopya-kopya': 'trousers' },
  { 'ivory-sculpted-asimetrik-yelek-takim': 'set', 'ivory-sculpted-asimetrik-yelek-takim-kopya': 'vest', 'ivory-sculpted-asimetrik-yelek-takim-kopya-kopya': 'trousers' },
  { 'elysian-ekose-tuvit-blazer-takim': 'set', 'elysian-ekose-tuvit-blazer-ceket': 'jacket', 'elysian-ekose-tuvit-blazer-etek': 'skirt' },
  { 'marquise-asimetrik-katli-bordo-bol-paca-pantolon-kopya': 'set', 'marquise-isilti-islemeli-bordo-ceket': 'jacket', 'marquise-asimetrik-katli-bordo-bol-paca-pantolon': 'trousers' },
]

export function lookFamilyOf(productId: string) {
  const family = LOOK_FAMILIES.find(entry => Object.hasOwn(entry, productId))
  if (!family) return null
  return { kind: family[productId], members: Object.entries(family).map(([id, kind]) => ({ id, kind })) }
}

export const LOOK_PART_LABELS: Record<LookPartKind, { tr: string; en: string; ar: string }> = {
  set: { tr: 'Takımın tamamı', en: 'Complete set', ar: 'الطقم كاملاً' },
  jacket: { tr: 'Ceket', en: 'Jacket', ar: 'سترة' },
  trousers: { tr: 'Pantolon', en: 'Trousers', ar: 'بنطال' },
  skirt: { tr: 'Etek', en: 'Skirt', ar: 'تنورة' },
  top: { tr: 'Bluz', en: 'Top', ar: 'بلوزة' },
  vest: { tr: 'Yelek', en: 'Vest', ar: 'صدرية' },
}
