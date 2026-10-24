'use client'

import { DELIVERY_TERMS } from '@/lib/delivery-policy'
import { m as motion } from 'framer-motion'
import { getCartItemId, parsePrice, useCart } from '@/store/useCart'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingBag, Check } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import CartWhatsappOrder from '@/components/CartWhatsappOrder'
import { useCardPaymentEnabled } from '@/lib/feature-flags'
import CheckoutLegalConsent from '@/components/legal/CheckoutLegalConsent'
import LegalOrderSummary from '@/components/legal/LegalOrderSummary'
import CardPaymentNotice from '@/components/payment/CardPaymentNotice'
import { withLegalAcceptance } from '@/lib/legal/acceptance'
import type { Quote } from '@/lib/payment/types'
import type { LegalOrderSummary as OrderSummary } from '@/lib/legal/order-summary'

import { MEASUREMENT_RANGES, measurementFields, validateOptionalMeasurements, type Measurements } from '@/lib/order-measurements'
import { useLocale } from '@/context/LocaleContext'
import { formatMinor } from '@/lib/i18n/money'
import { formatLocalizedMeasurements, measurementHelp, measurementLabel } from '@/lib/i18n/measurements'
import { cartCatalogSyncScope } from '@/lib/cart-catalog-sync'
import { randomUuid } from '@/lib/uuid'

export default function Checkout() {
  const { locale, money, t, fxAvailable } = useLocale()
  const ENABLE_CARD_PAYMENT = useCardPaymentEnabled()
  const { items, subtotalAmount, discountAmount, shippingAmount, totalAmount, updateMeasurements, replaceItemVariant, activeCartVariants, catalogPricesSynced, catalogPricesSyncedFor, catalogSyncFailed, priceUpdateNotice } = useCart()
  const { user, profile, loading: authLoading, profileLoading } = useAuth()
  const [step, setStep] = useState(2) // Customer details are the first checkout screen; account sign-in is optional.
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)
  const [acceptedSnapshot, setAcceptedSnapshot] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<{ message: string; errorCode?: string; trackingNumber?: string; payment?: boolean } | null>(null)
  const legalError = checkoutError && !checkoutError.payment ? checkoutError.message : ''
  const paymentFailure = checkoutError?.payment ? checkoutError : null
  const setLegalError = (message: string) => setCheckoutError(message ? { message } : null)
  const setPaymentFailure = (failure: { message: string; errorCode?: string; trackingNumber?: string } | null) =>
    setCheckoutError(failure ? { ...failure, payment: true } : null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteKey, setQuoteKey] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [measurements, setMeasurements] = useState<Record<string, Measurements>>(() => Object.fromEntries(items.map(item => [getCartItemId(item), item.measurements || {}])))
  const [showMeasurements, setShowMeasurements] = useState(false)
  const [measurementErrorId, setMeasurementErrorId] = useState<string | null>(null)
  const [invalidVariantProductId, setInvalidVariantProductId] = useState<string | null>(null)
  const [savedOrder, setSavedOrder] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    address: '',
    city: '',
    district: '',
    postalCode: '',
    orderNote: '',
  })
  const [pendingOrderUrl, setPendingOrderUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!user || authLoading) return
    const metadata = user.user_metadata ?? {}
    setFormData(current => ({
      ...current,
      firstName: current.firstName || profile?.first_name || (typeof metadata.first_name === 'string' ? metadata.first_name : ''),
      lastName: current.lastName || profile?.last_name || (typeof metadata.last_name === 'string' ? metadata.last_name : ''),
      email: current.email || profile?.email || user.email || '',
      phone: current.phone || profile?.phone || (typeof metadata.phone === 'string' ? metadata.phone : ''),
    }))
  }, [authLoading, profile, user])

  const inputKey = JSON.stringify({ items, measurements, formData, subtotalAmount, discountAmount, shippingAmount, totalAmount })
  const confirmedQuote = quoteKey === inputKey ? quote : null
  const snapshotKey = JSON.stringify({ inputKey, quoteHash: confirmedQuote?.hash })
  const checkoutInput = () => ({ items: items.map(item => {
    const itemMeasurements = measurements[getCartItemId(item)] ?? item.measurements ?? {}
    return { productId: item.id, variantId: item.variantId, quantity: item.quantity,
      ...(Object.keys(itemMeasurements).length ? { measurements: itemMeasurements } : {}) }
  }), customer: formData })
  const contractAccepted = acceptedSnapshot === snapshotKey || acceptedSnapshot === inputKey
  const cartSyncScope = cartCatalogSyncScope(locale, user?.id ?? null, items.map(item => item.id))
  const cartReady = catalogPricesSynced && catalogPricesSyncedFor === cartSyncScope
  const customerFieldError = (field: string, reason: string) => {
    const labels: Record<string, string> = { firstName: t('firstName'), lastName: t('lastName'), email: t('email'), phone: t('phone'), address: t('address'), city: t('city'), district: t('district'), postalCode: t('postalCode') }
    if (field === 'email' && reason === 'format') return locale === 'en' ? 'Enter a valid email address.' : locale === 'ar' ? 'أدخلي بريداً إلكترونياً صالحاً.' : 'Geçerli bir e-posta adresi girin.'
    if (field === 'phone' && reason === 'format') return locale === 'en' ? 'Enter a valid phone number.' : locale === 'ar' ? 'أدخلي رقم هاتف صالحاً.' : 'Geçerli bir telefon numarası girin.'
    if (field === 'postalCode' && reason === 'format') return locale === 'en' ? 'Enter a 5-digit postal code.' : locale === 'ar' ? 'أدخلي رمزاً بريدياً من 5 أرقام.' : '5 haneli posta kodu girin.'
    const label = labels[field] || t('customerDelivery')
    return reason === 'required'
      ? (locale === 'en' ? `${label} is required.` : locale === 'ar' ? `${label} مطلوب.` : `${label} girmeniz gerekir.`)
      : (locale === 'en' ? `Check ${label.toLowerCase()}.` : locale === 'ar' ? `تحققي من ${label}.` : `${label} bilgisini kontrol edin.`)
  }
  const updateCustomer = (field: keyof typeof formData, value: string) => {
    setFormData(current => ({ ...current, [field]: value }))
    setFieldErrors(current => ({ ...current, [field]: '' }))
  }
  const previewSummary: OrderSummary = {
    items: items.map(item => {
      const normalMinor = Math.round(parsePrice(item.price) * 100)
      return { productId: item.id, name: item.title,
      description: 'Temel özellikler ürün sayfasında yer alır; varsa özel üretim koşulları sipariş teyidinde bildirilir.',
      ...(item.size ? { size: item.size } : {}),
      ...((measurements[getCartItemId(item)] ?? item.measurements) && Object.keys(measurements[getCartItemId(item)] ?? item.measurements ?? {}).length
        ? { measurements: measurements[getCartItemId(item)] ?? item.measurements } : {}), quantity: item.quantity,
      unitPrice: normalMinor / 100
    }}),
    buyer: { name: [formData.firstName, formData.lastName].filter(Boolean).join(' '), email: formData.email,
      phone: formData.phone, address: [formData.address, formData.district, formData.city, formData.postalCode].filter(Boolean).join(', ') },
    orderNote: formData.orderNote,
    subtotal: subtotalAmount, discount: discountAmount,
    shipping: 0,
    total: totalAmount, currency: 'TRY', paymentMethod: 'Havale / EFT — sipariş teyidinden sonra',
    deliveryTerms: DELIVERY_TERMS,
  }

  const orderSummary = confirmedQuote?.summary ?? previewSummary
  const invalidVariantItem = items.find(item => item.id === invalidVariantProductId)
  const summaryDisplay = orderSummary.display
  const summaryRate = summaryDisplay?.currency === 'USD' && summaryDisplay.exchangeRate !== null && summaryDisplay.exchangeRateAt
    ? { usdTry: summaryDisplay.exchangeRate, fetchedAt: summaryDisplay.exchangeRateAt, rateDate: summaryDisplay.exchangeRateDate ?? undefined } : null
  const displaySummaryMoney = (amountTry: number) => summaryDisplay
    ? formatMinor(Math.round(amountTry * 100 / (summaryDisplay.currency === 'USD' && summaryRate ? summaryRate.usdTry : 1)), summaryDisplay.locale, summaryRate)
    : money(amountTry)
  async function reviewPayment() {
    if (busy) return
    if (authLoading || (user && profileLoading) || !cartReady) return
    if (ENABLE_CARD_PAYMENT && acceptedSnapshot !== inputKey) { setLegalError(t('checkoutConsentError')); return }
    const errors: Record<string, string> = {}
    if (!formData.firstName.trim()) errors.firstName = `${t('firstName')} ${locale === 'en' ? 'is required.' : locale === 'ar' ? 'مطلوب.' : 'girmeniz gerekir.'}`
    if (!formData.lastName.trim()) errors.lastName = `${t('lastName')} ${locale === 'en' ? 'is required.' : locale === 'ar' ? 'مطلوب.' : 'girmeniz gerekir.'}`
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = locale === 'en' ? 'Enter a valid email address.' : locale === 'ar' ? 'أدخلي بريداً إلكترونياً صالحاً.' : 'Geçerli bir e-posta adresi girin.'
    if (!/^[+()\d\s-]{10,25}$/.test(formData.phone.trim())) errors.phone = customerFieldError('phone', formData.phone.trim() ? 'format' : 'required')
    if (!formData.address.trim()) errors.address = `${t('address')} ${locale === 'en' ? 'is required.' : locale === 'ar' ? 'مطلوب.' : 'girmeniz gerekir.'}`
    if (!formData.city.trim()) errors.city = `${t('city')} ${locale === 'en' ? 'is required.' : locale === 'ar' ? 'مطلوبة.' : 'bilgisini girin.'}`
    if (!formData.district.trim()) errors.district = `${t('district')} ${locale === 'en' ? 'is required.' : locale === 'ar' ? 'مطلوبة.' : 'bilgisini girin.'}`
    if (!/^\d{5}$/.test(formData.postalCode)) errors.postalCode = locale === 'en' ? 'Enter a 5-digit postal code.' : locale === 'ar' ? 'أدخلي رمزاً بريدياً من 5 أرقام.' : '5 haneli posta kodu girin.'
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      setLegalError('')
      document.getElementById(`checkout-${Object.keys(errors)[0]}`)?.focus()
      return
    }
    for (const item of items) {
      const itemId = getCartItemId(item)
      try { validateOptionalMeasurements(measurements[itemId] ?? item.measurements) }
      catch {
        setShowMeasurements(true)
        setMeasurementErrorId(itemId)
        setLegalError('')
        requestAnimationFrame(() => document.getElementById(`checkout-measurements-${encodeURIComponent(itemId)}`)?.focus())
        return
      }
    }
    setSavedOrder(null)
    setBusy(true)
    setPaymentFailure(null)
    setLegalError('')
    try {
      const response = await fetch(ENABLE_CARD_PAYMENT ? '/api/payment/quote' : '/api/orders/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checkoutInput()) })
      const data = await response.json()
      if (!response.ok) {
        if (data.code === 'VARIANT_UNAVAILABLE' && typeof data.productId === 'string') {
          setInvalidVariantProductId(data.productId)
          setLegalError(t('cartSizeInvalid'))
          return
        }
        if (data.code === 'CUSTOMER_FIELD_INVALID' && typeof data.field === 'string') {
          const fields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'district', 'postalCode']
          if (fields.includes(data.field)) {
            setFieldErrors(current => ({ ...current, [data.field]: customerFieldError(data.field, data.reason) }))
            setLegalError('')
            document.getElementById(`checkout-${data.field}`)?.focus()
            return
          }
        }
        throw new Error(data.error || 'Sipariş özeti doğrulanamadı.')
      }
      setInvalidVariantProductId(null)
      const paymentKey = !idempotencyKey || quoteKey !== inputKey ? randomUuid() : idempotencyKey
      setQuote(data); setQuoteKey(inputKey); setAcceptedSnapshot(ENABLE_CARD_PAYMENT ? inputKey : null); setIdempotencyKey(paymentKey)
      if (ENABLE_CARD_PAYMENT) {
        const payload = withLegalAcceptance({ ...checkoutInput(), quoteHash: data.hash, idempotencyKey: paymentKey }, true)
        if (!user) {
          const access = await fetch('/api/payment/guest-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          if (!access.ok) throw new Error('Guest access could not be prepared.')
        }
        const paymentResponse = await fetch('/api/payment/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const payment = await paymentResponse.json()
        if (!paymentResponse.ok) {
          if (typeof payment.resumeUrl === 'string' && /^\/checkout\/verify\?orderId=[0-9a-f-]{36}$/i.test(payment.resumeUrl)) setPendingOrderUrl(payment.resumeUrl)
          const errorCode = typeof payment.errorCode === 'string' && /^NRS-PAY-[A-Z]+$/.test(payment.errorCode) ? payment.errorCode : undefined
          const trackingNumber = typeof payment.trackingNumber === 'string' && /^[A-F0-9]{16}$/.test(payment.trackingNumber) ? payment.trackingNumber : undefined
          setPaymentFailure({
            message: 'Sonuç belirsizse yeniden ödeme başlatmayın; destek ekibimizle iletişime geçin.',
            ...(errorCode && trackingNumber ? { errorCode, trackingNumber } : {}),
          })
          return
        }
        if (typeof payment.redirectUrl !== 'string' || !payment.redirectUrl.startsWith('https://')) throw new Error('Payment redirect could not be verified.')
        window.location.assign(payment.redirectUrl)
      } else setStep(3)
    } catch {
      setPaymentFailure({ message: ENABLE_CARD_PAYMENT
        ? 'Ödeme başlatılamadı. Sonuç belirsizse yeniden ödeme başlatmayın; destek ekibimizle iletişime geçin.'
        : t('checkoutQuoteError') })
    }
    finally { setBusy(false) }
  }
  async function saveManualOrder() {
    if (busy || !confirmedQuote || !contractAccepted) { setLegalError(t('checkoutConsentError')); return }
    setBusy(true); setLegalError('')
    try {
      const response = await fetch('/api/orders/create', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withLegalAcceptance({ ...checkoutInput(), quoteHash: confirmedQuote.hash, idempotencyKey }, contractAccepted)) })
      const result = await response.json()
      if (!response.ok || !result.orderId || result.paid !== false) throw new Error(result.error || 'Sipariş kaydedilemedi.')
      setSavedOrder(result.orderId)
    } catch { setLegalError(t('checkoutSaveError')) }
    finally { setBusy(false) }
  }

  if (!hydrated) return <main className="min-h-screen pt-[calc(var(--nrs-header-height)+3rem)] text-center">{t('checkoutLoading')}</main>

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nrs-canvas">
        <div className="max-w-md px-6 py-32 text-center">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-nrs-panel"><ShoppingBag size={26} className="text-nrs-ink/55" /></span>
          <h2 className="mb-3 font-serif text-3xl text-nrs-ink">{t('bagEmptyTitle')}</h2>
          <p className="mb-8 text-sm leading-6 text-nrs-ink/60">{t('bagEmptyBody')}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory px-8 py-3 text-xs uppercase tracking-widest hover:bg-nrs-black/90 transition-colors"
          >
            {t('exploreCollection')}
          </button>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-nrs-canvas">
      <main className="min-w-0 pt-[calc(var(--nrs-header-height)+1.5rem)] pb-12 sm:pt-[calc(var(--nrs-header-height)+2.5rem)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4 sm:mb-9">
            <div>
            {ENABLE_CARD_PAYMENT && step <= 3 && (
              <button
                onClick={() => (step <= 2 ? router.push('/') : setStep(step - 1))}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-nrs-ink/60 hover:text-nrs-ink transition-colors mb-6 group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                {step <= 2 ? t('returnShopping') : t('previousStep')}
              </button>
            )}
            <h1 className="mb-2 font-serif text-3xl text-nrs-ink sm:text-4xl">{ENABLE_CARD_PAYMENT ? t('checkoutTitle') : t('orderRequest')}</h1>
            <p className="text-sm text-nrs-ink/60">{t('chosenItemsReady')}</p>
            </div>
            {!ENABLE_CARD_PAYMENT && <ol aria-label={t('orderSteps')} className="flex items-center gap-2 pt-1 text-xs text-nrs-ink/55 sm:gap-3">
              {[t('stepInformation'), t('stepSummary'), t('stepApproval')].map((label, index) => <li key={label} className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${step >= index + 1 ? 'border-nrs-ink bg-nrs-ink text-nrs-ivory' : 'border-nrs-ink/20'}`}>{step > index + 1 ? <Check size={14} /> : index + 1}</span>
                <span className="hidden sm:inline">{label}</span>
              </li>)}
            </ol>}
          </div>

          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,370px)] lg:gap-10">
          <section className="min-w-0 space-y-7">
            {(!ENABLE_CARD_PAYMENT || step === 2) && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <h2 className="font-serif text-2xl text-nrs-ink">{t('customerDelivery')}</h2>
                <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-firstName" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">{t('firstName')}</label>
                    <input
                      type="text"
                      id="checkout-firstName" autoComplete="given-name" value={formData.firstName}
                      aria-invalid={Boolean(fieldErrors.firstName)} aria-describedby={fieldErrors.firstName ? 'checkout-firstName-error' : undefined}
                      onChange={(e) => updateCustomer('firstName', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.firstName ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder={t('firstName')}
                    />
                    {fieldErrors.firstName && <p id="checkout-firstName-error" className="text-xs text-red-700">{fieldErrors.firstName}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-lastName" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">{t('lastName')}</label>
                    <input
                      type="text"
                      id="checkout-lastName" autoComplete="family-name" value={formData.lastName}
                      aria-invalid={Boolean(fieldErrors.lastName)} aria-describedby={fieldErrors.lastName ? 'checkout-lastName-error' : undefined}
                      onChange={(e) => updateCustomer('lastName', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.lastName ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder={t('lastName')}
                    />
                    {fieldErrors.lastName && <p id="checkout-lastName-error" className="text-xs text-red-700">{fieldErrors.lastName}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-email" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">{t('email')}</label>
                    <input
                      type="email"
                      id="checkout-email" autoComplete="email" value={formData.email}
                      aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'checkout-email-error' : undefined}
                      onChange={(e) => updateCustomer('email', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.email ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder="email@example.com"
                    />
                    {fieldErrors.email && <p id="checkout-email-error" className="text-xs text-red-700">{fieldErrors.email}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-phone" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">{t('phone')}</label>
                    <input
                      type="text"
                      id="checkout-phone" autoComplete="tel" value={formData.phone}
                      aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'checkout-phone-error' : undefined}
                      onChange={(e) => updateCustomer('phone', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.phone ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder="+90 ..."
                    />
                    {fieldErrors.phone && <p id="checkout-phone-error" className="text-xs text-red-700">{fieldErrors.phone}</p>}
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
                    <label htmlFor="checkout-address" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">{t('address')}</label>
                    <textarea
                      id="checkout-address" autoComplete="street-address" value={formData.address}
                      aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? 'checkout-address-error' : undefined}
                      onChange={(e) => updateCustomer('address', e.target.value)}
                      className={`w-full min-w-0 resize-y border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.address ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder={t('addressPlaceholder')}
                      rows={3}
                    />
                    {fieldErrors.address && <p id="checkout-address-error" className="text-xs text-red-700">{fieldErrors.address}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-city" className="text-xs uppercase tracking-widest text-nrs-ink/60">{t('city')}</label>
                    <input
                      type="text"
                      id="checkout-city" autoComplete="address-level1" value={formData.city}
                      aria-invalid={Boolean(fieldErrors.city)} aria-describedby={fieldErrors.city ? 'checkout-city-error' : undefined}
                      onChange={(e) => updateCustomer('city', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.city ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder={t('city')}
                    />
                    {fieldErrors.city && <p id="checkout-city-error" className="text-xs text-red-700">{fieldErrors.city}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-district" className="text-xs uppercase tracking-widest text-nrs-ink/60">{t('district')}</label>
                    <input
                      type="text"
                      id="checkout-district" autoComplete="address-level2" value={formData.district}
                      aria-invalid={Boolean(fieldErrors.district)} aria-describedby={fieldErrors.district ? 'checkout-district-error' : undefined}
                      onChange={(e) => updateCustomer('district', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.district ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder={t('district')}
                    />
                    {fieldErrors.district && <p id="checkout-district-error" className="text-xs text-red-700">{fieldErrors.district}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-postalCode" className="text-xs uppercase tracking-widest text-nrs-ink/60">{t('postalCode')}</label>
                    <input
                      type="text"
                      id="checkout-postalCode" autoComplete="postal-code" value={formData.postalCode}
                      aria-invalid={Boolean(fieldErrors.postalCode)} aria-describedby={fieldErrors.postalCode ? 'checkout-postalCode-error' : undefined}
                      onChange={(e) => updateCustomer('postalCode', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.postalCode ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder={t('postalCode')}
                    />
                    {fieldErrors.postalCode && <p id="checkout-postalCode-error" className="text-xs text-red-700">{fieldErrors.postalCode}</p>}
                  </div>
                </div>
                <div className="space-y-4">
                  <details className="rounded-sm border border-nrs-ink/15 px-4 py-3">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium underline underline-offset-4">{t('orderNoteOptional')}</summary>
                    <label className="mt-2 block text-sm" htmlFor="checkout-order-note">{t('orderNoteOptional')}
                      <textarea id="checkout-order-note" value={formData.orderNote} maxLength={2000} onChange={e => setFormData({ ...formData, orderNote: e.target.value })} className="mt-2 min-h-24 w-full border border-nrs-ink/20 bg-transparent p-3" />
                    </label>
                  </details>
                  <details open={showMeasurements} onToggle={event => setShowMeasurements(event.currentTarget.open)} className="rounded-sm border border-nrs-ink/15 px-4 py-3">
                    <summary id="checkout-measurements-summary" tabIndex={-1} className="min-h-11 cursor-pointer py-2 text-sm font-medium underline underline-offset-4">{t('measurementsTitle')}</summary>
                    <p className="pb-3 text-sm leading-6 text-nrs-ink/65">{t('measurementsHelp')}</p>
                    <div className="space-y-3">{items.map(item => {
                      const itemId = getCartItemId(item)
                      const itemMeasurements = measurements[itemId] ?? item.measurements ?? {}
                      return <fieldset key={itemId} className="min-w-0 border border-nrs-ink/15 p-4">
                        <legend className="max-w-full break-words px-1 text-sm">{item.title} · {t('sizeLabel')} {item.size || '—'}</legend>
                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">{measurementFields((item.category || '') + ' ' + item.title).map(field => <label key={field} className="min-w-0 break-words text-sm">{measurementLabel(locale, field)} ({locale === 'ar' ? 'سم' : 'cm'}) <span className="text-xs text-nrs-ink/55">({t('measurementOptional')})</span>
                          <input type="number" min={MEASUREMENT_RANGES[field][0]} max={MEASUREMENT_RANGES[field][1]} step="0.1" value={itemMeasurements[field] ?? ''} aria-invalid={measurementErrorId === itemId} onChange={event => {
                            const values = { ...itemMeasurements }
                            if (event.target.value === '') delete values[field]; else values[field] = Number(event.target.value)
                            setMeasurements(current => ({ ...current, [itemId]: values }))
                            try { const safeValues = validateOptionalMeasurements(values); updateMeasurements(itemId, safeValues); setMeasurementErrorId(null) }
                            catch { setMeasurementErrorId(itemId) }
                          }} className="mt-1 min-h-11 w-full min-w-0 rounded-sm border border-nrs-ink/20 bg-transparent px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" />
                          <span className="block text-xs leading-5 text-nrs-ink/60">{measurementHelp(locale, field)}</span>
                        </label>)}</div>
                        {measurementErrorId === itemId && <p id={`checkout-measurements-${encodeURIComponent(itemId)}`} tabIndex={-1} role="alert" className="mt-3 text-sm text-red-700">{t('measurementValidationError')}</p>}
                      </fieldset>
                    })}</div>
                  </details>
                </div>
                {ENABLE_CARD_PAYMENT && <CheckoutLegalConsent accepted={acceptedSnapshot === inputKey} onChange={value => {
                  setAcceptedSnapshot(value ? inputKey : null); setLegalError('')
                }} error={legalError} />}
                {ENABLE_CARD_PAYMENT && (paymentFailure || legalError) && <div role="alert" aria-live="assertive" className="mt-6 space-y-2 rounded-sm border border-rose-800/30 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-950">
                  <p className="font-medium">{paymentFailure ? 'Ödeme başlatılamadı.' : legalError}</p>
                  {paymentFailure && <p>{paymentFailure.message}</p>}
                  {paymentFailure?.errorCode && paymentFailure.trackingNumber
                    ? <dl className="grid grid-cols-[auto_1fr] gap-x-2"><dt>Hata kodu:</dt><dd className="font-mono">{paymentFailure.errorCode}</dd><dt>Takip numarası:</dt><dd className="font-mono">{paymentFailure.trackingNumber}</dd></dl>
                    : null}
                  {paymentFailure?.errorCode && paymentFailure.trackingNumber && <p>Lütfen bu bilgileri destek ekibimizle paylaşın.</p>}
                </div>}
                <button
                  onClick={() => void reviewPayment()} disabled={busy || authLoading || (user !== null && profileLoading) || !cartReady}
                  className="mt-12 w-full bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory py-4 uppercase tracking-widest text-xs font-sans hover:bg-nrs-black/90 transition-all"
                >
                  {busy ? (ENABLE_CARD_PAYMENT ? t('bankRedirecting') : t('reviewingQuote')) : (!cartReady || (user !== null && profileLoading)) ? t('checkingCartPrices') : ENABLE_CARD_PAYMENT ? t('goToBank') : t('reviewSummary')}
                </button>
                {pendingOrderUrl && <Link href={pendingOrderUrl} className="inline-flex min-h-11 items-center text-sm underline">{t('resumeTestOrder')}</Link>}
                {cartReady && priceUpdateNotice && <p role="status" className="mt-3 text-sm text-nrs-ink/65">{t('cartUpdated')}</p>}
                {!cartReady && catalogSyncFailed && <p role="alert" className="mt-3 text-sm text-rose-700">
                  {locale === 'en' ? 'Prices could not be checked. Check your connection and reload the page.' : locale === 'ar' ? 'تعذر التحقق من الأسعار. تحققي من الاتصال وأعيدي تحميل الصفحة.' : 'Fiyatlar kontrol edilemedi. Bağlantınızı kontrol edip sayfayı yenileyin.'}{' '}
                  <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center underline underline-offset-4">{locale === 'en' ? 'Reload' : locale === 'ar' ? 'إعادة التحميل' : 'Sayfayı yenile'}</button>
                </p>}
                {invalidVariantItem && <div role="alert" className="space-y-2 rounded-sm border border-amber-800/30 bg-amber-50 p-3 text-sm">
                  <p>{t('cartSizeInvalid')}</p>
                  {(() => {
                    const options = activeCartVariants.filter(variant => variant.productId === invalidVariantItem.id
                      && !items.some(item => item !== invalidVariantItem && item.id === invalidVariantItem.id && item.variantId === variant.id))
                    return options.length ? <label className="block max-w-sm">
                      <span className="mb-1 block text-xs">{t('sizeLabel')}</span>
                      <select defaultValue="" onChange={event => {
                        const selected = options.find(option => option.id === event.target.value)
                        if (!selected) return
                        const updated = replaceItemVariant(getCartItemId(invalidVariantItem), selected.id, selected.size || undefined)
                        if (updated) {
                          setInvalidVariantProductId(null)
                          setQuote(null); setQuoteKey(''); setAcceptedSnapshot(null); setLegalError('')
                        }
                      }} className="min-h-11 w-full border border-nrs-ink/20 bg-white px-3">
                        <option value="" disabled>{t('removeAndReselectSize')}</option>
                        {options.map(option => <option key={option.id} value={option.id}>{option.size || t('sizeLabel')}</option>)}
                      </select>
                    </label> : <p className="text-xs text-nrs-ink/65">{t('noAvailableSizes')}</p>
                  })()}
                </div>}
              </motion.div>
            )}

            {(!ENABLE_CARD_PAYMENT || step === 3) && (
              <div className="space-y-5">
                <h2 className="font-serif text-2xl">{t('summaryApproval')}</h2>
                {confirmedQuote && <details className="rounded-sm border border-nrs-ink/15 bg-nrs-warm-white px-4 py-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm underline underline-offset-4">{t('viewOrderTerms')}</summary>
                  <div className="pt-3">{/* The server-quoted snapshot remains the source recorded with legal acceptance. */}
                    <LegalOrderSummary summary={orderSummary} preview={!confirmedQuote} />
                  </div>
                </details>}
                {!ENABLE_CARD_PAYMENT && <div className="space-y-3 border border-nrs-ink/15 p-4 sm:p-6">
                  <button type="button" disabled aria-describedby="checkout-card-payment-status"
                    className="flex min-h-12 w-full items-center justify-center bg-nrs-charcoal px-4 py-4 text-center text-xs uppercase tracking-widest text-nrs-ivory opacity-50 cursor-not-allowed">
                    {t('cardPayment')}
                  </button>
                  <CardPaymentNotice id="checkout-card-payment-status" />
                </div>}
                {!ENABLE_CARD_PAYMENT && confirmedQuote && <div className="space-y-3">
                  <CheckoutLegalConsent accepted={contractAccepted} onChange={value => setAcceptedSnapshot(value ? snapshotKey : null)} error={legalError} />
                  <button type="button" disabled={busy || !!savedOrder} onClick={() => void saveManualOrder()} className="w-full bg-nrs-charcoal py-4 text-nrs-ivory">{busy ? t('saving') : t('saveTransferRequest')}</button>
                  {savedOrder && <p role="status">{t('requestSaved')}: {savedOrder}. {t('paymentNotTaken')}</p>}
                </div>}
              </div>
            )}


          </section>
          <aside aria-label={t('orderSummary')} className="order-first min-w-0 lg:order-none lg:sticky lg:top-[calc(var(--nrs-header-height)+1.5rem)]">
            <details className="rounded-sm border border-nrs-ink/10 bg-nrs-panel/70 p-4 lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
                <span className="text-sm font-medium">{t('orderSummary')}</span>
                <span className="font-serif text-xl tabular-nums">{summaryDisplay ? formatMinor(summaryDisplay.totalMinor, summaryDisplay.locale, summaryRate) : displaySummaryMoney(orderSummary.total)}</span>
              </summary>
              <div className="pt-3">
                <ul className="divide-y divide-nrs-ink/10">
                  {orderSummary.items.map((item, index) => <li key={`mobile-${item.productId}-${index}`} className="flex min-w-0 items-center justify-between gap-3 py-3">
                    {item.image ? <Image src={item.image} alt="" width={56} height={70} unoptimized className="h-[70px] w-14 shrink-0 rounded-sm bg-nrs-canvas object-cover" /> : <span aria-hidden="true" className="h-[70px] w-14 shrink-0 rounded-sm bg-nrs-canvas" />}
                    <div className="min-w-0">
                      <p className="break-words text-sm leading-5">{item.name}</p>
                      <p className="mt-1 text-xs text-nrs-ink/55">{item.size ? <>{t('sizeLabel')} <bdi dir="ltr">{item.size}</bdi> · </> : ''}{item.quantity} {t('pieces')}</p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">{summaryDisplay?.itemLineMinor[index] !== undefined ? formatMinor(summaryDisplay.itemLineMinor[index], summaryDisplay.locale, summaryRate) : displaySummaryMoney(item.unitPrice * item.quantity)}</span>
                  </li>)}
                </ul>
                <dl className="space-y-2 border-t border-nrs-ink/10 pt-3 text-sm">
                  <div className="flex justify-between gap-3"><dt>{t('productTotal')}</dt><dd>{summaryDisplay ? formatMinor(summaryDisplay.subtotalMinor, summaryDisplay.locale, summaryRate) : displaySummaryMoney(orderSummary.subtotal)}</dd></div>
                  {orderSummary.discount > 0 && <div className="flex justify-between gap-3"><dt>{t('discount')}</dt><dd>−{summaryDisplay ? formatMinor(summaryDisplay.discountMinor, summaryDisplay.locale, summaryRate) : displaySummaryMoney(orderSummary.discount)}</dd></div>}
                  <div className="flex justify-between gap-3"><dt>{t('shipping')}</dt><dd>{orderSummary.shipping === null ? t('shippingConfirmed') : orderSummary.shipping === 0 ? t('free') : summaryDisplay ? formatMinor(summaryDisplay.shippingMinor, summaryDisplay.locale, summaryRate) : displaySummaryMoney(orderSummary.shipping)}</dd></div>
                  <div className="flex justify-between gap-3 border-t border-nrs-ink/10 pt-2 font-medium"><dt>{t('total')}</dt><dd>{summaryDisplay ? formatMinor(summaryDisplay.totalMinor, summaryDisplay.locale, summaryRate) : displaySummaryMoney(orderSummary.total)}</dd></div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-nrs-ink/60">{t('deliveryPromise')}</p>
                {locale !== 'tr' && <p className="mt-2 text-xs leading-5 text-nrs-ink/60">{fxAvailable ? t('currencyNote') : t('fxUnavailable')}</p>}
                {ENABLE_CARD_PAYMENT && confirmedQuote && <p className="mt-2 text-xs leading-5 text-nrs-ink/70">{t('paymentTry')} <bdi dir="ltr">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(orderSummary.total)}</bdi></p>}
              </div>
            </details>
            <section className="hidden rounded-sm border border-nrs-ink/10 bg-nrs-panel/70 p-4 sm:p-5 lg:block">
              <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-xl text-nrs-ink">{t('orderSummary')}</h2>
                <span className="text-xs text-nrs-ink/55">{orderSummary.items.reduce((sum, item) => sum + item.quantity, 0)} {t('items')}</span>
              </div>
              <ul className="divide-y divide-nrs-ink/10">
                {orderSummary.items.map((item, index) => <li key={`${item.productId}-${index}`} className="flex min-w-0 items-center justify-between gap-3 py-3">
                  {item.image ? <Image src={item.image} alt="" width={56} height={70} unoptimized className="h-[70px] w-14 shrink-0 rounded-sm bg-nrs-canvas object-cover" /> : <span aria-hidden="true" className="h-[70px] w-14 shrink-0 rounded-sm bg-nrs-canvas" />}
                  <div className="min-w-0">
                    <p className="break-words text-sm leading-5 text-nrs-ink">{item.name}</p>
                    <p className="mt-1 text-xs text-nrs-ink/55">{item.size ? <>{t('sizeLabel')} <bdi dir="ltr">{item.size}</bdi> · </> : ''}{item.quantity} {t('pieces')}</p>
                    {item.measurements && Object.keys(item.measurements).length > 0 && <details className="mt-1 min-w-0">
                      <summary className="inline-flex min-h-8 cursor-pointer items-center text-xs text-nrs-ink/60 underline underline-offset-2">{t('customMeasurements')}</summary>
                      <p className="break-words pb-1 text-xs leading-5 text-nrs-ink/60">{formatLocalizedMeasurements(item.measurements, locale) || t('measurementsUnspecified')}</p>
                    </details>}
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-nrs-ink">{summaryDisplay?.itemLineMinor[index] !== undefined ? formatMinor(summaryDisplay.itemLineMinor[index], summaryDisplay.locale, summaryRate) : displaySummaryMoney(item.unitPrice * item.quantity)}</span>
                </li>)}
              </ul>
              <dl className="space-y-2 border-t border-nrs-ink/10 pt-3 text-sm">
                <div className="flex justify-between gap-3 text-nrs-ink/65"><dt>{t('productTotal')}</dt><dd className="tabular-nums">{summaryDisplay ? formatMinor(summaryDisplay.subtotalMinor, summaryDisplay.locale, summaryRate) : displaySummaryMoney(orderSummary.subtotal)}</dd></div>
                {orderSummary.discount > 0 && <div className="flex justify-between gap-3 text-nrs-ink/65"><dt>{t('discount')}</dt><dd className="tabular-nums">−{summaryDisplay ? formatMinor(summaryDisplay.discountMinor, summaryDisplay.locale, summaryRate) : displaySummaryMoney(orderSummary.discount)}</dd></div>}
                <div className="flex justify-between gap-3 text-nrs-ink/65"><dt>{t('shipping')}</dt><dd>{orderSummary.shipping === null ? t('shippingConfirmed') : orderSummary.shipping === 0 ? t('free') : summaryDisplay ? formatMinor(summaryDisplay.shippingMinor, summaryDisplay.locale, summaryRate) : displaySummaryMoney(orderSummary.shipping)}</dd></div>
                <div className="flex items-baseline justify-between gap-3 border-t border-nrs-ink/10 pt-3 font-medium text-nrs-ink"><dt>{t('total')}</dt><dd className="font-serif text-2xl tabular-nums">{summaryDisplay ? formatMinor(summaryDisplay.totalMinor, summaryDisplay.locale, summaryRate) : displaySummaryMoney(orderSummary.total)}</dd></div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-nrs-ink/60">{t('deliveryPromise')}</p>
              {locale !== 'tr' && <p className="mt-2 text-xs leading-5 text-nrs-ink/60">{fxAvailable ? t('currencyNote') : t('fxUnavailable')}</p>}
              {ENABLE_CARD_PAYMENT && confirmedQuote && <p className="mt-2 border-t border-nrs-ink/10 pt-2 text-xs leading-5 text-nrs-ink/70">{t('paymentTry')} <bdi dir="ltr">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(orderSummary.total)}</bdi></p>}
              {!confirmedQuote && <p className="mt-3 text-xs leading-5 text-nrs-ink/55">{t('quotePending')}</p>}
            </section>
            <div className="mt-3">
              <CartWhatsappOrder items={items.map(item => {
                const itemMeasurements = measurements[getCartItemId(item)] ?? item.measurements ?? {}
                return { ...item, measurements: Object.keys(itemMeasurements).length ? itemMeasurements : undefined }
              })} total={orderSummary.total} customer={{ ...formData, orderId: confirmedQuote ? savedOrder || undefined : undefined }} compact />
            </div>
          </aside>
        </div>
        </div>
      </main>
    </div>
  )
}
