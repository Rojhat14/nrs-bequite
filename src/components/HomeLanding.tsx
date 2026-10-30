'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Ruler, Scissors, ShieldCheck, Truck } from 'lucide-react'
import type { Product } from '@/data/products'
import { ProductCard } from '@/components/ProductCard'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import { useLocale } from '@/context/LocaleContext'
import { localePrefix } from '@/lib/i18n/messages'
import { canOptimizeImage } from '@/lib/imageOptimization'
import { whatsappUrl } from '@/lib/storefront-config'

export type HomeSelection = {
  hero: Product[]
  categories: Array<{ key: 'dresses' | 'jumpsuits' | 'sets' | 'jackets'; href: string; product: Product }>
  favourites: Product[]
  underBudget: Product[]
  atelier: Product | null
  lowestPrice: number | null
}

function Photo({ product, sizes, priority = false, className = '' }: { product: Product; sizes: string; priority?: boolean; className?: string }) {
  if (!product.image) return <div className={`absolute inset-0 bg-nrs-panel ${className}`} aria-hidden="true" />
  return <Image src={product.image} alt={product.name} fill sizes={sizes} priority={priority}
    unoptimized={!canOptimizeImage(product.image)} className={`object-cover object-top ${className}`} />
}

function SectionHeading({ eyebrow, title, href, linkLabel }: { eyebrow: string; title: string; href?: string; linkLabel?: string }) {
  return <div className="mb-10 flex flex-wrap items-end justify-between gap-4 md:mb-14">
    <div>
      <p className="text-[10px] uppercase tracking-[0.32em] text-nrs-rosegold">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-3xl leading-tight text-nrs-ink md:text-5xl">{title}</h2>
    </div>
    {href && <Link href={href} className="group inline-flex min-h-11 items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-nrs-ink/70 hover:text-nrs-ink">
      {linkLabel}<ArrowRight size={14} strokeWidth={1.5} className="transition-transform duration-500 group-hover:translate-x-1" />
    </Link>}
  </div>
}

export default function HomeLanding({ selection }: { selection: HomeSelection }) {
  const { locale, priceTag } = useLocale()
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const prefix = localePrefix(locale)
  const href = (path: string) => `${prefix}${path}`
  const productHref = (product: Product) => href(`/product/${encodeURIComponent(product.slug || product.id)}`)
  const price = (product: Product) => product.priceAmount == null ? product.price : priceTag(product.priceAmount)
  const [lead, ...supporting] = selection.hero
  const categoryLabel = {
    dresses: copy('Elbiseler', 'Dresses', 'فساتين'),
    jumpsuits: copy('Tulumlar', 'Jumpsuits', 'جمبسوت'),
    sets: copy('Takımlar', 'Sets', 'أطقم'),
    jackets: copy('Ceketler', 'Jackets', 'سترات'),
  }
  const whatsapp = whatsappUrl(copy('Merhaba, bir ürün için bilgi ve beden önerisi almak istiyorum.', 'Hello, I would like product information and size advice.', 'مرحبًا، أود معلومات عن منتج ونصيحة بشأن المقاس.'))

  return <main className="bg-nrs-canvas text-nrs-ink">
    {/* Hero: the collection itself, in full colour, priced and one tap away. */}
    <section className="mx-auto max-w-7xl px-4 pb-14 pt-[calc(var(--nrs-header-height)+1.25rem)] sm:px-6 md:pb-20 lg:px-12 lg:pt-[calc(var(--nrs-header-height)+2.5rem)]">
      <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="order-2 lg:order-1 lg:col-span-5">
          <p className="text-[10px] uppercase tracking-[0.34em] text-nrs-rosegold">{copy('Yeni sezon · Siparişe özel dikim', 'New season · Made to order', 'موسم جديد · تفصيل حسب الطلب')}</p>
          <h1 className="mt-5 font-serif text-[2.6rem] leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl">
            {copy('Size özel dikilen zarafet.', 'Elegance, tailored to you.', 'أناقة تُفصَّل لكِ.')}
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-nrs-ink/70">
            {copy('Takımlar, tulumlar ve davet elbiseleri; her parça siparişinizle birlikte atölyemizde, bedeninize göre dikilir.', 'Suits, jumpsuits and occasion dresses, each cut in our atelier to your size once you order.', 'أطقم وجمبسوت وفساتين مناسبات، تُخاط كل قطعة في مشغلنا على مقاسك بعد طلبك.')}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={href('/collections/yeni-gelenler')} className="inline-flex min-h-[3.25rem] items-center justify-center gap-3 bg-nrs-charcoal px-8 text-[11px] uppercase tracking-[0.26em] text-nrs-ivory transition-colors hover:bg-nrs-black">
              {copy('Yeni gelenleri keşfet', 'Shop new arrivals', 'تسوقي الجديد')}<ArrowRight size={15} strokeWidth={1.5} />
            </Link>
            <Link href={href('/category/tulumlar')} className="inline-flex min-h-[3.25rem] items-center justify-center border border-nrs-ink/25 px-8 text-[11px] uppercase tracking-[0.26em] text-nrs-ink transition-colors hover:border-nrs-ink">
              {copy('Tulumlar', 'Jumpsuits', 'جمبسوت')}
            </Link>
          </div>
          {selection.lowestPrice != null && <p className="mt-6 text-xs text-nrs-ink/55">{copy(`${priceTag(selection.lowestPrice)}’den başlayan fiyatlar · Türkiye geneli ücretsiz kargo`, `From ${priceTag(selection.lowestPrice)} · Free shipping within Türkiye`, `أسعار تبدأ من ${priceTag(selection.lowestPrice)} · شحن مجاني داخل تركيا`)}</p>}
        </div>

        {lead && <div className="order-1 grid grid-cols-5 gap-3 sm:gap-4 lg:order-2 lg:col-span-7">
          <Link href={productHref(lead)} className="group relative col-span-3 aspect-[3/4] overflow-hidden bg-nrs-panel">
            <Photo product={lead} priority sizes="(max-width: 1023px) 60vw, 520px" className="transition-transform duration-[1400ms] group-hover:scale-[1.03]" />
            <span className="absolute bottom-3 left-3 right-3 bg-nrs-canvas/90 px-3 py-2 text-xs backdrop-blur-sm sm:bottom-4 sm:left-4 sm:right-auto sm:px-4">
              <span className="block truncate font-serif text-sm sm:text-base">{lead.name}</span>
              <span className="text-nrs-ink/65">{price(lead)}</span>
            </span>
          </Link>
          <div className="col-span-2 grid grid-rows-2 gap-3 sm:gap-4">
            {supporting.slice(0, 2).map((product) => <Link key={product.id} href={productHref(product)} className="group relative overflow-hidden bg-nrs-panel">
              <Photo product={product} sizes="(max-width: 1023px) 40vw, 340px" className="transition-transform duration-[1400ms] group-hover:scale-[1.04]" />
              <span className="absolute bottom-2 left-2 right-2 bg-nrs-canvas/90 px-2.5 py-1.5 text-[11px] backdrop-blur-sm sm:bottom-3 sm:left-3 sm:right-3">
                <span className="block truncate font-serif text-[13px]">{product.name}</span>
                <span className="text-nrs-ink/65">{price(product)}</span>
              </span>
            </Link>)}
          </div>
        </div>}
      </div>
    </section>

    {/* Promises shoppers asked about on WhatsApp, answered before they ask. */}
    <section aria-label={copy('Alışveriş ayrıcalıkları', 'Shopping benefits', 'مزايا التسوق')} className="border-y border-nrs-ink/10 bg-nrs-warm-white">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-nrs-ink/10 lg:grid-cols-4">
        {[
          { icon: Truck, title: copy('Ücretsiz kargo', 'Free shipping', 'شحن مجاني'), text: copy('Türkiye genelinde tüm siparişlerde', 'On every order within Türkiye', 'لكل الطلبات داخل تركيا') },
          { icon: Scissors, title: copy('Siparişe özel dikim', 'Made to order', 'تفصيل حسب الطلب'), text: copy('7–10 iş gününde kapınızda', 'At your door in 7–10 business days', 'يصلك خلال 7–10 أيام عمل') },
          { icon: Ruler, title: copy('Bedenimi bul', 'Find my size', 'اعرفي مقاسك'), text: copy('Ölçülerinizi girin, bedeninizi önerelim', 'Enter your measurements for a size', 'أدخلي قياساتك لنقترح مقاسك'), link: href('/size-guide') },
          { icon: ShieldCheck, title: copy('Güvenli ödeme', 'Secure payment', 'دفع آمن'), text: copy('3D Secure ile kartla veya havale/EFT', '3D Secure card payment or bank transfer', 'بطاقة عبر 3D Secure أو تحويل بنكي') },
        ].map(({ icon: Icon, title, text, link }) => {
          const body = <><Icon size={20} strokeWidth={1.25} className="shrink-0 text-nrs-rosegold" aria-hidden="true" />
            <span><span className="block text-[11px] uppercase tracking-[0.2em] text-nrs-ink">{title}</span><span className="mt-1 block text-xs leading-5 text-nrs-ink/60">{text}</span></span></>
          return <li key={title} className="bg-nrs-warm-white">
            {link ? <Link href={link} className="flex h-full items-start gap-3 px-4 py-5 hover:bg-nrs-canvas sm:px-8 sm:py-7">{body}</Link>
              : <div className="flex h-full items-start gap-3 px-4 py-5 sm:px-8 sm:py-7">{body}</div>}
          </li>
        })}
      </ul>
    </section>

    {selection.categories.length > 0 && <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-12">
      <SectionHeading eyebrow={copy('Kategoriler', 'Categories', 'الفئات')} title={copy('Ne arıyorsunuz?', 'What are you looking for?', 'عمّ تبحثين؟')} />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {selection.categories.map(({ key, href: path, product }) => <Link key={key} href={href(path)} className="group relative aspect-[3/4] overflow-hidden bg-nrs-panel">
          <Photo product={product} sizes="(max-width: 1023px) 50vw, 300px" className="transition-transform duration-[1400ms] group-hover:scale-105" />
          <span className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-nrs-black/80 via-nrs-black/30 to-transparent" aria-hidden="true" />
          <span className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2 text-nrs-ivory sm:bottom-6 sm:left-6 sm:right-6">
            <span className="font-serif text-2xl sm:text-3xl">{categoryLabel[key]}</span>
            <ArrowRight size={18} strokeWidth={1.25} className="mb-1.5 transition-transform duration-500 group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </Link>)}
      </div>
    </section>}

    {selection.favourites.length > 0 && <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 md:pb-28 lg:px-12">
      <SectionHeading eyebrow={copy('En çok ilgi görenler', 'Most loved', 'الأكثر طلباً')} title={copy('Çok sevilenler', 'Customer favourites', 'المفضلة لدى عميلاتنا')}
        href={href('/collections/yeni-gelenler')} linkLabel={copy('Tümünü gör', 'View all', 'عرض الكل')} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 lg:grid-cols-4">
        {selection.favourites.map(product => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>}

    {selection.atelier && <section className="bg-nrs-charcoal text-nrs-ivory">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-12 lg:gap-16 lg:px-12">
        <div className="relative aspect-[4/5] overflow-hidden lg:col-span-5">
          <Photo product={selection.atelier} sizes="(max-width: 1023px) 100vw, 460px" />
        </div>
        <div className="lg:col-span-7">
          <p className="text-[10px] uppercase tracking-[0.34em] text-nrs-champagne">{copy('Atölye', 'The atelier', 'المشغل')}</p>
          <h2 className="mt-4 font-serif text-3xl leading-tight md:text-5xl">{copy('Bedeninizi seçin, gerisini atölyemiz üstlensin.', 'Choose your size. Our atelier does the rest.', 'اختاري مقاسك، ومشغلنا يتولى الباقي.')}</h2>
          <ol className="mt-10 space-y-7">
            {[
              [copy('Bedeninizi seçin', 'Choose your size', 'اختاري مقاسك'), copy('Harf ve numara bedenlerimiz aynıdır: S = 36, M = 38, L = 40, XL = 42.', 'Letter and number sizes match: S = 36, M = 38, L = 40, XL = 42.', 'المقاسات بالحروف والأرقام متطابقة: S = 36، M = 38، L = 40، XL = 42.')],
              [copy('İsterseniz ölçünüzü ekleyin', 'Add your measurements if you like', 'أضيفي قياساتك إن رغبتِ'), copy('İki beden arasındaysanız “Bedenimi bul” ile ölçülerinizi siparişe ekleyin; dikimde esas alınır.', 'Between sizes? Add your measurements with “Find my size”; we cut to them.', 'بين مقاسين؟ أضيفي قياساتك عبر «اعرفي مقاسك» وسنعتمدها في الخياطة.')],
              [copy('7–10 iş gününde kapınızda', 'At your door in 7–10 business days', 'يصلك خلال 7–10 أيام عمل'), copy('Parçanız atölyemizde dikilir ve ücretsiz kargoyla gönderilir.', 'Your piece is made in our atelier and shipped free of charge.', 'تُخاط قطعتك في مشغلنا وتُشحن مجاناً.')],
            ].map(([title, text], index) => <li key={title} className="flex gap-5">
              <span className="font-serif text-3xl leading-none text-nrs-champagne">{index + 1}</span>
              <span><span className="block text-sm uppercase tracking-[0.18em]">{title}</span><span className="mt-2 block text-sm leading-6 text-nrs-ivory/70">{text}</span></span>
            </li>)}
          </ol>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href={href('/size-guide')} className="inline-flex min-h-[3.25rem] items-center justify-center bg-nrs-ivory px-8 text-[11px] uppercase tracking-[0.26em] text-nrs-ink hover:bg-nrs-canvas">{copy('Beden rehberi', 'Size guide', 'دليل المقاسات')}</Link>
            {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[3.25rem] items-center justify-center gap-3 border border-nrs-ivory/40 px-8 text-[11px] uppercase tracking-[0.26em] hover:border-nrs-ivory"><WhatsAppIcon />{copy('Stil danışmanına yaz', 'Ask our stylist', 'اسألي مستشارة الأناقة')}</a>}
          </div>
        </div>
      </div>
    </section>}

    {selection.underBudget.length > 0 && <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-12">
      <SectionHeading eyebrow={copy('Seçki', 'Edit', 'تشكيلة')} title={copy('₺4.000 altı seçki', 'Under ₺4,000', 'أقل من 4000 ليرة')}
        href={href('/category/ust-giyim')} linkLabel={copy('Üst giyime göz at', 'Browse tops', 'تصفحي القمصان')} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 lg:grid-cols-4">
        {selection.underBudget.map(product => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>}

    <section className="border-t border-nrs-ink/10 px-4 py-20 text-center sm:px-6 md:py-24">
      <p className="text-[10px] uppercase tracking-[0.34em] text-nrs-rosegold">NRS</p>
      <p className="mx-auto mt-6 max-w-3xl font-serif text-2xl leading-snug md:text-4xl">
        {copy('“Dikkat çekmek için değil, kendi duruşunu ifade etmek için giyinen kadın için.”', '“For the woman who dresses to express her own presence, not to seek attention.”', '«للمرأة التي ترتدي لتعبّر عن حضورها، لا لتلفت الأنظار.»')}
      </p>
      <Link href={href('/about')} className="mt-8 inline-flex min-h-11 items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-nrs-ink/70 underline-offset-8 hover:text-nrs-ink hover:underline">
        {copy('Hikayemiz', 'Our story', 'قصتنا')}<ArrowRight size={14} strokeWidth={1.5} />
      </Link>
    </section>
  </main>
}
