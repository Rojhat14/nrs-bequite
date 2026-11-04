'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Ruler, Scissors, ShieldCheck, Truck } from 'lucide-react'
import type { Product } from '@/data/products'
import Catwalk, { type CatwalkLook } from '@/components/catwalk/Catwalk'
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
  tailoring: Product | null
  coat: Product | null
  coatFrom: number | null
  lowestPrice: number | null
  looks: CatwalkLook[]
}

function Photo({ src, alt, sizes, priority = false, className = '' }: { src?: string; alt: string; sizes: string; priority?: boolean; className?: string }) {
  if (!src) return <div className={`absolute inset-0 bg-nrs-panel ${className}`} aria-hidden="true" />
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority}
    unoptimized={!canOptimizeImage(src)} className={`object-cover object-[center_12%] ${className}`} />
}

const eyebrow = 'text-[12px] uppercase tracking-[0.2em]'
const textLink = 'inline-flex min-h-11 items-center border-b border-current text-[13px] uppercase tracking-[0.12em] hover:opacity-60'
const sectionTitle = 'font-serif text-[2rem] leading-[1.08] md:text-5xl'

export default function HomeLanding({ selection }: { selection: HomeSelection }) {
  const { locale, priceTag } = useLocale()
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const prefix = localePrefix(locale)
  const href = (path: string) => `${prefix}${path}`
  const categoryLabel = {
    dresses: copy('Elbiseler', 'Dresses', 'فساتين'),
    jumpsuits: copy('Tulumlar', 'Jumpsuits', 'جمبسوت'),
    sets: copy('Takımlar', 'Sets', 'أطقم'),
    jackets: copy('Ceketler', 'Jackets', 'سترات'),
  }
  const whatsapp = whatsappUrl(copy('Merhaba, bir ürün için bilgi ve beden önerisi almak istiyorum.', 'Hello, I would like product information and size advice.', 'مرحبًا، أود معلومات عن منتج ونصيحة بشأن المقاس.'))
  const coatDetail = selection.coat?.galleryImages?.[selection.coat.galleryImages.length - 1]?.url ?? selection.coat?.image

  return <main className="bg-nrs-canvas text-nrs-ink">
    <section className="relative h-[100svh] min-h-[560px] overflow-hidden bg-nrs-ink">
      <div className="absolute inset-0 grid grid-cols-1 gap-px md:grid-cols-3">
        {selection.hero.slice(0, 3).map((product, index) => <Link key={product.id} href={href(`/product/${encodeURIComponent(product.slug || product.id)}`)} aria-label={product.name}
          className={`relative block overflow-hidden ${index > 0 ? 'hidden md:block' : ''}`}>
          <Photo src={product.image} alt={product.name} priority={index === 0} sizes="(max-width: 767px) 100vw, 34vw" className="nrs-settle" />
        </Link>)}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent via-40% to-black/70" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[clamp(2rem,7vh,4.5rem)] text-center text-white">
        <p className={eyebrow}>{copy('Yeni sezon · Siparişe özel dikim', 'New season · Made to order', 'موسم جديد · تفصيل حسب الطلب')}</p>
        <h1 className="nrs-display mx-auto mt-3 max-w-5xl font-serif text-[clamp(2.75rem,7.4vw,6.5rem)] leading-[1.02]">
          {copy('Size özel dikilen zarafet.', 'Elegance, tailored to you.', 'أناقة تُفصَّل لكِ.')}
        </h1>
        <div className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-1">
          <Link href={href('/collections/yeni-gelenler')} className={textLink}>{copy('Yeni gelenleri keşfet', 'Shop new arrivals', 'تسوقي الجديد')}</Link>
          <a href="#podyum" className={textLink}>{copy('Podyumu izle', 'Watch the runway', 'شاهدي العرض')}</a>
        </div>
        {selection.lowestPrice != null && <p className="mt-3 text-[13px] text-white/75">{copy(`${priceTag(selection.lowestPrice)}’den başlayan fiyatlar · Türkiye geneli ücretsiz kargo`, `From ${priceTag(selection.lowestPrice)} · Free shipping within Türkiye`, `أسعار تبدأ من ${priceTag(selection.lowestPrice)} · شحن مجاني داخل تركيا`)}</p>}
      </div>
    </section>

    {selection.coatFrom != null && <Link href={href('/category/dis-giyim')} className="flex min-h-12 flex-wrap items-center justify-center gap-x-3 bg-nrs-ink px-4 py-3 text-center text-[13px] tracking-[0.04em] text-nrs-ivory hover:text-nrs-ivory/70">
      <span>{copy('Kış kabanları', 'Winter coats', 'معاطف الشتاء')}</span>
      <span className="tabular-nums">{copy(`Başlangıç fiyatı ${priceTag(selection.coatFrom)}`, `From ${priceTag(selection.coatFrom)}`, `تبدأ من ${priceTag(selection.coatFrom)}`)}</span>
    </Link>}

    <section aria-label={copy('Alışveriş ayrıcalıkları', 'Shopping benefits', 'مزايا التسوق')} className="border-b border-nrs-ink/10">
      <ul className="grid grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Truck, title: copy('Ücretsiz kargo', 'Free shipping', 'شحن مجاني'), text: copy('Türkiye genelinde tüm siparişlerde', 'On every order within Türkiye', 'لكل الطلبات داخل تركيا') },
          { icon: Scissors, title: copy('Siparişe özel dikim', 'Made to order', 'تفصيل حسب الطلب'), text: copy('7–10 iş gününde kapınızda', 'At your door in 7–10 business days', 'يصلك خلال 7–10 أيام عمل') },
          { icon: Ruler, title: copy('Bedenimi bul', 'Find my size', 'اعرفي مقاسك'), text: copy('Ölçülerinizi girin, bedeninizi önerelim', 'Enter your measurements for a size', 'أدخلي قياساتك لنقترح مقاسك'), link: href('/size-guide') },
          { icon: ShieldCheck, title: copy('Güvenli ödeme', 'Secure payment', 'دفع آمن'), text: copy('3D Secure ile kartla veya havale/EFT', '3D Secure card payment or bank transfer', 'بطاقة عبر 3D Secure أو تحويل بنكي') },
        ].map(({ icon: Icon, title, text, link }) => {
          const body = <><Icon size={19} strokeWidth={1.2} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span><span className="block text-[14px]">{title}</span><span className="mt-0.5 block text-[12.5px] leading-5 text-nrs-ink/60">{text}</span></span></>
          return <li key={title} className="border-b border-e border-nrs-ink/10 lg:border-b-0 lg:last:border-e-0 [&:nth-child(2)]:border-e-0 lg:[&:nth-child(2)]:border-e [&:nth-child(n+3)]:border-b-0">
            {link ? <Link href={link} className="flex h-full items-start gap-3 px-4 py-5 hover:bg-nrs-warm-white md:px-8">{body}</Link>
              : <div className="flex h-full items-start gap-3 px-4 py-5 md:px-8">{body}</div>}
          </li>
        })}
      </ul>
    </section>

    <section className="px-4 py-[clamp(4rem,12vh,9rem)] text-center">
      <p className="mx-auto max-w-4xl font-serif text-[1.65rem] leading-[1.3] md:text-[2.6rem]">
        {copy('“Dikkat çekmek için değil, kendi duruşunu ifade etmek için giyinen kadın için.”', '“For the woman who dresses to express her own presence, not to seek attention.”', '«للمرأة التي ترتدي لتعبّر عن حضورها، لا لتلفت الأنظار.»')}
      </p>
      <Link href={href('/about')} className={`${textLink} mt-6`}>{copy('Hikayemiz', 'Our story', 'قصتنا')}</Link>
    </section>

    {selection.looks.length > 0 && <div id="podyum" className="scroll-mt-0"><Catwalk looks={selection.looks} embedded /></div>}

    {selection.categories.length > 0 && <section className="px-4 py-[clamp(3.5rem,10vh,7rem)] md:px-8">
      <h2 className={`${sectionTitle} mb-7`}>{copy('Ne arıyorsunuz?', 'What are you looking for?', 'عمّ تبحثين؟')}</h2>
      <div className="grid grid-cols-2 gap-px bg-nrs-ink/10 lg:grid-cols-4">
        {selection.categories.map(({ key, href: path, product }) => <Link key={key} href={href(path)} className="group relative aspect-[2/3] overflow-hidden bg-nrs-panel">
          <Photo src={product.image} alt="" sizes="(max-width: 1023px) 50vw, 25vw" className="transition-transform duration-[1400ms] group-hover:scale-[1.04]" />
          <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent" aria-hidden="true" />
          <span className="absolute inset-x-0 bottom-5 text-center font-serif text-2xl text-white md:text-[1.75rem]">{categoryLabel[key]}</span>
        </Link>)}
      </div>
    </section>}

    {selection.tailoring && <section className="grid md:min-h-[92svh] md:grid-cols-2">
      <div className="relative aspect-[4/5] overflow-hidden bg-nrs-panel md:aspect-auto">
        <Photo src={selection.tailoring.image} alt={selection.tailoring.name} sizes="(max-width: 767px) 100vw, 50vw" />
      </div>
      <div className="flex flex-col items-start justify-center gap-4 px-4 py-12 md:px-[clamp(2.5rem,7vw,7rem)]">
        <p className={eyebrow}>{copy('Takımlar', 'Sets', 'أطقم')}</p>
        <h2 className={sectionTitle}>{copy('Doğru kesim duruşu değiştirir.', 'The right cut changes how you stand.', 'القصة الصحيحة تغيّر حضورك.')}</h2>
        <p className="max-w-md text-[15px] leading-7 text-nrs-ink/65">{copy('Her takım siparişinizle birlikte atölyemizde bedeninize göre dikilir. Parçaları birlikte de ayrı ayrı da alabilirsiniz.', 'Every set is cut to your size in our atelier once you order. Buy it complete or piece by piece.', 'يُخاط كل طقم على مقاسك في مشغلنا بعد طلبك. يمكنك شراؤه كاملاً أو قطعة قطعة.')}</p>
        <Link href={href('/category/takimlar')} className={textLink}>{copy('Takımları gör', 'See the sets', 'شاهدي الأطقم')}</Link>
      </div>
    </section>}

    {selection.favourites.length > 0 && <section className="py-[clamp(3.5rem,10vh,7rem)]">
      <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3 px-4 md:px-8">
        <h2 className={sectionTitle}>{copy('Çok sevilenler', 'Customer favourites', 'المفضلة لدى عميلاتنا')}</h2>
        <Link href={href('/collections/yeni-gelenler')} className={textLink}>{copy('Tümünü gör', 'View all', 'عرض الكل')}</Link>
      </div>
      <div className="nrs-grid border-t border-nrs-ink/10">
        {selection.favourites.map(product => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>}

    {coatDetail && <section className="grid bg-nrs-ink text-nrs-ivory md:min-h-[92svh] md:grid-cols-2">
      <div className="flex flex-col items-start justify-center gap-4 px-4 py-12 md:order-1 md:px-[clamp(2.5rem,7vw,7rem)]">
        <p className={eyebrow}>{copy('Dış giyim', 'Outerwear', 'ملابس خارجية')}</p>
        <h2 className={sectionTitle}>{copy('Kışın en yüksek sesi.', 'The loudest voice of winter.', 'أعلى صوت في الشتاء.')}</h2>
        <p className="max-w-md text-[15px] leading-7 text-nrs-ivory/70">{copy('Siyahlar arasında tek bir renk. Ekose kabanlarımız uzun, kemerli ve çekingen değil.', 'A single colour among the blacks. Our check coats are long, belted and far from shy.', 'لون واحد بين الأسود. معاطفنا المربعة طويلة ومزودة بحزام وبعيدة عن الخجل.')}</p>
        {selection.coatFrom != null && <p className="text-[15px] tabular-nums">{copy(`Başlangıç fiyatı ${priceTag(selection.coatFrom)}`, `From ${priceTag(selection.coatFrom)}`, `تبدأ من ${priceTag(selection.coatFrom)}`)}</p>}
        <Link href={href('/category/dis-giyim')} className={textLink}>{copy('Dış giyimi gör', 'See outerwear', 'شاهدي الملابس الخارجية')}</Link>
      </div>
      <div className="relative aspect-[4/5] overflow-hidden md:order-2 md:aspect-auto">
        <Photo src={coatDetail} alt={selection.coat?.name ?? ''} sizes="(max-width: 767px) 100vw, 50vw" />
      </div>
    </section>}

    {selection.underBudget.length > 0 && <section className="py-[clamp(3.5rem,10vh,7rem)]">
      <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3 px-4 md:px-8">
        <h2 className={sectionTitle}>{copy('₺4.000 altı seçki', 'Under ₺4,000', 'أقل من 4000 ليرة')}</h2>
        <Link href={href('/category/ust-giyim')} className={textLink}>{copy('Üst giyime göz at', 'Browse tops', 'تصفحي القمصان')}</Link>
      </div>
      <div className="nrs-grid border-t border-nrs-ink/10">
        {selection.underBudget.map(product => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>}

    {selection.atelier && <section className="grid bg-nrs-warm-white md:grid-cols-2">
      <div className="relative aspect-[4/5] overflow-hidden md:aspect-auto">
        <Photo src={selection.atelier.image} alt={selection.atelier.name} sizes="(max-width: 767px) 100vw, 50vw" />
      </div>
      <div className="px-4 py-12 md:px-[clamp(2.5rem,7vw,7rem)] md:py-24">
        <p className={eyebrow}>{copy('Atölye', 'The atelier', 'المشغل')}</p>
        <h2 className={`${sectionTitle} mt-4`}>{copy('Bedeninizi seçin, gerisini atölyemiz üstlensin.', 'Choose your size. Our atelier does the rest.', 'اختاري مقاسك، ومشغلنا يتولى الباقي.')}</h2>
        <ol className="mt-9 space-y-6">
          {[
            [copy('Bedeninizi seçin', 'Choose your size', 'اختاري مقاسك'), copy('Harf ve numara bedenlerimiz aynıdır: S = 36, M = 38, L = 40, XL = 42.', 'Letter and number sizes match: S = 36, M = 38, L = 40, XL = 42.', 'المقاسات بالحروف والأرقام متطابقة: S = 36، M = 38، L = 40، XL = 42.')],
            [copy('İsterseniz ölçünüzü ekleyin', 'Add your measurements if you like', 'أضيفي قياساتك إن رغبتِ'), copy('İki beden arasındaysanız “Bedenimi bul” ile ölçülerinizi siparişe ekleyin; dikimde esas alınır.', 'Between sizes? Add your measurements with “Find my size”; we cut to them.', 'بين مقاسين؟ أضيفي قياساتك عبر «اعرفي مقاسك» وسنعتمدها في الخياطة.')],
            [copy('7–10 iş gününde kapınızda', 'At your door in 7–10 business days', 'يصلك خلال 7–10 أيام عمل'), copy('Parçanız atölyemizde dikilir ve ücretsiz kargoyla gönderilir.', 'Your piece is made in our atelier and shipped free of charge.', 'تُخاط قطعتك في مشغلنا وتُشحن مجاناً.')],
          ].map(([title, text], index) => <li key={title} className="flex gap-5">
            <span className="font-serif text-2xl leading-none [font-variant-numeric:lining-nums]">{index + 1}</span>
            <span><span className="block text-[15px]">{title}</span><span className="mt-1 block text-[14px] leading-6 text-nrs-ink/65">{text}</span></span>
          </li>)}
        </ol>
        <div className="mt-9 flex flex-col gap-2 sm:flex-row">
          <Link href={href('/size-guide')} className="inline-flex min-h-[3.25rem] items-center justify-center border border-nrs-ink bg-nrs-ink px-8 text-[12px] uppercase tracking-[0.16em] text-nrs-ivory hover:bg-transparent hover:text-nrs-ink">{copy('Beden rehberi', 'Size guide', 'دليل المقاسات')}</Link>
          {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[3.25rem] items-center justify-center gap-3 border border-nrs-ink px-8 text-[12px] uppercase tracking-[0.16em] hover:bg-nrs-ink hover:text-nrs-ivory"><WhatsAppIcon />{copy('Stil danışmanına yaz', 'Ask our stylist', 'اسألي مستشارة الأناقة')}</a>}
        </div>
      </div>
    </section>}
  </main>
}
