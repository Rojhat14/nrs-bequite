/** Hand-kept runway looks. Each piece points at a real catalogue product by ID;
 * price, sizes and availability always come from the database. `x`/`y` place
 * the numbered dot on the cut-out photo, in percent. Images live in
 * public/images/catwalk and are the owner's product photos with the background
 * removed. */
export type CatwalkLookConfig = {
  id: string
  name: string
  image: string
  width: number
  height: number
  pieces: Array<{ id: string; x: number; y: number }>
}

export const CATWALK_LOOKS: CatwalkLookConfig[] = [
  { id: 'scarlet', name: 'Scarlet', image: '/images/catwalk/scarlet.webp', width: 512, height: 1056, pieces: [{ id: 'scarlet-sal-astar-kirmizi-blazer-ceket', x: 50, y: 42 }] },
  { id: 'rouge', name: 'Rouge Accent', image: '/images/catwalk/rouge.webp', width: 348, height: 1007, pieces: [{ id: 'rouge-accent-asimetrik-kirmizi-dugmeli-siyah-ceket', x: 52, y: 34 }] },
  { id: 'verona', name: 'Verona', image: '/images/catwalk/verona.webp', width: 461, height: 786, pieces: [{ id: 'verona-dugme-detayli-cizgili-triko-panco', x: 50, y: 38 }] },
  { id: 'sovereign', name: 'Sovereign', image: '/images/catwalk/sovereign.webp', width: 377, height: 1100, pieces: [{ id: 'sovereign-saks-mavi-blazer-ceket', x: 52, y: 36 }] },
  { id: 'noir', name: 'Noir', image: '/images/catwalk/noir.webp', width: 446, height: 884, pieces: [
    { id: 'noir-minimal-sal-yaka-siyah-blazer-ceket', x: 36, y: 30 },
    { id: 'lace-grace-beli-firfirli-baglamali-siyah-bol-paca-pantolon', x: 54, y: 62 },
  ] },
  { id: 'rosa', name: 'Rosa', image: '/images/catwalk/rosa.webp', width: 430, height: 1100, pieces: [{ id: 'rosa-ekose-kemerli-yun-kasmir-kaban', x: 50, y: 40 }] },
  { id: 'aura', name: 'Aura', image: '/images/catwalk/aura.webp', width: 467, height: 1100, pieces: [{ id: 'aura-gold-detayli-asimetrik-beyaz-tulum', x: 50, y: 30 }] },
  { id: 'scarlet-bordo', name: 'Scarlet Bordo', image: '/images/catwalk/scarlet-bordo.webp', width: 549, height: 1100, pieces: [{ id: 'scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise', x: 50, y: 58 }] },
  { id: 'jade', name: 'Jade', image: '/images/catwalk/jade.webp', width: 331, height: 793, pieces: [{ id: 'jade-peplum-kesim-petrol-yesili-ikili-takim', x: 50, y: 34 }] },
]
