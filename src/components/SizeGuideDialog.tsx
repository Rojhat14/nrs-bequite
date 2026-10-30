'use client'

import { useEffect, useRef, useState } from 'react'
import { Ruler, X } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { MEASUREMENT_RANGES } from '@/lib/order-measurements'
import { SIZE_CHART, matchingSize, recommendSize, sizeButtonLabel, sizeChartRow, type BodyMeasurements } from '@/lib/size-chart'
import { whatsappNumber, whatsappUrl } from '@/lib/storefront-config'

type Props = {
  open: boolean
  onClose: () => void
  productName: string
  availableSizes: string[]
  initialMeasurements?: BodyMeasurements
  /** Called with the product's own size label and, when the shopper chose to
   * send them, the measurements to attach to the bag line. */
  onApply: (size: string, measurements: BodyMeasurements | null) => void
}

const FIELDS = ['chest', 'waist', 'hips'] as const

export default function SizeGuideDialog({ open, onClose, productName, availableSizes, initialMeasurements, onApply }: Props) {
  const { locale } = useLocale()
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const labels = {
    chest: copy('Göğüs', 'Bust', 'الصدر'),
    waist: copy('Bel', 'Waist', 'الخصر'),
    hips: copy('Basen', 'Hips', 'الورك'),
  }
  const help = {
    chest: copy('Mezurayı göğsün en dolgun noktasından, yere paralel geçirin.', 'Measure around the fullest part of the bust, keeping the tape level.', 'قيسي حول أعرض جزء من الصدر مع إبقاء الشريط مستوياً.'),
    waist: copy('Belin en ince yerini, mezurayı sıkmadan ölçün.', 'Measure the narrowest part of the waist without pulling the tape tight.', 'قيسي أضيق جزء من الخصر دون شد الشريط.'),
    hips: copy('Kalçanın en geniş yerini, ayaklar bitişikken ölçün.', 'Measure the widest part of the hips with feet together.', 'قيسي أعرض جزء من الورك مع ضم القدمين.'),
  }
  const [values, setValues] = useState<Record<(typeof FIELDS)[number], string>>({ chest: '', waist: '', hips: '' })
  const [attach, setAttach] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Read through refs so a parent re-render does not reset what is being typed.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const initialRef = useRef(initialMeasurements)
  initialRef.current = initialMeasurements

  useEffect(() => {
    if (!open) return
    const initial = initialRef.current
    setValues({
      chest: initial?.chest ? String(initial.chest) : '',
      waist: initial?.waist ? String(initial.waist) : '',
      hips: initial?.hips ? String(initial.hips) : '',
    })
    setSubmitted(false)
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; opener?.focus?.() }
  }, [open])

  if (!open) return null

  const body: BodyMeasurements = {}
  const invalid: string[] = []
  for (const field of FIELDS) {
    const raw = values[field].replace(',', '.').trim()
    if (!raw) continue
    const value = Number(raw)
    const [min, max] = MEASUREMENT_RANGES[field]
    if (!Number.isFinite(value) || value < min || value > max) invalid.push(labels[field])
    else body[field] = Math.round(value)
  }
  const result = submitted && !invalid.length ? recommendSize(body, availableSizes) : null
  const suggested = result ? matchingSize(result.row, availableSizes) : undefined
  const needsMeasurements = Boolean(result && (!result.fitsChart || result.between))
  const productRows = SIZE_CHART.filter(row => availableSizes.some(size => sizeChartRow(size) === row))
  const range = ([low, high]: [number, number]) => `${low}–${high}`

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-nrs-black/40 sm:items-center" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="size-guide-title" onClick={event => event.stopPropagation()}
      className="max-h-[92vh] w-full overflow-y-auto bg-nrs-canvas px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-nrs-ink sm:max-w-2xl sm:px-8 sm:pb-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 id="size-guide-title" className="font-serif text-2xl">{copy('Beden tablosu ve beden bulucu', 'Size chart and size finder', 'جدول المقاسات ومُحدِّد المقاس')}</h2>
          <p className="mt-1 text-xs text-nrs-ink/60">{productName}</p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={copy('Kapat', 'Close', 'إغلاق')}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-nrs-ink/70 hover:text-nrs-ink focus-visible:outline focus-visible:outline-2"><X size={20} /></button>
      </div>

      <p className="text-sm leading-6 text-nrs-ink/75">
        {copy('Her parça siparişinizle birlikte size özel dikilir. Harf ve numara bedenlerimiz aynıdır: ',
          'Every piece is made to order for you. Our letter and number sizes are the same: ',
          'تُصنع كل قطعة خصيصاً لطلبك. مقاساتنا بالحروف والأرقام متطابقة: ')}
        <strong className="font-medium text-nrs-ink">S = 36, M = 38, L = 40, XL = 42</strong>.
      </p>

      <section aria-labelledby="size-finder-title" className="mt-6 border border-nrs-ink/10 bg-nrs-panel p-4 sm:p-5">
        <h3 id="size-finder-title" className="flex items-center gap-2 text-xs uppercase tracking-widest"><Ruler size={15} aria-hidden="true" />{copy('Bedenimi bul', 'Find my size', 'اعرفي مقاسك')}</h3>
        <p className="mt-2 text-xs leading-5 text-nrs-ink/65">{copy('Vücut ölçülerinizi santimetre olarak girin. Bildiklerinizi yazmanız yeterli.', 'Enter your body measurements in centimetres. Fill in the ones you know.', 'أدخلي قياسات جسمك بالسنتيمتر. يكفي ما تعرفينه منها.')}</p>
        <form className="mt-4 grid grid-cols-3 gap-3" onSubmit={event => { event.preventDefault(); setSubmitted(true) }}>
          {FIELDS.map(field => <label key={field} className="flex flex-col gap-1.5 text-xs text-nrs-ink/70">
            {labels[field]} (cm)
            <input inputMode="decimal" value={values[field]} placeholder={field === 'chest' ? '90' : field === 'waist' ? '72' : '98'}
              onChange={event => { setValues(current => ({ ...current, [field]: event.target.value })); setSubmitted(false) }}
              className="min-h-11 w-full min-w-0 border border-nrs-ink/20 bg-nrs-canvas px-3 text-base text-nrs-ink focus:border-nrs-ink focus:outline-none" />
          </label>)}
          <button type="submit" className="col-span-3 min-h-11 bg-nrs-charcoal px-4 text-xs uppercase tracking-widest text-nrs-ivory hover:bg-nrs-ink">{copy('Bedenimi bul', 'Find my size', 'اعرفي مقاسك')}</button>
        </form>
        {submitted && invalid.length > 0 && <p role="alert" className="mt-3 text-sm text-red-700">{copy(`${invalid.join(', ')} ölçüsünü kontrol edin.`, `Check your ${invalid.join(', ').toLowerCase()} measurement.`, `تحققي من قياس ${invalid.join('، ')}.`)}</p>}
        {submitted && !invalid.length && !result && <p role="status" className="mt-3 text-sm text-nrs-ink/70">{copy('En az bir ölçü girin.', 'Enter at least one measurement.', 'أدخلي قياساً واحداً على الأقل.')}</p>}
        {result && suggested && <div role="status" className="mt-4 space-y-3 border-t border-nrs-ink/10 pt-4">
          <p className="text-sm">{copy('Size önerdiğimiz beden:', 'Your recommended size:', 'المقاس المقترح لكِ:')} <strong className="font-serif text-xl">{sizeButtonLabel(suggested)}</strong></p>
          {needsMeasurements && <p className="text-xs leading-5 text-nrs-ink/70">{!result.fitsChart
            ? copy('Ölçüleriniz tablomuzun en büyük bedeninin üzerinde. Bu bedeni seçip ölçülerinizi siparişe ekleyin; atölyemiz dikimde ölçülerinizi esas alır.', 'Your measurements are above our largest size. Choose this size and add your measurements to the order; our atelier will cut to them.', 'قياساتك أكبر من أكبر مقاس لدينا. اختاري هذا المقاس وأضيفي قياساتك إلى الطلب؛ وسيعتمدها مشغلنا عند الخياطة.')
            : copy('Ölçüleriniz iki beden arasında. Bu bedeni seçip ölçülerinizi siparişe eklemenizi öneririz; atölyemiz dikimde ölçülerinizi esas alır.', 'You are between two sizes. We suggest choosing this size and adding your measurements to the order; our atelier will cut to them.', 'أنتِ بين مقاسين. ننصحك باختيار هذا المقاس وإضافة قياساتك إلى الطلب؛ وسيعتمدها مشغلنا عند الخياطة.')}</p>}
          <label className="flex items-start gap-2 text-xs leading-5 text-nrs-ink/75">
            <input type="checkbox" checked={attach} onChange={event => setAttach(event.target.checked)} className="mt-0.5 h-4 w-4 accent-nrs-ink" />
            {copy('Ölçülerimi siparişe ekle (atölye dikimde dikkate alır, ek ücret yok)', 'Add my measurements to the order (the atelier uses them when cutting, no extra charge)', 'أضيفي قياساتي إلى الطلب (يعتمدها المشغل عند الخياطة دون رسوم إضافية)')}
          </label>
          <button type="button" onClick={() => { onApply(suggested, attach ? body : null); onClose() }}
            className="min-h-11 w-full border border-nrs-ink bg-nrs-ink px-4 text-xs uppercase tracking-widest text-nrs-canvas hover:bg-nrs-charcoal">
            {copy(`${sizeButtonLabel(suggested)} bedeni seç`, `Select size ${sizeButtonLabel(suggested)}`, `اختيار المقاس ${sizeButtonLabel(suggested)}`)}
          </button>
        </div>}
      </section>

      <section aria-labelledby="size-table-title" className="mt-6">
        <h3 id="size-table-title" className="text-xs uppercase tracking-widest">{copy('Vücut ölçüleri (cm)', 'Body measurements (cm)', 'قياسات الجسم (سم)')}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse text-left text-sm tabular-nums">
            <thead><tr className="border-b border-nrs-ink/20 text-[11px] uppercase tracking-wider text-nrs-ink/60">
              <th scope="col" className="py-2 pr-3 font-normal">{copy('Beden', 'Size', 'المقاس')}</th>
              <th scope="col" className="py-2 pr-3 font-normal">{labels.chest}</th>
              <th scope="col" className="py-2 pr-3 font-normal">{labels.waist}</th>
              <th scope="col" className="py-2 font-normal">{labels.hips}</th>
            </tr></thead>
            <tbody>{productRows.map(row => <tr key={row.numeric} className={`border-b border-nrs-ink/10 ${result?.row === row ? 'bg-nrs-panel font-medium' : ''}`}>
              <th scope="row" className="py-2.5 pr-3 font-medium">{row.letter} · {row.numeric}</th>
              <td className="py-2.5 pr-3">{range(row.chest)}</td>
              <td className="py-2.5 pr-3">{range(row.waist)}</td>
              <td className="py-2.5">{range(row.hips)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="size-measure-title" className="mt-6 space-y-2 text-xs leading-5 text-nrs-ink/70">
        <h3 id="size-measure-title" className="text-xs uppercase tracking-widest text-nrs-ink">{copy('Nasıl ölçülür?', 'How to measure', 'كيف تأخذين القياسات؟')}</h3>
        <ul className="space-y-1.5">{FIELDS.map(field => <li key={field}><strong className="font-medium text-nrs-ink">{labels[field]}:</strong> {help[field]}</li>)}</ul>
        <p>{copy('İki beden arasında kalırsanız bir büyük bedeni seçin ve ölçülerinizi siparişe ekleyin.', 'If you are between two sizes, choose the larger one and add your measurements to the order.', 'إذا كنتِ بين مقاسين، اختاري الأكبر وأضيفي قياساتك إلى الطلب.')}</p>
        {whatsappNumber && <p>{copy('Hâlâ emin değil misiniz? ', 'Still unsure? ', 'ما زلتِ مترددة؟ ')}
          <a className="underline underline-offset-4 hover:text-nrs-ink" target="_blank" rel="noopener noreferrer"
            href={whatsappUrl(copy(`Merhaba, ${productName} için beden danışmak istiyorum.`, `Hello, I would like size advice for ${productName}.`, `مرحبًا، أود استشارة بخصوص مقاس ${productName}.`)) ?? undefined}>
            {copy('WhatsApp’tan bize yazın', 'Message us on WhatsApp', 'راسلينا عبر واتساب')}</a>.</p>}
      </section>
    </div>
  </div>
}
