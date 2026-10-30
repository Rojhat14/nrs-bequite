'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Product } from '@/data/products';
import { parsePrice, useCart } from '@/store/useCart';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { lookupWishlist } from '@/lib/wishlistClient';
import { ShoppingBag, Heart, ArrowLeft, ArrowRight, Truck, Clock3, Scissors, Ruler } from 'lucide-react';
import Image from 'next/image';
import { whatsappNumber, whatsappUrl } from '@/lib/storefront-config';
import { buildWhatsappOrderMessage, whatsappSelectionError } from '@/lib/whatsapp-order';
import BankTransferInfo from '@/components/BankTransferInfo';
import WhatsAppIcon from '@/components/WhatsAppIcon';
import { useRouter } from 'next/navigation';
import CardPaymentNotice from '@/components/payment/CardPaymentNotice';
import { useLocale } from '@/context/LocaleContext';
import { parseProductDescription } from '@/lib/product-description'
import { trackAddToCart, trackInitiateCheckout, trackViewContent } from '@/lib/meta-events'
import { isNumericDressProduct, numericDressVariantOptions, sortActualVariantOptions } from '@/lib/dress-sizes'
import { normalizeSizeLabel, sizeButtonLabel, sizeChartRow, type BodyMeasurements } from '@/lib/size-chart'
import { LOOK_PART_LABELS, type LookPartKind } from '@/lib/look-families'
import SizeGuideDialog from '@/components/SizeGuideDialog'

export type LookItem = { id: string; slug: string; name: string; kind: LookPartKind; price: string; priceAmount: number | null }

interface ProductDetailProps {
  product: Product;
  look?: LookItem[];
}

export default function ProductDetail({ product, look }: ProductDetailProps) {
  const router = useRouter();
  const addItem = useCart(state => state.addItem);
  const bagItems = useCart(state => state.items);
  const openDrawer = useCart(state => state.openDrawer);
  const { user } = useAuth();
  const { locale, rate, priceTag, t, fxAvailable } = useLocale();
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const userId = user?.id;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [orderError, setOrderError] = useState('');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(() => {
    const primaryIndex = product.galleryImages?.findIndex((image) => image.isPrimary) ?? -1
    return Math.max(0, primaryIndex)
  });
  const [brokenImages, setBrokenImages] = useState<Set<number>>(() => new Set());
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurements | null>(null);
  const closeSizeGuide = useCallback(() => setSizeGuideOpen(false), []);
  const touchStartX = useRef<number | null>(null);
  useEffect(() => { setSelectedVariantId(null); setOrderError(''); setQuantity(1); setBodyMeasurements(null) }, [product.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per product page
  useEffect(() => trackViewContent(product), [product.id])
  useEffect(() => {
    let active = true;
    const checkWishlist = async () => {
      setIsWishlisted(false);
      if (!userId) return;
      try {
        const favorite = await lookupWishlist(userId, product.id);
        if (active) setIsWishlisted(favorite);
      } catch {
        if (active) setIsWishlisted(false);
      }
    };
    checkWishlist();
    return () => { active = false; };
  }, [userId, product.id]);

  const toggleWishlist = async () => {
    if (wishlistBusy) return;
    if (!user) {
      alert(copy('Lütfen favorilerinize eklemek için giriş yapın.', 'Please sign in to add this item to your favorites.', 'يُرجى تسجيل الدخول لإضافة المنتج إلى المفضلة.'));
      return;
    }

    const prevStatus = isWishlisted;
    setWishlistBusy(true);
    setIsWishlisted(!prevStatus);

    try {
      if (prevStatus) {
        const { error } = await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wishlist')
          .insert({ user_id: user.id, product_id: product.id });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Wishlist error:', error);
      setIsWishlisted(prevStatus);
    } finally {
      setWishlistBusy(false);
    }
  };

  // A stray unsized row next to S–XL showed up as a confusing "Tek beden"
  // button; only offer it when the product has no sizes at all.
  const sizedVariantRows = (product.variants ?? []).filter((variant) => variant.size)
  const actualVariants = (sizedVariantRows.length ? sizedVariantRows : product.variants ?? []).map((variant) => ({ id: variant.id, label: variant.size ? normalizeSizeLabel(variant.size) : 'Tek beden', size: variant.size ?? undefined, stock: variant.stock_quantity }))
  const numericDress = isNumericDressProduct(product)
  const madeToOrder = product.fulfillmentMode === 'made_to_order'
  const variants = sortActualVariantOptions(numericDress ? numericDressVariantOptions(actualVariants) ?? actualVariants : actualVariants)
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId)
  const hasRealVariantInventory = actualVariants.length > 0
  const sizeLabels = variants.filter((variant) => variant.size).map((variant) => variant.label)
  const hasSizeChart = sizeLabels.some((label) => sizeChartRow(label))
  const selectedRow = selectedVariant ? sizeChartRow(selectedVariant.label) : undefined
  const currentLook = look?.find((item) => item.id === product.id)
  const lookSet = look?.find((item) => item.kind === 'set')
  const lookPieces = look?.filter((item) => item.kind !== 'set') ?? []
  const piecesTotal = lookPieces.reduce((sum, item) => sum + (item.priceAmount ?? 0), 0)
  const setSaving = lookSet?.priceAmount != null && lookPieces.every((item) => item.priceAmount != null) ? piecesTotal - lookSet.priceAmount : 0
  const partLabel = (kind: LookPartKind) => copy(LOOK_PART_LABELS[kind].tr, LOOK_PART_LABELS[kind].en, LOOK_PART_LABELS[kind].ar)
  const measurementSummary = bodyMeasurements ? ([['chest', copy('Göğüs', 'Bust', 'الصدر')], ['waist', copy('Bel', 'Waist', 'الخصر')], ['hips', copy('Basen', 'Hips', 'الورك')]] as const)
    .filter(([field]) => bodyMeasurements[field]).map(([field, label]) => `${label} ${bodyMeasurements[field]}`).join(' · ') : ''
  function addSelection(checkout = false) {
    if (!product.inStock) return;
    if (variants.length > 0 && !selectedVariant) {
      setOrderError(copy('Lütfen bir beden seçin.', 'Please select a size.', 'يُرجى اختيار المقاس.')); return;
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setOrderError(copy('Lütfen geçerli bir adet seçin.', 'Please enter a valid quantity.', 'يُرجى إدخال كمية صالحة.')); return;
    }
    if (!selectedVariant?.id || (!madeToOrder && (selectedVariant.stock < 1 || quantity > selectedVariant.stock))) {
      setOrderError(copy('Seçilen adet için yeterli stok bulunmuyor.', 'There is not enough stock for the selected quantity.', 'الكمية المختارة غير متوفرة في المخزون.')); return;
    }
    // Adding the same size again merges into the existing bag line, so the
    // stock check must include what is already there (saved carts grow across
    // visits otherwise and checkout later rejects the line).
    const alreadyInBag = (bagItems ?? []).find(item => item.id === product.id && item.variantId === selectedVariant.id)?.quantity ?? 0
    if (!madeToOrder && alreadyInBag + quantity > selectedVariant.stock) {
      if (checkout && alreadyInBag > 0) { setOrderError(''); trackInitiateCheckout(bagItems ?? []); router.push('/checkout'); return; }
      setOrderError(copy(`Bu bedenden sepetinizde zaten ${alreadyInBag} adet var; stokta ${selectedVariant.stock} adet bulunuyor.`, `Your bag already has ${alreadyInBag} in this size; ${selectedVariant.stock} in stock.`, `في حقيبتك ${alreadyInBag} من هذا المقاس؛ المتوفر ${selectedVariant.stock}.`)); return;
    }
    addItem({
      id: product.id, slug: product.slug, title: product.name,
      category: product.category, price: product.price, image: product.image,
      size: selectedVariant?.size ?? undefined, variantId: selectedVariant?.id,
      compareAtPrice: product.compareAtPrice,
      ...(bodyMeasurements && Object.keys(bodyMeasurements).length ? { measurements: bodyMeasurements } : {}),
    }, quantity);
    trackAddToCart(product, quantity);
    setOrderError('');
    if (checkout) {
      trackInitiateCheckout([...(bagItems ?? []).filter(item => !(item.id === product.id && item.variantId === selectedVariant.id)),
        { id: product.id, price: product.price, quantity: alreadyInBag + quantity }]);
      router.push('/checkout');
    }
    else openDrawer();
  }
  const galleryImages = product.galleryImages?.length
    ? product.galleryImages
    : product.image ? [{ url: product.image, altText: product.name, sortOrder: 0, isPrimary: true }] : []
  const primaryImageIndex = galleryImages.findIndex((image) => image.isPrimary)
  const activeImage = galleryImages[activeImageIndex]

  useEffect(() => {
    setActiveImageIndex(primaryImageIndex >= 0 ? primaryImageIndex : 0)
    setBrokenImages(new Set())
  }, [product.id, primaryImageIndex])

  function moveImage(direction: -1 | 1) {
    if (galleryImages.length < 2) return
    setActiveImageIndex((current) => (current + direction + galleryImages.length) % galleryImages.length)
  }

  function handleGalleryKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    moveImage(event.key === 'ArrowRight' ? 1 : -1)
  }

  function markImageBroken(index: number) {
    setBrokenImages((current) => new Set(current).add(index))
  }

  return (
    <div className="min-h-screen bg-nrs-canvas flex">
      <main className="w-full flex-1 pb-32">
        <div className="max-w-7xl mx-auto px-6 pt-[calc(var(--nrs-header-height)+0.75rem)] lg:pt-[max(8rem,calc(var(--nrs-header-height)+1rem))] grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          <div className="lg:col-span-7 min-w-0 space-y-6 lg:sticky lg:top-[calc(var(--nrs-header-height)+1rem)] lg:self-start">
            <div
              className={`nrs-fade-up product-gallery relative -mx-6 grid gap-3 sm:mx-0 ${galleryImages.length > 1 ? 'grid-cols-1 lg:grid-cols-[5rem_minmax(0,1fr)]' : 'grid-cols-1'}`}
              role="region"
              aria-label={copy('Ürün görsel galerisi', 'Product image gallery', 'معرض صور المنتج')}
              tabIndex={galleryImages.length > 1 ? 0 : undefined}
              onKeyDown={handleGalleryKeyDown}
            >
              <div
                className="relative aspect-[2/3] min-h-0 min-w-0 overflow-hidden lg:aspect-auto lg:h-full"
                onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }}
                onTouchEnd={(event) => {
                  const startX = touchStartX.current
                  const endX = event.changedTouches[0]?.clientX
                  touchStartX.current = null
                  if (startX === null || endX === undefined || Math.abs(endX - startX) < 48) return
                  moveImage(endX < startX ? 1 : -1)
                }}
              >
              {activeImage && !brokenImages.has(activeImageIndex) ? (
                <Image
                  key={activeImage.url}
                  src={activeImage.url}
                  alt={activeImage.altText || product.name}
                  fill
                  priority={activeImageIndex === Math.max(0, primaryImageIndex)}
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) calc(100vw - 48px), (max-width: 1279px) 50vw, 590px"
                  className="object-contain"
                  onError={() => markImageBroken(activeImageIndex)}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-nrs-black/5 to-nrs-black/10" role="img" aria-label={copy('Görsel yüklenemedi', 'Image could not be loaded', 'تعذر تحميل الصورة')} />
              )}
              {galleryImages.length > 1 && <>
                <button
                  type="button"
                  onClick={() => moveImage(-1)}
                  aria-label={copy('Önceki ürün görseli', 'Previous product image', 'الصورة السابقة للمنتج')}
                  className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 border border-white/70 bg-white/75 p-2.5 text-nrs-black shadow-sm backdrop-blur-sm transition hover:bg-white sm:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nrs-ink"
                >
                  <ArrowLeft size={18} strokeWidth={1.4} />
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(1)}
                  aria-label={copy('Sonraki ürün görseli', 'Next product image', 'الصورة التالية للمنتج')}
                  className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 border border-white/70 bg-white/75 p-2.5 text-nrs-black shadow-sm backdrop-blur-sm transition hover:bg-white sm:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nrs-ink"
                >
                  <ArrowRight size={18} strokeWidth={1.4} />
                </button>
                {/* Phones swipe; the counter shows there is more to see. */}
                <span aria-hidden="true" className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 bg-white/80 px-3 py-1 text-[10px] tracking-[0.25em] text-nrs-ink backdrop-blur-sm sm:hidden">
                  {activeImageIndex + 1} / {galleryImages.length}
                </span>
              </>}
              <button
                onClick={toggleWishlist}
                disabled={wishlistBusy}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 p-3 bg-white/80 backdrop-blur-sm rounded-full text-nrs-black hover:text-nrs-rosegold transition-colors z-10"
                aria-label={isWishlisted ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                aria-pressed={isWishlisted}
              >
                <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} strokeWidth={1.2} />
              </button>
              </div>

              {galleryImages.length > 1 && <div className="flex min-h-0 gap-2 overflow-x-auto px-6 sm:px-0 lg:order-first lg:flex-col lg:gap-3 lg:overflow-y-auto lg:overflow-x-hidden">
                {galleryImages.map((image, index) => (
                  <button
                    type="button"
                    key={`${image.sortOrder}-${image.url}-${index}`}
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={copy(`${index + 1}. ürün görselini göster`, `Show product image ${index + 1}`, `عرض صورة المنتج ${index + 1}`)}
                    aria-pressed={activeImageIndex === index}
                    className={`relative h-16 w-12 shrink-0 lg:h-20 lg:w-20 overflow-hidden border transition ${activeImageIndex === index ? 'border-nrs-ink opacity-100' : 'border-transparent opacity-65 hover:opacity-100'}`}
                  >
                    {!brokenImages.has(index) ? <Image
                      src={image.url}
                      alt={image.altText || `${product.name} — ${index + 1}`}
                      fill
                      sizes="(max-width: 1023px) 48px, 80px"
                      className="object-contain"
                      onError={() => markImageBroken(index)}
                    /> : <span className="absolute inset-0 bg-gradient-to-br from-nrs-black/5 to-nrs-black/10" aria-hidden="true" />}
                  </button>
                ))}
              </div>}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-start lg:pt-12">
            <div
              style={{ animationDelay: '0.2s' }}
              className="nrs-fade-side space-y-8 lg:space-y-10"
            >
              <div className="space-y-4">
                <span className="text-xs uppercase tracking-[0.3em] text-nrs-rosegold font-sans">
                  {product.category}
                </span>
                <h1 className="text-3xl sm:text-4xl xl:text-[2.75rem] font-serif text-nrs-ink leading-[1.1] tracking-tight">
                  {product.name}
                </h1>
                <div className="flex items-baseline gap-3">
                  <p className="text-2xl font-sans font-light tabular-nums text-nrs-ink">{product.priceAmount == null ? product.price : priceTag(product.priceAmount)}</p>
                </div>
                {locale !== 'tr' && <p className="max-w-md text-xs text-nrs-ink/55">{fxAvailable ? t('currencyNote') : t('fxUnavailable')}</p>}
                {/* The delivery promise near the price answers the first questions
                    shoppers have before choosing a size (same terms as checkout). */}
                <ul aria-label={copy('Teslimat bilgileri', 'Delivery details', 'تفاصيل التوصيل')} className="grid grid-cols-1 gap-2 pt-2 text-xs text-nrs-ink/75 sm:grid-cols-3">
                  <li className="flex items-center gap-2"><Truck size={15} strokeWidth={1.5} aria-hidden="true" />{copy('Türkiye geneli ücretsiz kargo', 'Free shipping within Türkiye', 'شحن مجاني داخل تركيا')}</li>
                  <li className="flex items-center gap-2"><Clock3 size={15} strokeWidth={1.5} aria-hidden="true" />{copy('7–10 iş günü teslimat', 'Delivered in 7–10 business days', 'التوصيل خلال 7–10 أيام عمل')}</li>
                  <li className="flex items-center gap-2"><Scissors size={15} strokeWidth={1.5} aria-hidden="true" />{copy('Siparişinize özel üretim', 'Made to order for you', 'يُصنع خصيصًا لطلبك')}</li>
                </ul>
                {currentLook && look && <div className="mt-2 border border-nrs-ink/15 bg-nrs-panel p-4 text-sm">
                  <p className="leading-6 text-nrs-ink/80">{currentLook.kind === 'set'
                    ? copy('Bu fiyata fotoğraftaki takımın tamamı dahildir. Parçaları ayrı ayrı da alabilirsiniz:', 'This price includes the complete set shown. You can also buy the pieces separately:', 'يشمل هذا السعر الطقم الكامل الظاهر في الصورة. يمكنك أيضاً شراء القطع منفصلة:')
                    : copy(`Bu sayfada yalnızca ${partLabel(currentLook.kind).toLocaleLowerCase('tr-TR')} satılır. Fotoğraftaki diğer parçalar ayrı satılır:`, `This page sells the ${partLabel(currentLook.kind).toLowerCase()} only. The other pieces shown are sold separately:`, `تُباع في هذه الصفحة ${partLabel(currentLook.kind)} فقط. القطع الأخرى في الصورة تُباع منفصلة:`)}</p>
                  <ul className="mt-3 divide-y divide-nrs-ink/10 border-y border-nrs-ink/10">
                    {[...(lookSet ? [lookSet] : []), ...lookPieces].map((item) => <li key={item.id}>
                      {item.id === product.id
                        ? <span className="flex min-h-11 items-center justify-between gap-3 font-medium"><span>{partLabel(item.kind)} <span className="text-xs font-normal text-nrs-ink/55">({copy('bu sayfa', 'this page', 'هذه الصفحة')})</span></span><span className="tabular-nums">{item.priceAmount == null ? item.price : priceTag(item.priceAmount)}</span></span>
                        : <Link href={`/product/${encodeURIComponent(item.slug)}`} className="flex min-h-11 items-center justify-between gap-3 underline-offset-4 hover:underline"><span>{partLabel(item.kind)}</span><span className="tabular-nums">{item.priceAmount == null ? item.price : priceTag(item.priceAmount)}</span></Link>}
                    </li>)}
                  </ul>
                  {setSaving > 0 && <p className="mt-2 text-xs text-nrs-ink/65">{copy(`Takım olarak aldığınızda parçaların toplamına göre ${priceTag(setSaving)} avantajlısınız.`, `Buying the set saves ${priceTag(setSaving)} compared with the pieces.`, `شراء الطقم يوفر ${priceTag(setSaving)} مقارنة بالقطع منفصلة.`)}</p>}
                </div>}
              </div>

              <div className="space-y-8 py-8 lg:py-10 border-y border-nrs-ink/10">
                <div className="space-y-5">
                  {variants.length > 0 && <>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="text-xs uppercase tracking-widest text-nrs-ink/60 font-sans">{copy('Beden seçin', 'Select a size', 'اختاري المقاس')}</p>
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {hasSizeChart && <button type="button" onClick={() => setSizeGuideOpen(true)}
                        className="inline-flex min-h-9 items-center gap-1.5 font-medium text-nrs-ink underline underline-offset-4">
                        <Ruler size={14} strokeWidth={1.5} aria-hidden="true" />
                        {copy('Beden tablosu · Bedenimi bul', 'Size chart · Find my size', 'جدول المقاسات · اعرفي مقاسك')}
                      </button>}
                      {!hasSizeChart && whatsappNumber && <a href={whatsappUrl(copy(`Merhaba, ${product.name} için beden danışmak istiyorum.`, `Hello, I would like size advice for ${product.name}.`, `مرحبًا، أود استشارة بخصوص مقاس ${product.name}.`)) ?? undefined}
                        target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 text-nrs-ink/70 underline underline-offset-4 hover:text-nrs-ink">
                        <Ruler size={14} strokeWidth={1.5} aria-hidden="true" />
                        {copy('Bedeninizi WhatsApp’tan danışın', 'Ask about your size on WhatsApp', 'استشيري مقاسك عبر واتساب')}
                      </a>}
                    </span>
                  </div>
                  <div role="group" aria-label={copy('Beden seçin', 'Select a size', 'اختاري المقاس')} aria-describedby={orderError ? 'product-size-error' : undefined} className="flex flex-wrap gap-3">
                    {variants.map((variant) => (
                      <button
                        key={variant.label}
                        type="button"
                        disabled={!variant.id || (!madeToOrder && variant.stock < 1)}
                        onClick={() => { setSelectedVariantId(variant.id); setOrderError(''); setQuantity(1); }}
                        aria-pressed={selectedVariantId === variant.id}
                        className={`min-w-12 h-12 px-3 text-xs font-sans transition-all duration-500 border disabled:cursor-not-allowed disabled:opacity-35 ${
                          selectedVariantId === variant.id
                            ? 'bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory border-nrs-ink'
                            : 'bg-transparent text-nrs-ink border-nrs-ink/20 hover:border-nrs-ink'
                        }`}
                      >
                        {variant.size ? sizeButtonLabel(variant.label) : variant.label}
                      </button>
                    ))}
                  </div>
                  {selectedRow && <p className="text-xs leading-5 text-nrs-ink/65">{copy(
                    `${selectedRow.letter} · ${selectedRow.numeric} beden, vücut ölçüsü göğüs ${selectedRow.chest.join('–')}, bel ${selectedRow.waist.join('–')}, basen ${selectedRow.hips.join('–')} cm olanlara göre dikilir.`,
                    `Size ${selectedRow.letter} · ${selectedRow.numeric} is cut for a ${selectedRow.chest.join('–')} cm bust, ${selectedRow.waist.join('–')} cm waist and ${selectedRow.hips.join('–')} cm hips.`,
                    `يُخاط المقاس ${selectedRow.letter} · ${selectedRow.numeric} لصدر ${selectedRow.chest.join('–')} وخصر ${selectedRow.waist.join('–')} وورك ${selectedRow.hips.join('–')} سم.`)}</p>}
                  {measurementSummary && <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-nrs-ink/75">
                    <span>{copy('Siparişe eklenecek ölçüleriniz:', 'Measurements added to your order:', 'القياسات التي ستُضاف إلى طلبك:')} <span className="tabular-nums">{measurementSummary} cm</span></span>
                    <button type="button" onClick={() => setBodyMeasurements(null)} className="underline underline-offset-4 text-nrs-ink/60 hover:text-nrs-ink">{copy('Kaldır', 'Remove', 'إزالة')}</button>
                  </p>}
                  {orderError && <p id="product-size-error" role="alert" className="text-sm text-red-700">{orderError}</p>}
                  </>}
                </div>

                <div className="flex flex-col gap-4 pt-4">
                  <label className="flex items-center justify-between gap-4 text-xs text-nrs-ink/65">
                    {copy('Adet', 'Quantity', 'الكمية')}
                    <input type="number" min={1} value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                      className="min-h-12 w-20 border border-nrs-ink/20 bg-transparent px-3 text-nrs-ink" />
                  </label>
                  <button
                    onClick={() => addSelection()}
                    disabled={!product.inStock || !hasRealVariantInventory}
                    className="w-full bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory py-5 uppercase tracking-widest text-xs font-sans enabled:hover:bg-white enabled:hover:text-nrs-ink transition-all duration-700 flex items-center justify-center gap-3"
                  >
                    <ShoppingBag size={18} />
                    {t('addToBag')}
                  </button>
                  <button type="button" onClick={() => addSelection(true)}
                    disabled={!product.inStock || !hasRealVariantInventory}
                    className="flex min-h-12 w-full items-center justify-center border border-nrs-ink/25 px-4 py-4 text-center text-xs uppercase tracking-widest text-nrs-ink enabled:hover:bg-nrs-ink enabled:hover:text-nrs-canvas disabled:cursor-not-allowed disabled:opacity-40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    {copy('Ödeme / Siparişe geç', 'Continue to checkout', 'المتابعة إلى الدفع')}
                  </button>
                  <CardPaymentNotice id="product-card-payment-status" />
                  {hasSizeChart && <p className="text-xs leading-5 text-nrs-ink/60">{copy('Bedeninizden emin değilseniz “Bedenimi bul” ile ölçülerinizi girin; atölyemiz dikimde ölçülerinizi esas alır.', 'Not sure about your size? Use “Find my size” to add your measurements; our atelier cuts to them.', 'غير متأكدة من مقاسك؟ استخدمي «اعرفي مقاسك» لإضافة قياساتك؛ وسيعتمدها مشغلنا عند الخياطة.')}</p>}
                  <button type="button" disabled={!product.inStock || !hasRealVariantInventory || !whatsappNumber}
                    aria-label={copy(`WhatsApp üzerinden ${product.name} için sipariş ver`, `Request ${product.name} on WhatsApp`, `اطلبي ${product.name} عبر واتساب`)}
                    aria-describedby={orderError ? 'product-size-error' : undefined}
                    onClick={() => {
                      const variant = selectedVariant || variants.find(variant => !variant.size);
                      const error = whatsappSelectionError({ requiresSize: variants.some(variant => Boolean(variant.size)),
                        selected: Boolean(selectedVariant), stock: madeToOrder ? undefined : variant?.stock, quantity });
                      if (error) { setOrderError(error); return; }
                      const message = buildWhatsappOrderMessage([{
                        id: product.id, slug: product.slug, name: product.name, size: variant?.size || undefined, quantity,
                        unitPrice: product.priceAmount ?? parsePrice(product.price), compareAtPrice: product.compareAtPrice, currency: product.currency,
                      }], undefined, undefined, { locale, rate });
                      const href = whatsappUrl(message || undefined);
                      if (href) { setOrderError(''); window.open(href, '_blank', 'noopener,noreferrer'); }
                    }}
                    className="flex min-h-12 w-full items-center justify-center gap-3 border border-nrs-ink/25 bg-transparent px-4 py-4 uppercase tracking-widest text-xs text-nrs-ink enabled:hover:border-nrs-ink enabled:hover:bg-nrs-panel transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    <WhatsAppIcon />
                    {copy('WhatsApp ile sipariş talebi', 'Request via WhatsApp', 'طلب عبر واتساب')}
                  </button>
                  <details className="group border-t border-nrs-ink/10 pt-3">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs uppercase tracking-widest text-nrs-ink/70 [&::-webkit-details-marker]:hidden">
                      {copy('Havale / EFT ile ödeme', 'Pay by bank transfer', 'الدفع بالتحويل البنكي')}
                      <span aria-hidden="true" className="text-base transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <div className="pt-2"><BankTransferInfo /></div>
                  </details>
                </div>
              </div>

              <div className="space-y-10">
                <div className="space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-nrs-ink font-medium">{copy('Ürün hikayesi', 'Product story', 'قصة المنتج')}</h3>
                  {(() => {
                    const story = parseProductDescription(product.description)
                    return <div className="space-y-4 font-sans text-[15px] leading-7 text-nrs-ink/70">
                      {story.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                      {story.bullets.length > 0 && <div className="space-y-3 pt-2">
                        {story.heading && <p className="text-[10px] uppercase tracking-[0.2em] text-nrs-ink/55">{story.heading}</p>}
                        <ul className="divide-y divide-nrs-ink/10 border-y border-nrs-ink/10">
                          {story.bullets.map((bullet, index) => <li key={index} className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                            {bullet.label && <span className="text-xs uppercase tracking-widest text-nrs-ink">{bullet.label}</span>}
                            <span className={bullet.label ? '' : 'sm:col-span-2'}>{bullet.text}</span>
                          </li>)}
                        </ul>
                      </div>}
                    </div>
                  })()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest text-nrs-ink/60 font-bold">{t('details')}</h4>
                    <ul className="text-sm font-sans text-nrs-ink/70 space-y-2">
                      {product.details.fabric && <li>{product.details.fabric}</li>}
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest text-nrs-ink/60 font-bold">{copy('Kalıp ve bakım', 'Fit and care', 'القصة والعناية')}</h4>
                    <p className="text-sm font-sans text-nrs-ink/70 leading-relaxed">{product.details.care || copy('Ürün etiketindeki bakım talimatlarını izlemenizi öneririz.', 'Please follow the care instructions on the garment label.', 'يُرجى اتباع تعليمات العناية الموجودة على ملصق القطعة.')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SizeGuideDialog open={sizeGuideOpen} onClose={closeSizeGuide} productName={product.name} availableSizes={sizeLabels}
        initialMeasurements={bodyMeasurements ?? undefined}
        onApply={(size, measurements) => {
          const variant = variants.find((item) => item.label === size)
          if (variant?.id) { setSelectedVariantId(variant.id); setOrderError('') }
          setBodyMeasurements(measurements && Object.keys(measurements).length ? measurements : null)
        }} />
    </div>
  );
}
