'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Pause, Play, Plus, Ruler, X } from 'lucide-react'
import SizeGuideDialog from '@/components/SizeGuideDialog'
import { useLocale } from '@/context/LocaleContext'
import type { Product } from '@/data/products'
import type { CatwalkLookConfig } from '@/lib/catwalk-looks'
import { isNumericDressProduct, numericDressVariantOptions, sortActualVariantOptions } from '@/lib/dress-sizes'
import { localePrefix } from '@/lib/i18n/messages'
import { canOptimizeImage } from '@/lib/imageOptimization'
import { trackAddToCart } from '@/lib/meta-events'
import { normalizeSizeLabel, sizeButtonLabel, sizeChartRow, type BodyMeasurements } from '@/lib/size-chart'
import { useCart } from '@/store/useCart'
import styles from './Catwalk.module.css'

export type CatwalkLook = Omit<CatwalkLookConfig, 'pieces'> & {
  pieces: Array<{ product: Product; x: number; y: number }>
}

type Slot = { x: number; y?: number; s: number; b: number; o: number; z?: number }

const AUTOPLAY_MS = 6000
const WRAP_MS = 760
const pad = (value: number) => String(value).padStart(2, '0')

const DESKTOP_SLOTS: Slot[] = [
  { x: 0.62, s: 1, b: 0, o: 1 }, { x: 0.44, s: 0.76, b: 1, o: 1 }, { x: 0.335, s: 0.66, b: 2, o: 1 },
  { x: 0.25, s: 0.58, b: 3, o: 1 }, { x: 0.18, s: 0.52, b: 3.8, o: 1 }, { x: 0.12, s: 0.47, b: 4.6, o: 1 },
  { x: 0.07, s: 0.43, b: 5.4, o: 0.95 }, { x: 0.03, s: 0.39, b: 6, o: 0.85 }, { x: 0, s: 0.36, b: 6.5, o: 0.6 },
]
const MOBILE_SLOTS: Slot[] = [
  { x: 0.5, s: 1, b: 0, o: 1 }, { x: 0.12, s: 0.78, b: 2.5, o: 1 }, { x: 0.88, s: 0.78, b: 2.5, o: 1 },
  { x: 0.3, s: 0.64, b: 4, o: 1 }, { x: 0.7, s: 0.64, b: 4, o: 1 }, { x: 0.02, s: 0.54, b: 5, o: 0.8 },
  { x: 0.98, s: 0.54, b: 5, o: 0.8 }, { x: 0.5, s: 0.5, b: 6, o: 0.7 }, { x: 0.5, s: 0.46, b: 7, o: 0 },
]

/** The same size options the product page offers. */
function sizeOptions(product: Product) {
  const sized = (product.variants ?? []).filter(variant => variant.size)
  const actual = (sized.length ? sized : product.variants ?? []).map(variant => ({
    id: variant.id,
    label: variant.size ? normalizeSizeLabel(variant.size) : 'Tek beden',
    size: variant.size ?? undefined,
    stock: variant.stock_quantity,
  }))
  return sortActualVariantOptions(isNumericDressProduct(product) ? numericDressVariantOptions(actual) ?? actual : actual)
}

export default function Catwalk({ looks }: { looks: CatwalkLook[] }) {
  const { locale, priceTag } = useLocale()
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const prefix = localePrefix(locale)
  const addItem = useCart(state => state.addItem)
  const openDrawer = useCart(state => state.openDrawer)
  const bagItems = useCart(state => state.items)

  const [active, setActive] = useState(0)
  const [shop, setShop] = useState(false)
  const [openPiece, setOpenPiece] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [bodies, setBodies] = useState<Record<string, BodyMeasurements | null>>({})
  const [guideFor, setGuideFor] = useState<Product | null>(null)
  const [message, setMessage] = useState('')
  const [playing, setPlaying] = useState(true)
  const [visible, setVisible] = useState(false)
  const [walking, setWalking] = useState(false)

  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const modelRefs = useRef<Array<HTMLDivElement | null>>([])
  const activeRef = useRef(0)
  const shopRef = useRef(false)
  const wrapTimer = useRef(0)
  const walkTimer = useRef(0)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const lastFocus = useRef<HTMLElement | null>(null)

  const count = looks.length
  const look = looks[active]

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isMobile = () => window.matchMedia('(max-width: 820px)').matches
  const slots = () => isMobile() ? MOBILE_SLOTS : DESKTOP_SLOTS
  const slotOf = useCallback((index: number) => (index - activeRef.current + count) % count, [count])

  function place(element: HTMLElement, slot: Slot) {
    const width = stageRef.current?.clientWidth ?? 0
    element.style.transform = `translate3d(${Math.round(slot.x * width)}px, ${slot.y ?? 0}px, 0) scale(${slot.s})`
    element.style.filter = slot.b ? `blur(${slot.b}px)` : 'none'
    element.style.opacity = String(slot.o)
    element.style.zIndex = String(slot.z ?? 1)
    element.style.setProperty('--s', String(slot.s))
  }
  const queueSlot = (table: Slot[], slot: number): Slot => ({ ...(table[slot] ?? table[table.length - 1]), z: 20 - slot })
  const exitSlot = (): Slot => ({ x: isMobile() ? 1.5 : 1.14, s: 1.05, b: 0, o: 0, z: 25 })

  function shopSlot(element: HTMLElement): Slot {
    const stage = stageRef.current
    const panel = panelRef.current
    if (!stage || !panel) return { x: 0.5, s: 1, b: 0, o: 1, z: 30 }
    const height = stage.clientHeight
    const modelHeight = element.offsetHeight
    const gap = height - (element.offsetTop + modelHeight)
    if (isMobile()) {
      const sheet = panel.offsetHeight
      return { x: 0.5, y: -(sheet + 12 - gap), s: Math.min((height - sheet - 24) / modelHeight, 1), b: 0, o: 1, z: 30 }
    }
    const width = stage.clientWidth
    return { x: (width - panel.offsetWidth) / 2 / width, y: gap - 44, s: Math.min((height - 72) / modelHeight, 1.2), b: 0, o: 1, z: 30 }
  }

  const layout = useCallback(() => {
    window.clearTimeout(wrapTimer.current)
    // The shared header variable can lag behind the header's final size.
    const header = document.querySelector('header')
    if (header) rootRef.current?.style.setProperty('--cw-header', `${header.offsetHeight}px`)
    const table = slots()
    modelRefs.current.forEach((element, index) => {
      if (!element) return
      element.style.marginLeft = `${-element.offsetWidth / 2}px`
      const slot = slotOf(index)
      if (shopRef.current) place(element, slot === 0 ? shopSlot(element) : { ...queueSlot(table, slot), o: 0, z: 1 })
      else place(element, queueSlot(table, slot))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotOf])

  function withoutTransition(element: HTMLElement, change: () => void) {
    element.style.transition = 'none'
    change()
    void element.offsetWidth
    element.style.transition = ''
  }

  function go(delta: number) {
    if (!delta || count < 2) return
    window.clearTimeout(wrapTimer.current)
    const table = slots()
    const before = modelRefs.current.map((_, index) => slotOf(index))
    activeRef.current = (activeRef.current + delta + count) % count
    setActive(activeRef.current)
    setMessage('')
    if (!reducedMotion()) {
      setWalking(true)
      window.clearTimeout(walkTimer.current)
      walkTimer.current = window.setTimeout(() => setWalking(false), 1050)
    }
    const wrapping: Array<[HTMLElement, number]> = []
    modelRefs.current.forEach((element, index) => {
      if (!element) return
      const slot = slotOf(index)
      if (delta > 0 && before[index] < delta) {
        wrapping.push([element, slot])
        place(element, exitSlot())
        return
      }
      if (delta < 0 && slot < -delta) withoutTransition(element, () => place(element, exitSlot()))
      place(element, queueSlot(table, slot))
    })
    if (wrapping.length) {
      wrapTimer.current = window.setTimeout(() => {
        wrapping.forEach(([element, slot]) => {
          withoutTransition(element, () => place(element, { x: -0.1, s: 0.34, b: 7, o: 0, z: 1 }))
          place(element, queueSlot(table, slot))
        })
      }, reducedMotion() ? 0 : WRAP_MS)
    }
  }

  function goTo(index: number) {
    let delta = (index - activeRef.current + count) % count
    if (delta > count / 2) delta -= count
    go(delta)
  }

  function openShop(pieceId?: string) {
    if (!look) return
    lastFocus.current = document.activeElement as HTMLElement | null
    window.scrollTo({ top: 0, behavior: 'smooth' })
    shopRef.current = true
    setMessage('')
    setOpenPiece(pieceId ?? look.pieces[0].product.id)
    setShop(true)
  }

  function closeShop() {
    shopRef.current = false
    setShop(false)
    setOpenPiece(null)
    setMessage('')
    lastFocus.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    layout()
    if (shop) panelRef.current?.focus({ preventScroll: true })
  }, [shop, layout])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    layout()
    let timer = 0
    const onResize = () => { window.clearTimeout(timer); timer = window.setTimeout(layout, 80) }
    window.addEventListener('resize', onResize)
    // The header height settles after fonts load; re-measure once it has.
    const settle = window.setTimeout(layout, 400)
    if (reducedMotion()) setPlaying(false)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.55 })
    observer.observe(root)
    return () => {
      window.removeEventListener('resize', onResize)
      window.clearTimeout(timer)
      window.clearTimeout(settle)
      window.clearTimeout(wrapTimer.current)
      window.clearTimeout(walkTimer.current)
      observer.disconnect()
    }
  }, [layout])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (guideFor || useCart.getState().isDrawerOpen) return
      if (event.key === 'Escape' && shopRef.current) { closeShop(); return }
      if (shopRef.current || !visible) return
      const target = event.target as HTMLElement | null
      if (target?.closest?.('input,select,textarea')) return
      if (event.key === 'ArrowRight') go(1)
      if (event.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  function canAdd(product: Product, variantId: string) {
    const variant = sizeOptions(product).find(option => option.id === variantId)
    if (!variant) return false
    if (product.fulfillmentMode === 'made_to_order') return true
    const inBag = bagItems.find(item => item.id === product.id && item.variantId === variantId)?.quantity ?? 0
    return variant.stock >= inBag + 1
  }

  function addPiece(product: Product, variantId: string) {
    const variant = sizeOptions(product).find(option => option.id === variantId)
    if (!variant) return
    const body = bodies[product.id]
    addItem({
      id: product.id, slug: product.slug, title: product.name,
      category: product.category, price: product.price, image: product.image,
      size: variant.size ?? undefined, variantId: variant.id,
      compareAtPrice: product.compareAtPrice,
      ...(body && Object.keys(body).length ? { measurements: body } : {}),
    }, 1)
    trackAddToCart(product, 1)
  }

  function addOne(product: Product) {
    const variantId = selected[product.id]
    if (!variantId) return
    if (!canAdd(product, variantId)) {
      setMessage(copy('Bu beden için yeterli stok yok.', 'There is not enough stock in this size.', 'لا يتوفر مخزون كافٍ لهذا المقاس.'))
      return
    }
    addPiece(product, variantId)
    setMessage('')
    openDrawer()
  }

  function addLook() {
    if (!look) return
    const missing = look.pieces.find(piece => !selected[piece.product.id])
    if (missing) {
      setOpenPiece(missing.product.id)
      setMessage(copy(`Önce beden seçin: ${missing.product.name}`, `Please choose a size: ${missing.product.name}`, `يرجى اختيار المقاس: ${missing.product.name}`))
      return
    }
    if (look.pieces.some(piece => !canAdd(piece.product, selected[piece.product.id]))) {
      setMessage(copy('Seçilen bedenlerden birinde yeterli stok yok.', 'One of the chosen sizes is out of stock.', 'أحد المقاسات المختارة غير متوفر.'))
      return
    }
    look.pieces.forEach(piece => addPiece(piece.product, selected[piece.product.id]))
    setMessage('')
    openDrawer()
  }

  if (!look) {
    return <main className={styles.empty}>
      <p>{copy('Podyum şu anda hazırlanıyor.', 'The runway is being prepared.', 'يجري إعداد العرض.')}</p>
      <Link href={`${prefix}/collections/yeni-gelenler`} className="underline underline-offset-4">{copy('Yeni gelenleri görün', 'See new arrivals', 'شاهدي الجديد')}</Link>
    </main>
  }

  const priceOf = (product: Product) => product.priceAmount == null ? product.price : priceTag(product.priceAmount)
  const lookTotal = look.pieces.every(piece => piece.product.priceAmount != null)
    ? look.pieces.reduce((sum, piece) => sum + (piece.product.priceAmount ?? 0), 0)
    : null
  const rootClass = [styles.runway, shop ? styles.isShop : '', !playing || shop || !visible ? styles.isPaused : '', walking ? styles.isWalking : ''].join(' ')

  return <main ref={rootRef} className={rootClass} aria-label={copy('Podyum', 'Runway', 'عرض الأزياء')}>
    <div className={styles.copy}>
      <p className={styles.eyebrow}>{copy('Podyum', 'Runway', 'عرض الأزياء')} · {pad(active + 1)} / {pad(count)}</p>
      <h1 className={styles.title}>{look.name}</h1>
      <p className={styles.sub}>{copy('Görünümler tek tek yürür. Öndeki modele dokunun, her parçayı görün.', 'Looks walk out one at a time. Tap the model in front to see every piece.', 'تظهر الإطلالات واحدة تلو الأخرى. اضغطي على العارضة في الأمام لرؤية كل قطعة.')}</p>
    </div>

    <div
      ref={stageRef}
      className={styles.stage}
      onPointerDown={event => { swipeStart.current = { x: event.clientX, y: event.clientY } }}
      onPointerUp={event => {
        const start = swipeStart.current
        swipeStart.current = null
        if (!start || shopRef.current) return
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) {
          swiped.current = true
          window.setTimeout(() => { swiped.current = false }, 300)
          go(dx < 0 ? 1 : -1)
        }
      }}
    >
      {looks.map((item, index) => {
        const isFront = index === active
        return <div
          key={item.id}
          ref={element => { modelRefs.current[index] = element }}
          className={`${styles.model} ${isFront ? styles.isFront : ''}`}
          style={{ aspectRatio: `${item.width} / ${item.height}` }}
        >
          <button
            type="button"
            className={styles.modelHit}
            aria-label={isFront ? copy(`${item.name} görünümünü aç`, `Open the ${item.name} look`, `افتحي إطلالة ${item.name}`) : item.name}
            tabIndex={shop ? -1 : 0}
            onClick={() => {
              if (swiped.current || shop) return
              if (isFront) openShop()
              else goTo(index)
            }}
          >
            <Image src={item.image} alt="" width={item.width} height={item.height} sizes="(max-width: 820px) 60vw, 34vw" priority={index === 0} draggable={false} />
          </button>
          <span className={styles.shadow} aria-hidden="true" />
          {isFront && item.pieces.map((piece, pieceIndex) => <button
            key={piece.product.id}
            type="button"
            className={`${styles.spot} ${openPiece === piece.product.id ? styles.spotOn : ''}`}
            style={{ left: `${piece.x}%`, top: `${piece.y}%` } as CSSProperties}
            tabIndex={shop ? 0 : -1}
            aria-label={`${piece.product.name}, ${priceOf(piece.product)}`}
            onClick={() => { setOpenPiece(piece.product.id); setMessage('') }}
          >
            <span className={styles.spotDot}>{pieceIndex + 1}</span>
            <span className={styles.spotTip}>{piece.product.name}<i>{priceOf(piece.product)}</i></span>
          </button>)}
        </div>
      })}
    </div>

    <p className={styles.hint}>{copy('Parçayı görmek için bir noktaya dokunun', 'Tap a dot to see the piece', 'اضغطي على نقطة لرؤية القطعة')}</p>

    <div className={styles.timeline}>
      <button type="button" className={styles.round} onClick={() => go(-1)} aria-label={copy('Önceki görünüm', 'Previous look', 'الإطلالة السابقة')}><ArrowLeft size={16} strokeWidth={1.4} /></button>
      <div className={styles.segments}>
        {looks.map((item, index) => <button
          key={item.id}
          type="button"
          className={`${styles.seg} ${index === active ? styles.segActive : ''}`}
          aria-label={item.name}
          aria-current={index === active ? 'true' : undefined}
          onClick={() => goTo(index)}
        >
          <span className={styles.segTrack}>
            {index === active && <span
              key={active}
              className={styles.segFill}
              style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
              onAnimationEnd={() => { if (playing && !shopRef.current) go(1) }}
            />}
          </span>
          <span className={styles.segLabel}>{pad(index + 1)}{index === active && <b> {item.name}</b>}</span>
        </button>)}
      </div>
      <button type="button" className={styles.round} onClick={() => go(1)} aria-label={copy('Sonraki görünüm', 'Next look', 'الإطلالة التالية')}><ArrowRight size={16} strokeWidth={1.4} /></button>
      <button type="button" className={`${styles.round} ${styles.play}`} onClick={() => setPlaying(value => !value)} aria-label={playing ? copy('Duraklat', 'Pause', 'إيقاف') : copy('Oynat', 'Play', 'تشغيل')}>
        {playing ? <Pause size={14} strokeWidth={1.4} /> : <Play size={14} strokeWidth={1.4} />}
      </button>
    </div>

    <button type="button" className={styles.mobileCta} onClick={() => openShop()}>
      {copy('Görünümü aç', 'Open the look', 'افتحي الإطلالة')}{lookTotal != null ? ` · ${priceTag(lookTotal)}` : ''}
    </button>

    <aside ref={panelRef} className={`${styles.panel} ${shop ? styles.panelOpen : ''}`} role="dialog" aria-label={copy('Bu görünümde', 'In this look', 'في هذه الإطلالة')} aria-hidden={!shop} tabIndex={-1}>
      <header className={styles.panelHead}>
        <div>
          <h2>{copy('Bu görünümde', 'In this look', 'في هذه الإطلالة')}</h2>
          <p>{look.name} · {look.pieces.length} {copy('parça', look.pieces.length === 1 ? 'piece' : 'pieces', 'قطعة')}</p>
        </div>
        <button type="button" className={styles.round} onClick={closeShop} tabIndex={shop ? 0 : -1} aria-label={copy('Kapat', 'Close', 'إغلاق')}><X size={16} strokeWidth={1.4} /></button>
      </header>

      <div className={styles.panelList}>
        {shop && look.pieces.map((piece, index) => {
          const product = piece.product
          const isOpen = openPiece === product.id
          const options = sizeOptions(product)
          const chosen = options.find(option => option.id === selected[product.id])
          const labels = options.filter(option => option.size).map(option => option.label)
          const hasChart = labels.some(label => sizeChartRow(label))
          const productHref = `${prefix}/product/${encodeURIComponent(product.slug || product.id)}`
          return <article key={product.id} className={styles.row}>
            <div className={styles.rowMain}>
              <Link href={productHref} className={styles.thumb}>
                {product.image && <Image src={product.image} alt="" fill sizes="76px" unoptimized={!canOptimizeImage(product.image)} className="object-cover object-top" />}
                <span className={styles.thumbNum}>{index + 1}</span>
              </Link>
              <div className={styles.rowInfo}>
                <h3>{product.name}</h3>
                <p>{priceOf(product)}{chosen ? ` · ${chosen.size ? sizeButtonLabel(chosen.label) : chosen.label}` : ''}</p>
              </div>
              <button type="button" className={`${styles.toggle} ${isOpen ? styles.toggleOpen : ''}`} aria-expanded={isOpen} aria-label={product.name} onClick={() => setOpenPiece(isOpen ? null : product.id)}><Plus size={18} strokeWidth={1.2} /></button>
            </div>
            {isOpen && <div className={styles.rowBody}>
              {options.length === 0
                ? <Link href={productHref} className={styles.btnGhost}>{copy('Ürün sayfasına git', 'Go to the product page', 'الانتقال إلى صفحة المنتج')}</Link>
                : <>
                  <div className={styles.sizeHead}>
                    <span>{copy('Beden', 'Size', 'المقاس')}</span>
                    {hasChart && <button type="button" onClick={() => setGuideFor(product)}><Ruler size={13} strokeWidth={1.5} aria-hidden="true" />{copy('Bedenimi bul', 'Find my size', 'اعرفي مقاسك')}</button>}
                  </div>
                  <div className={styles.sizes} role="group" aria-label={copy('Beden seçin', 'Select a size', 'اختاري المقاس')}>
                    {options.map(option => <button
                      key={option.id}
                      type="button"
                      className={`${styles.size} ${chosen?.id === option.id ? styles.sizeOn : ''}`}
                      aria-pressed={chosen?.id === option.id}
                      onClick={() => { setSelected(current => ({ ...current, [product.id]: option.id })); setMessage('') }}
                    >{option.size ? sizeButtonLabel(option.label) : option.label}</button>)}
                  </div>
                  <button type="button" className={styles.btnGhost} disabled={!chosen} onClick={() => addOne(product)}>
                    {chosen ? copy('Bu parçayı sepete ekle', 'Add this piece to bag', 'أضيفي هذه القطعة') : copy('Beden seçin', 'Select a size', 'اختاري المقاس')}
                  </button>
                  <Link href={productHref} className={styles.productLink}>{copy('Ürün sayfasını gör', 'See the product page', 'عرض صفحة المنتج')}</Link>
                </>}
            </div>}
          </article>
        })}
      </div>

      <footer className={styles.panelFoot}>
        {message && <p role="alert" className={styles.message}>{message}</p>}
        {look.pieces.length > 1 && lookTotal != null && <div className={styles.total}><span>{copy('Görünümün tamamı', 'The whole look', 'الإطلالة كاملة')}</span><b>{priceTag(lookTotal)}</b></div>}
        <button type="button" className={styles.btn} tabIndex={shop ? 0 : -1} onClick={addLook}>
          {look.pieces.length > 1 ? copy('Görünümü sepete ekle', 'Add the look to bag', 'أضيفي الإطلالة إلى الحقيبة') : copy('Sepete ekle', 'Add to bag', 'أضيفي إلى الحقيبة')}
          {look.pieces.length === 1 && lookTotal != null ? ` · ${priceTag(lookTotal)}` : ''}
        </button>
      </footer>
    </aside>

    {guideFor && <SizeGuideDialog
      open
      onClose={() => setGuideFor(null)}
      productName={guideFor.name}
      availableSizes={sizeOptions(guideFor).filter(option => option.size).map(option => option.label)}
      initialMeasurements={bodies[guideFor.id] ?? undefined}
      onApply={(size, measurements) => {
        const option = sizeOptions(guideFor).find(item => item.label === size)
        if (option) setSelected(current => ({ ...current, [guideFor.id]: option.id }))
        setBodies(current => ({ ...current, [guideFor.id]: measurements }))
        setGuideFor(null)
      }}
    />}
  </main>
}
