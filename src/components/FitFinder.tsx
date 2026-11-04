'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Minus, Plus, X } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { FIT_DEFAULTS, FIT_LIMITS, fitLines, recommendFit, type FitAnswers, type FitArea, type FitLevel, type ShapeAnswer } from '@/lib/fit-estimate'
import { canOptimizeImage } from '@/lib/imageOptimization'
import { sizeButtonLabel } from '@/lib/size-chart'

const STORAGE_KEY = 'nrs-fit-answers'

type Saved = FitAnswers & { metric: boolean; done: boolean }
const SAVED_DEFAULTS: Saved = { ...FIT_DEFAULTS, metric: true, done: false }

/** Answers stay in this browser and are never sent anywhere. */
export function readFitAnswers(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Saved> | null
    if (!raw || typeof raw.heightCm !== 'number' || typeof raw.weightKg !== 'number') return SAVED_DEFAULTS
    const clamp = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, value))
    const shape = (value: unknown): ShapeAnswer => (value === -1 || value === 1 ? value : 0)
    return {
      heightCm: clamp(raw.heightCm, FIT_LIMITS.height), weightKg: clamp(raw.weightKg, FIT_LIMITS.weight),
      chest: shape(raw.chest), waist: shape(raw.waist), hips: shape(raw.hips),
      metric: raw.metric !== false, done: raw.done === true,
    }
  } catch {
    return SAVED_DEFAULTS
  }
}

type Props = {
  open: boolean
  onClose: () => void
  productName: string
  /** URL name of the product; it decides which measurements matter for the cut. */
  productKey: string
  productImage?: string
  priceLabel?: string
  /** The product's own size labels. */
  availableSizes: string[]
  onSelect: (size: string) => void
  onAddToBag: (size: string) => void
  /** Opens the dialog where shoppers enter exact body measurements. */
  onExactMeasurements?: () => void
}

function Figure({ heightCm, weightKg }: { heightCm: number; weightKg: number }) {
  const heightScale = 0.8 + ((heightCm - 145) / 50) * 0.2
  const bmi = weightKg / ((heightCm / 100) ** 2)
  const widthScale = Math.max(0.78, Math.min(1.45, 0.72 + bmi * 0.0127))
  return <svg viewBox="0 0 80 180" aria-hidden="true" className="h-[170px] w-[74px] text-nrs-ink">
    <g transform={`translate(40 178) scale(${widthScale.toFixed(3)} ${heightScale.toFixed(3)}) translate(-40 -178)`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="40" cy="15" rx="9" ry="11" />
      <path d="M36 26v5c-9 2-14 4-16 9l-6 42 5 1 7-34 3 22-5 38 6 66h7l3-58c.3-2 1.7-2 2 0l3 58h7l6-66-5-38 3-22 7 34 5-1-6-42c-2-5-7-7-16-9v-5" />
    </g>
  </svg>
}

export default function FitFinder({ open, onClose, productName, productKey, productImage, priceLabel, availableSizes, onSelect, onAddToBag, onExactMeasurements }: Props) {
  const { locale } = useLocale()
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const [answers, setAnswers] = useState<Saved>(SAVED_DEFAULTS)
  const [step, setStep] = useState(1)
  const [tried, setTried] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement as HTMLElement | null
    const saved = readFitAnswers()
    setAnswers(saved)
    setTried(null)
    setStep(saved.done ? 3 : 1)
    panelRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const opener = openerRef.current
    return () => {
      document.body.style.overflow = previousOverflow
      opener?.focus?.({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); onCloseRef.current(); return }
      if (event.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]'))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  if (!open) return null

  const save = (next: Saved) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage may be off */ } }
  const update = (change: Partial<Saved>) => setAnswers(current => ({ ...current, ...change }))
  const recommendation = recommendFit(answers, availableSizes, productKey)
  const size = tried ?? recommendation?.size ?? availableSizes[0]
  const lines = fitLines(answers, size, productKey)
  const areaName: Record<FitArea, string> = { chest: copy('Göğüs', 'Bust', 'الصدر'), waist: copy('Bel', 'Waist', 'الخصر'), hips: copy('Basen', 'Hips', 'الورك') }
  const levelName: Record<FitLevel, string> = {
    tight: copy('Dar gelebilir', 'May feel tight', 'قد يكون ضيقاً'),
    right: copy('Bu kesim için doğru', 'Right for this cut', 'مناسب لهذا القصّ'),
    relaxed: copy('Rahat durur', 'Sits relaxed', 'يبدو مريحاً'),
    loose: copy('Bol durabilir', 'May feel loose', 'قد يكون واسعاً'),
  }
  const inches = Math.round(answers.heightCm / 2.54)
  const heightText = answers.metric ? `${answers.heightCm}` : `${Math.floor(inches / 12)}′${inches % 12}″`
  const weightText = answers.metric ? `${answers.weightKg}` : `${Math.round(answers.weightKg * 2.20462)}`
  const unitButton = (metric: boolean, label: string) => <button type="button" aria-pressed={answers.metric === metric} onClick={() => update({ metric })}
    className={`min-h-9 px-3 text-[13px] ${answers.metric === metric ? 'bg-nrs-ink text-nrs-ivory' : 'text-nrs-ink/60 hover:text-nrs-ink'}`}>{label}</button>
  const slider = (id: 'heightCm' | 'weightKg', label: string, value: string, unit: string, limits: readonly [number, number]) => <div>
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={`fit-${id}`} className="text-[13px] text-nrs-ink/60">{label}</label>
      <output htmlFor={`fit-${id}`} className="nrs-display font-serif text-[1.75rem] leading-none [font-variant-numeric:lining-nums]" dir="ltr">{value}{unit && <small className="ms-1 font-sans text-[13px] text-nrs-ink/60">{unit}</small>}</output>
    </div>
    <div className="mt-2 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1">
      <button type="button" aria-label={`${label} −`} onClick={() => update({ [id]: Math.max(limits[0], answers[id] - 1) })} className="inline-flex h-11 w-11 items-center justify-center border border-nrs-ink/15 hover:border-nrs-ink"><Minus size={14} strokeWidth={1.3} /></button>
      <input id={`fit-${id}`} type="range" min={limits[0]} max={limits[1]} step={1} value={answers[id]} dir="ltr" aria-valuetext={`${value} ${unit}`}
        onChange={event => update({ [id]: Number(event.target.value) })} className="h-11 w-full cursor-pointer accent-nrs-ink" />
      <button type="button" aria-label={`${label} +`} onClick={() => update({ [id]: Math.min(limits[1], answers[id] + 1) })} className="inline-flex h-11 w-11 items-center justify-center border border-nrs-ink/15 hover:border-nrs-ink"><Plus size={14} strokeWidth={1.3} /></button>
    </div>
  </div>

  return <div className="fixed inset-0 z-[170] flex justify-end bg-nrs-black/40" onClick={onClose}>
    <aside ref={panelRef} role="dialog" aria-modal="true" aria-label={copy('Bedenimi bul', 'Find my size', 'اعرفي مقاسك')} tabIndex={-1}
      onClick={event => event.stopPropagation()}
      className="flex h-[100dvh] w-full max-w-[460px] flex-col bg-nrs-canvas text-nrs-ink outline-none">
      <header className="flex items-center justify-between border-b border-nrs-ink/10 px-5 py-3 sm:px-6">
        <p className="text-[12px] uppercase tracking-[0.2em]">{copy('Bedenimi bul', 'Find my size', 'اعرفي مقاسك')}</p>
        <button type="button" onClick={onClose} aria-label={copy('Kapat', 'Close', 'إغلاق')} className="inline-flex h-11 w-11 items-center justify-center hover:opacity-60"><X size={20} strokeWidth={1.2} /></button>
      </header>
      <div className="flex items-center gap-3 bg-nrs-warm-white px-5 py-3 sm:px-6">
        {productImage && <span className="relative h-16 w-12 shrink-0 overflow-hidden"><Image src={productImage} alt="" fill sizes="48px" unoptimized={!canOptimizeImage(productImage)} className="object-cover object-top" /></span>}
        <span className="min-w-0"><span className="block text-[14px] leading-snug">{productName}</span>{priceLabel && <span className="mt-0.5 block text-[13px] text-nrs-ink/60">{priceLabel}</span>}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 px-5 pt-3 sm:px-6" role="img" aria-label={copy(`Adım ${step} / 3`, `Step ${step} of 3`, `الخطوة ${step} من 3`)}>
        {[1, 2, 3].map(number => <span key={number} className={`h-0.5 ${number <= step ? 'bg-nrs-ink' : 'bg-nrs-ink/15'}`} />)}
      </div>

      {step === 1 && <>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <h2 className="font-serif text-[1.75rem] leading-tight">{copy('Ölçünüzü bulalım', 'Let’s find your fit', 'لنجد مقاسك')}</h2>
          <p className="mt-1 text-[14px] text-nrs-ink/60">{copy('İki bilgi, yaklaşık on saniye.', 'Two details, about ten seconds.', 'معلومتان، نحو عشر ثوانٍ.')}</p>
          <div className="mt-4 inline-flex border border-nrs-ink/15" role="group" aria-label={copy('Birim', 'Units', 'الوحدات')}>
            {unitButton(true, 'cm / kg')}{unitButton(false, 'ft / lb')}
          </div>
          <div className="mt-5 grid grid-cols-[74px_minmax(0,1fr)] items-end gap-4">
            <Figure heightCm={answers.heightCm} weightKg={answers.weightKg} />
            <div className="space-y-5">
              {slider('heightCm', copy('Boy', 'Height', 'الطول'), heightText, answers.metric ? 'cm' : '', FIT_LIMITS.height)}
              {slider('weightKg', copy('Kilo', 'Weight', 'الوزن'), weightText, answers.metric ? 'kg' : 'lb', FIT_LIMITS.weight)}
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between border border-nrs-ink/15 px-4 py-3">
            <span><span className="block text-[14px]">{copy('Anlık tahmin', 'Live estimate', 'تقدير فوري')}</span><span className="text-[12.5px] text-nrs-ink/60">{copy('Sonraki adımda netleşir', 'Refined in the next step', 'يتضح في الخطوة التالية')}</span></span>
            <b className="nrs-display font-serif text-[1.6rem] font-normal [font-variant-numeric:lining-nums]" aria-live="polite">{recommendation ? sizeButtonLabel(recommendation.size) : '—'}</b>
          </div>
        </div>
        <footer className="border-t border-nrs-ink/10 px-5 py-3 sm:px-6">
          <button type="button" onClick={() => setStep(2)} className="min-h-[3.25rem] w-full border border-nrs-ink bg-nrs-ink text-[12.5px] uppercase tracking-[0.16em] text-nrs-ivory hover:bg-transparent hover:text-nrs-ink">{copy('Devam et', 'Continue', 'متابعة')}</button>
          <p className="mt-2 text-center text-[12.5px] text-nrs-ink/60">{copy('Yanıtlarınız bu cihazda kalır, hiçbir yere gönderilmez.', 'Your answers stay on this device and are not sent anywhere.', 'تبقى إجاباتك على هذا الجهاز ولا تُرسل إلى أي مكان.')}</p>
        </footer>
      </>}

      {step === 2 && <>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <h2 className="font-serif text-[1.75rem] leading-tight">{copy('Vücut şekliniz', 'Your shape', 'شكل جسمك')}</h2>
          <p className="mt-1 text-[14px] leading-6 text-nrs-ink/60">{copy('Aynı boy ve kiloda olan çoğu kişiye göre. Emin değilseniz Ortalama’da bırakın.', 'Compared with most people your height and weight. Not sure? Leave it on Average.', 'مقارنة بمعظم من لهم طولك ووزنك. إن لم تكوني متأكدة فاتركيه على متوسط.')}</p>
          {(['chest', 'waist', 'hips'] as const).map(area => <div key={area} role="group" aria-label={areaName[area]} className="mt-5">
            <p className="mb-2 text-[14px]">{areaName[area]}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([[-1, copy('Daha ince', 'Narrower', 'أنحف')], [0, copy('Ortalama', 'Average', 'متوسط')], [1, copy('Daha dolgun', 'Fuller', 'أكثر امتلاءً')]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={answers[area] === value}
                onClick={() => update({ [area]: value })} className={`min-h-12 border px-1 text-[13.5px] ${answers[area] === value ? 'border-nrs-ink bg-nrs-ink text-nrs-ivory' : 'border-nrs-ink/15 hover:border-nrs-ink'}`}>{label}</button>)}
            </div>
          </div>)}
        </div>
        <footer className="border-t border-nrs-ink/10 px-5 py-3 sm:px-6">
          <button type="button" onClick={() => { const next = { ...answers, done: true }; setAnswers(next); save(next); setTried(null); setStep(3) }} className="min-h-[3.25rem] w-full border border-nrs-ink bg-nrs-ink text-[12.5px] uppercase tracking-[0.16em] text-nrs-ivory hover:bg-transparent hover:text-nrs-ink">{copy('Bedenimi göster', 'Show my size', 'اعرضي مقاسي')}</button>
          <button type="button" onClick={() => setStep(1)} className="mt-1 min-h-11 w-full text-[13px] text-nrs-ink/70 underline underline-offset-4">{copy('Geri', 'Back', 'رجوع')}</button>
        </footer>
      </>}

      {step === 3 && recommendation && <>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mx-auto grid h-32 w-32 place-items-center rounded-full border border-nrs-ink text-center outline outline-1 outline-offset-4 outline-nrs-ink/15">
            <span><b className="nrs-display block font-serif text-[2.1rem] font-normal leading-tight [font-variant-numeric:lining-nums]" dir="ltr">{sizeButtonLabel(size)}</b>
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-nrs-ink/60">{size === recommendation.size ? copy('En uygun', 'Best fit', 'الأنسب') : copy('Sizin seçiminiz', 'Your choice', 'اختيارك')}</span></span>
          </div>
          <p className="mt-5 text-center text-[14.5px] leading-6">{size === recommendation.size
            ? copy(`${productName} için ölçünüze en yakın beden bu.`, `This is the closest size for ${productName}.`, `هذا أقرب مقاس لـ ${productName}.`)
            : copy(`Önerimiz ${sizeButtonLabel(recommendation.size)}. Bu bedende parça şöyle durur:`, `We suggest ${sizeButtonLabel(recommendation.size)}. In this size it sits like this:`, `نقترح ${sizeButtonLabel(recommendation.size)}. بهذا المقاس تبدو القطعة هكذا:`)}</p>
          {(recommendation.over || recommendation.under) && <p role="status" className="mt-3 bg-nrs-warm-white px-3 py-2.5 text-[13.5px] leading-6">{copy('Ölçüleriniz beden tablomuzun dışında kalıyor olabilir. Her parça siparişe özel dikildiği için ölçülerinizi ekleyerek sipariş vermenizi öneririz.', 'Your measurements may fall outside our size chart. Each piece is made to order, so we suggest adding your measurements.', 'قد تكون قياساتك خارج جدول المقاسات. تُخاط كل قطعة حسب الطلب، لذا ننصح بإضافة قياساتك.')}</p>}
          <ul className="mt-4 border-t border-nrs-ink/10">
            {lines.areas.map(line => <li key={line.area} className="flex justify-between gap-4 border-b border-nrs-ink/10 py-2.5 text-[14px]">
              <span className="text-nrs-ink/60">{areaName[line.area]}</span>
              <span className={line.level === 'tight' || line.level === 'loose' ? 'italic underline underline-offset-4' : ''}>{levelName[line.level]}</span>
            </li>)}
            {lines.length && <li className="flex justify-between gap-4 border-b border-nrs-ink/10 py-2.5 text-[14px]">
              <span className="text-nrs-ink/60">{copy('Boy', 'Length', 'الطول')}</span>
              <span className="text-end">{lines.length === 'fine' ? copy('Boyunuza uygun', 'Suits your height', 'يناسب طولك') : lines.length === 'short' ? copy('Kısaltma gerekebilir', 'May need shortening', 'قد يحتاج إلى تقصير') : copy('Kısa kalabilir, bize sorun', 'May run short, ask us', 'قد يكون قصيراً، اسألينا')}</span>
            </li>}
          </ul>
          <p className="mt-4 text-[13px]">{copy('Başka bir beden deneyin', 'Try another size', 'جرّبي مقاساً آخر')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group">
            {availableSizes.map(label => <button key={label} type="button" aria-pressed={label === size} onClick={() => setTried(label)}
              className={`h-11 min-w-12 border px-2.5 text-[13px] ${label === size ? 'border-nrs-ink bg-nrs-ink text-nrs-ivory' : 'border-nrs-ink/15 hover:border-nrs-ink'}`}>{sizeButtonLabel(label)}</button>)}
          </div>
          <p className="mt-4 text-[12.5px] leading-5 text-nrs-ink/60">{copy('Boy, kilo ve yanıtlarınızdan tahmin edildi; rehberdir, kesin sonuç vermez. Atölyemizin ölçülerinize göre dikmesini isterseniz ölçülerinizi girin.', 'Estimated from your height, weight and answers. It is a guide, not a guarantee. To have our atelier cut to your measurements, enter them.', 'تقدير من طولك ووزنك وإجاباتك، وهو دليل وليس ضماناً. لتخيط المشغل وفق قياساتك، أدخليها.')}</p>
          {onExactMeasurements && <button type="button" onClick={onExactMeasurements} className="mt-1 min-h-11 text-[13.5px] underline underline-offset-4">{copy('Ölçülerimi gireceğim', 'I’ll enter my measurements', 'سأدخل قياساتي')}</button>}
        </div>
        <footer className="border-t border-nrs-ink/10 px-5 py-3 sm:px-6">
          <button type="button" onClick={() => onAddToBag(size)} className="min-h-[3.25rem] w-full border border-nrs-ink bg-nrs-ink text-[12.5px] uppercase tracking-[0.16em] text-nrs-ivory hover:bg-transparent hover:text-nrs-ink">{copy(`${sizeButtonLabel(size)} sepete ekle`, `Add ${sizeButtonLabel(size)} to bag`, `أضيفي ${sizeButtonLabel(size)} إلى الحقيبة`)}</button>
          <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[12.5px] text-nrs-ink/70">
            <button type="button" onClick={() => onSelect(size)} className="min-h-11 underline underline-offset-4">{copy('Bedeni seç, kapat', 'Select and close', 'اختيار وإغلاق')}</button>
            <button type="button" onClick={() => { setTried(null); setStep(1) }} className="min-h-11 underline underline-offset-4">{copy('Yanıtları düzenle', 'Edit answers', 'تعديل الإجابات')}</button>
            <button type="button" onClick={() => { try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage may be off */ } setAnswers(SAVED_DEFAULTS); setTried(null); setStep(1) }} className="min-h-11 underline underline-offset-4">{copy('Yanıtlarımı sil', 'Delete my answers', 'حذف إجاباتي')}</button>
          </div>
        </footer>
      </>}
    </aside>
  </div>
}
