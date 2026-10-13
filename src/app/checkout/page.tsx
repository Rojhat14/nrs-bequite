'use client'

import { DELIVERY_TERMS } from '@/lib/delivery-policy'
import { m as motion } from 'framer-motion'
import { getCartItemId, parsePrice, useCart } from '@/store/useCart'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingBag, User, Check } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import AccountModal from '@/components/AccountModal'
import CartWhatsappOrder from '@/components/CartWhatsappOrder'
import { useCardPaymentEnabled } from '@/lib/feature-flags'
import CheckoutLegalConsent from '@/components/legal/CheckoutLegalConsent'
import LegalOrderSummary from '@/components/legal/LegalOrderSummary'
import LegalDocumentContent from '@/components/legal/LegalDocumentContent'
import CardPaymentNotice, { CARD_PAYMENT_COMING_SOON } from '@/components/payment/CardPaymentNotice'
import { getLegalDocument, LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import { withLegalAcceptance } from '@/lib/legal/acceptance'
import type { Quote } from '@/lib/payment/types'
import type { LegalOrderSummary as OrderSummary } from '@/lib/legal/order-summary'

import { MEASUREMENT_LABELS, MEASUREMENT_HELP, MEASUREMENT_RANGES, measurementFields, measurementKind, requiredMeasurements, validateRequiredMeasurements, type Measurements } from '@/lib/order-measurements'
import { formatMeasurements } from '@/lib/order-measurements'

const money = (amount: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)

export default function Checkout() {
  const ENABLE_CARD_PAYMENT = useCardPaymentEnabled()
  const { items, subtotalAmount, discountAmount, shippingAmount, totalAmount, updateMeasurements } = useCart()
  const { user, profile } = useAuth()
  const [step, setStep] = useState(1) // 1: Auth Choice, 2: Shipping, 3: Payment
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [acceptedSnapshot, setAcceptedSnapshot] = useState<string | null>(null)
  const [legalError, setLegalError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [paymentMessage, setPaymentMessage] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteKey, setQuoteKey] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [measurements, setMeasurements] = useState<Record<string, Measurements>>(() => Object.fromEntries(items.map(item => [getCartItemId(item), item.measurements || {}])))
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
    if (!profile) return
    setFormData(current => ({ ...current, firstName: current.firstName || profile.first_name || '', lastName: current.lastName || profile.last_name || '', email: current.email || profile.email || '', phone: current.phone || profile.phone || '' }))
  }, [profile])

  const inputKey = JSON.stringify({ items, measurements, formData, subtotalAmount, discountAmount, shippingAmount, totalAmount })
  const confirmedQuote = quoteKey === inputKey ? quote : null
  const snapshotKey = JSON.stringify({ inputKey, quoteHash: confirmedQuote?.hash })
  const checkoutInput = () => ({ items: items.map(item => ({ productId: item.id, variantId: item.variantId, quantity: item.quantity, measurements: measurements[getCartItemId(item)] ?? item.measurements ?? {} })), customer: formData })
  const contractAccepted = acceptedSnapshot === snapshotKey
  const updateCustomer = (field: keyof typeof formData, value: string) => {
    setFormData(current => ({ ...current, [field]: value }))
    setFieldErrors(current => ({ ...current, [field]: '' }))
  }
  const previewSummary: OrderSummary = {
    items: items.map(item => ({ productId: item.id, name: item.title,
      description: 'Temel özellikler ürün sayfasında yer alır; varsa özel üretim koşulları sipariş teyidinde bildirilir.',
      ...(item.size ? { size: item.size } : {}), measurements: measurements[getCartItemId(item)] ?? item.measurements ?? {}, quantity: item.quantity, unitPrice: parsePrice(item.price) })),
    buyer: { name: [formData.firstName, formData.lastName].filter(Boolean).join(' '), email: formData.email,
      phone: formData.phone, address: [formData.address, formData.district, formData.city, formData.postalCode].filter(Boolean).join(', ') },
    orderNote: formData.orderNote,
    subtotal: subtotalAmount, discount: discountAmount, shipping: 0,
    total: totalAmount, currency: 'TRY', paymentMethod: 'Havale / EFT — sipariş teyidinden sonra',
    deliveryTerms: DELIVERY_TERMS,
  }

  const orderSummary = confirmedQuote?.summary ?? previewSummary
  async function reviewPayment() {
    if (busy) return
    if (!user) { setAuthOpen(true); return }
    const errors: Record<string, string> = {}
    if (!formData.firstName.trim()) errors.firstName = 'Adınızı girin.'
    if (!formData.lastName.trim()) errors.lastName = 'Soyadınızı girin.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Geçerli bir e-posta adresi girin.'
    if (!formData.phone.trim()) errors.phone = 'Telefon numaranızı girin.'
    if (!formData.address.trim()) errors.address = 'Açık adresinizi girin.'
    if (!formData.city.trim()) errors.city = 'İl bilgisini girin.'
    if (!formData.district.trim()) errors.district = 'İlçe bilgisini girin.'
    if (!/^\d{5}$/.test(formData.postalCode)) errors.postalCode = '5 haneli posta kodu girin.'
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      setLegalError('')
      document.getElementById(`checkout-${Object.keys(errors)[0]}`)?.focus()
      return
    }
    try { for (const item of items) validateRequiredMeasurements(measurements[getCartItemId(item)] || item.measurements, measurementKind((item.category || '') + ' ' + item.title)) } catch (error) { setLegalError(error instanceof Error ? error.message : 'Ölçüleri doldurun.'); return }
    setSavedOrder(null)
    setBusy(true)
    setLegalError('')
    try {
      const response = await fetch(ENABLE_CARD_PAYMENT ? '/api/payment/quote' : '/api/orders/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checkoutInput()) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Sipariş özeti doğrulanamadı.')
      setQuote(data); setQuoteKey(inputKey); setAcceptedSnapshot(null)
      if (!idempotencyKey || quoteKey !== inputKey) setIdempotencyKey(crypto.randomUUID())
      setStep(3)
    } catch (error) { setLegalError(error instanceof Error ? error.message : 'Sipariş özeti doğrulanamadı.') }
    finally { setBusy(false) }
  }
  async function saveManualOrder() {
    if (busy || !confirmedQuote || !contractAccepted) { setLegalError('Özeti doğrulayın ve sözleşmeleri onaylayın.'); return }
    setBusy(true); setLegalError('')
    try {
      const response = await fetch('/api/orders/create', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withLegalAcceptance({ ...checkoutInput(), quoteHash: confirmedQuote.hash, idempotencyKey }, contractAccepted)) })
      const result = await response.json()
      if (!response.ok || !result.orderId || result.paid !== false) throw new Error(result.error || 'Sipariş kaydedilemedi.')
      setSavedOrder(result.orderId)
    } catch (error) { setLegalError(error instanceof Error ? error.message : 'Sipariş kaydedilemedi.') }
    finally { setBusy(false) }
  }

  async function prepareCardPayment() {
    if (busy) return
    if (!ENABLE_CARD_PAYMENT) { setPaymentMessage(CARD_PAYMENT_COMING_SOON); return }
    try {
      // Consent is checked BEFORE any payment request. Client commercial values
      // never reach payment/create; only IDs, quantity and approved quote hash.
      const payload = withLegalAcceptance({ ...checkoutInput(), quoteHash: confirmedQuote?.hash, idempotencyKey }, contractAccepted)
      if (!user) throw new Error('Kartla ödeme için hesabınıza giriş yapın.')
      if (!confirmedQuote) throw new Error('Ödeme öncesinde sipariş özetini yeniden doğrulayın.')
      setLegalError(''); setPendingOrderUrl(null); setBusy(true)
      const response = await fetch('/api/payment/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) {
        if (typeof data.resumeUrl === 'string' && /^\/checkout\/verify\?orderId=[0-9a-f-]{36}$/i.test(data.resumeUrl)) setPendingOrderUrl(data.resumeUrl)
        throw new Error(data.error || 'Ödeme başlatılamadı.')
      }
      if (typeof data.redirectUrl !== 'string' || !data.redirectUrl.startsWith('https://')) throw new Error('Ödeme yönlendirmesi doğrulanamadı.')
      window.location.assign(data.redirectUrl)
    } catch (error) {
      setLegalError(error instanceof Error ? error.message : 'Sözleşme onayı doğrulanamadı.')
      setPaymentMessage('')
    } finally { setBusy(false) }
  }

  if (!hydrated) return <main className="min-h-screen pt-[calc(var(--nrs-header-height)+3rem)] text-center">Sepet yükleniyor…</main>

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nrs-canvas">
        <div className="max-w-md px-6 py-32 text-center">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-nrs-panel"><ShoppingBag size={26} className="text-nrs-ink/55" /></span>
          <h2 className="mb-3 font-serif text-3xl text-nrs-ink">Sepetiniz boş</h2>
          <p className="mb-8 text-sm leading-6 text-nrs-ink/60">Gözünüze takılan parçaları sepetinize ekleyerek başlayın.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory px-8 py-3 text-xs uppercase tracking-widest hover:bg-nrs-black/90 transition-colors"
          >
            Koleksiyonu keşfet
          </button>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-nrs-canvas">
      <AccountModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <main className="min-w-0 pt-[calc(var(--nrs-header-height)+1.5rem)] pb-12 sm:pt-[calc(var(--nrs-header-height)+2.5rem)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4 sm:mb-9">
            <div>
            {ENABLE_CARD_PAYMENT && step <= 3 && (
              <button
                onClick={() => (step === 1 ? router.push('/') : setStep(step - 1))}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-nrs-ink/60 hover:text-nrs-ink transition-colors mb-6 group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                {step === 1 ? 'Alışverişe dön' : 'Önceki adım'}
              </button>
            )}
            <h1 className="mb-2 font-serif text-3xl text-nrs-ink sm:text-4xl">{ENABLE_CARD_PAYMENT ? 'Ödeme ve teslimat' : 'Sipariş talebi'}</h1>
            <p className="text-sm text-nrs-ink/60">Seçtiğiniz parçalar sizin için hazır.</p>
            </div>
            <ol aria-label="Sipariş adımları" className="flex items-center gap-2 pt-1 text-xs text-nrs-ink/55 sm:gap-3">
              {['Bilgiler', 'Özet', 'Onay'].map((label, index) => <li key={label} className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${step >= index + 1 ? 'border-nrs-ink bg-nrs-ink text-nrs-ivory' : 'border-nrs-ink/20'}`}>{step > index + 1 ? <Check size={14} /> : index + 1}</span>
                <span className="hidden sm:inline">{label}</span>
              </li>)}
            </ol>
          </div>

          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,370px)] lg:gap-10">
          <section className="min-w-0 space-y-7">
            {ENABLE_CARD_PAYMENT && step === 1 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                <h2 className="font-serif text-2xl text-nrs-ink">Hesabınızla devam edin</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => { if (!user) { setAuthOpen(true); return; } setStep(2); }}
                    className="p-8 border border-nrs-ink/10 hover:border-nrs-ink transition-all group flex flex-col items-center gap-4 text-center bg-nrs-panel"
                  >
                    <User size={32} className="text-nrs-ink group-hover:scale-110 transition-transform" />
                    <div>
                      <h3 className="font-serif text-lg text-nrs-ink">Hesabımla devam et</h3>
                    <p className="mt-2 text-sm leading-6 text-nrs-ink/60">Siparişlerinizi ve belgelerinizi hesabınızdan takip edin.</p>
                    </div>
                  </button>
                  <p className="p-5 text-sm leading-6 text-nrs-ink/65">Kartla ödeme ve sipariş belgelerine erişim için hesabınıza giriş yapın. Hesapsız sipariş talebinizi WhatsApp üzerinden iletebilirsiniz.</p>
                </div>
              </motion.div>
            )}

            {(!ENABLE_CARD_PAYMENT || step === 2) && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <h2 className="font-serif text-2xl text-nrs-ink">Müşteri ve teslimat bilgileri</h2>
                <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-firstName" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">Ad</label>
                    <input
                      type="text"
                      id="checkout-firstName" autoComplete="given-name" value={formData.firstName}
                      aria-invalid={Boolean(fieldErrors.firstName)} aria-describedby={fieldErrors.firstName ? 'checkout-firstName-error' : undefined}
                      onChange={(e) => updateCustomer('firstName', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.firstName ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder="Ad"
                    />
                    {fieldErrors.firstName && <p id="checkout-firstName-error" className="text-xs text-red-700">{fieldErrors.firstName}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-lastName" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">Soyad</label>
                    <input
                      type="text"
                      id="checkout-lastName" autoComplete="family-name" value={formData.lastName}
                      aria-invalid={Boolean(fieldErrors.lastName)} aria-describedby={fieldErrors.lastName ? 'checkout-lastName-error' : undefined}
                      onChange={(e) => updateCustomer('lastName', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.lastName ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder="Soyad"
                    />
                    {fieldErrors.lastName && <p id="checkout-lastName-error" className="text-xs text-red-700">{fieldErrors.lastName}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-email" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">E-posta</label>
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
                    <label htmlFor="checkout-phone" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">Telefon</label>
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
                    <label htmlFor="checkout-address" className="text-xs uppercase tracking-[0.12em] text-nrs-ink/65">Açık adres</label>
                    <textarea
                      id="checkout-address" autoComplete="street-address" value={formData.address}
                      aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? 'checkout-address-error' : undefined}
                      onChange={(e) => updateCustomer('address', e.target.value)}
                      className={`w-full min-w-0 resize-y border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.address ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder="Mahalle, sokak, bina, daire..."
                      rows={3}
                    />
                    {fieldErrors.address && <p id="checkout-address-error" className="text-xs text-red-700">{fieldErrors.address}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-city" className="text-xs uppercase tracking-widest text-nrs-ink/60">İl</label>
                    <input
                      type="text"
                      id="checkout-city" autoComplete="address-level1" value={formData.city}
                      aria-invalid={Boolean(fieldErrors.city)} aria-describedby={fieldErrors.city ? 'checkout-city-error' : undefined}
                      onChange={(e) => updateCustomer('city', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.city ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder="İl"
                    />
                    {fieldErrors.city && <p id="checkout-city-error" className="text-xs text-red-700">{fieldErrors.city}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-district" className="text-xs uppercase tracking-widest text-nrs-ink/60">İlçe</label>
                    <input
                      type="text"
                      id="checkout-district" autoComplete="address-level2" value={formData.district}
                      aria-invalid={Boolean(fieldErrors.district)} aria-describedby={fieldErrors.district ? 'checkout-district-error' : undefined}
                      onChange={(e) => updateCustomer('district', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.district ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder="İlçe"
                    />
                    {fieldErrors.district && <p id="checkout-district-error" className="text-xs text-red-700">{fieldErrors.district}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-postalCode" className="text-xs uppercase tracking-widest text-nrs-ink/60">Posta kodu</label>
                    <input
                      type="text"
                      id="checkout-postalCode" autoComplete="postal-code" value={formData.postalCode}
                      aria-invalid={Boolean(fieldErrors.postalCode)} aria-describedby={fieldErrors.postalCode ? 'checkout-postalCode-error' : undefined}
                      onChange={(e) => updateCustomer('postalCode', e.target.value)}
                      className={`w-full min-w-0 border-b bg-transparent px-0 py-3 transition-colors focus:border-nrs-ink focus:outline-none ${fieldErrors.postalCode ? 'border-red-700' : 'border-nrs-ink/20'}`}
                      placeholder="Posta kodu"
                    />
                    {fieldErrors.postalCode && <p id="checkout-postalCode-error" className="text-xs text-red-700">{fieldErrors.postalCode}</p>}
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-sm">Sipariş notu (isteğe bağlı)
                    <textarea value={formData.orderNote} maxLength={2000} onChange={e => setFormData({ ...formData, orderNote: e.target.value })} className="mt-2 w-full border border-nrs-ink/20 bg-transparent p-3" />
                  </label>
                  <h3 className="font-serif text-xl">Beden ve özel ölçüler</h3>
                  <p className="text-sm text-nrs-ink/65">Bütün kıyafetler ölçülerinize göre özel dikilir. Standart beden tek başına yeterli değildir; yıldızlı ölçüler zorunludur. Ölçü girmek tek başına cayma hakkını kaldırmaz. Ölçüleriniz yalnızca siparişin hazırlanması ve ilgili müşteri desteği için siparişe bağlı saklanır; sağlık bilgisi yazmayın.</p>
                  {items.map(item => <fieldset key={getCartItemId(item)} className="border border-nrs-ink/15 p-4">
                    <legend>{item.title} · Beden: {item.size || 'Belirtilmedi'}</legend>
                    <div className="grid min-w-0 grid-cols-2 gap-3">{measurementFields((item.category || '') + ' ' + item.title).map(field => <label key={field} className="min-w-0 break-words text-sm">{MEASUREMENT_LABELS[field]} (cm){requiredMeasurements(measurementKind((item.category || '') + ' ' + item.title)).includes(field) ? ' *' : ' (isteğe bağlı)'}
                      <input type="number" required={requiredMeasurements(measurementKind((item.category || '') + ' ' + item.title)).includes(field)} min={MEASUREMENT_RANGES[field][0]} max={MEASUREMENT_RANGES[field][1]} step="0.1" value={(measurements[getCartItemId(item)] ?? item.measurements)?.[field] ?? ''} onChange={e => {
                        const values = { ...(measurements[getCartItemId(item)] ?? item.measurements) }; if (e.target.value === '') delete values[field]; else values[field] = Number(e.target.value)
                        setMeasurements({ ...measurements, [getCartItemId(item)]: values }); updateMeasurements(getCartItemId(item), values)
                      }} className="mt-1 w-full min-w-0 border border-nrs-ink/20 bg-transparent p-2" />
                      <span className="block text-xs text-nrs-ink/60">{MEASUREMENT_HELP[field]}</span>
                    </label>)}</div>
                  </fieldset>)}
                  <Link href="/kvkk" className="text-sm underline">Kişisel verilerinizin işlenmesine ilişkin aydınlatma metni</Link>
                </div>
                <button
                  onClick={() => void reviewPayment()} disabled={busy}
                  className="mt-12 w-full bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory py-4 uppercase tracking-widest text-xs font-sans hover:bg-nrs-black/90 transition-all"
                >
                  {busy ? 'Sipariş özeti doğrulanıyor…' : 'Özeti İncele'}
                </button>
                {legalError && <p role="alert" className="text-sm text-rose-700">{legalError}</p>}
              </motion.div>
            )}

            {(!ENABLE_CARD_PAYMENT || step === 3) && (
              <div className="space-y-5">
                <h2 className="font-serif text-2xl">Sipariş özeti ve onay</h2>
                {ENABLE_CARD_PAYMENT && <>
                  <p role="status" className="text-nrs-ink/60">Lütfen sunucuda doğrulanan sipariş özetini ve sözleşmeleri inceleyin. Ödeme yükümlülüğü, aşağıdaki ödeme butonuna basıldığında doğar.</p>
                </>}
                {ENABLE_CARD_PAYMENT && <p role="status" className="rounded-sm bg-nrs-panel px-4 py-3 text-sm leading-6 text-nrs-ink/70">Bir sonraki adım Garanti BBVA’nın güvenli ödeme sayfasına geçiştir. Ödeme sonucu banka tarafından bildirildikten sonra gösterilir.</p>}
                {confirmedQuote && <details className="rounded-sm border border-nrs-ink/15 bg-nrs-warm-white px-4 py-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm underline underline-offset-4">Sözleşmeye esas sipariş bilgilerini görüntüle</summary>
                  <div className="pt-3">{/* The server-quoted snapshot remains the source recorded with legal acceptance. */}
                    <LegalOrderSummary summary={orderSummary} preview={!confirmedQuote} />
                  </div>
                </details>}
                <div className="space-y-3">
                  {(['contract', 'preInformation'] as const).map(kind => {
                    const slug = kind === 'contract' ? 'mesafeli-satis-sozlesmesi' : 'on-bilgilendirme-formu'
                    const document = getLegalDocument(slug, LEGAL_DOCUMENT_VERSIONS[kind])!
                    return <div key={kind} className="min-w-0 border border-nrs-ink/15 p-4 sm:p-6">
                      <details>
                        <summary className="min-h-11 cursor-pointer font-serif text-lg">{document.title} · {LEGAL_DOCUMENT_VERSIONS[kind]} içeriği</summary>
                        <div className="pt-4"><LegalDocumentContent document={document} /></div>
                      </details>
                      <Link href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4">{document.title} sayfasını aç</Link>
                    </div>
                  })}
                </div>
                {ENABLE_CARD_PAYMENT && <div className="space-y-4">
                  <CheckoutLegalConsent accepted={contractAccepted} onChange={value => {
                    setAcceptedSnapshot(value ? snapshotKey : null); setLegalError(''); setPaymentMessage('')
                  }} error={legalError} />
                  <button type="button" onClick={() => void prepareCardPayment()} disabled={busy}
                    className="w-full bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory py-4 uppercase tracking-widest text-xs hover:bg-nrs-black/90 transition-all">
                    {busy ? 'Garanti BBVA’ya yönlendiriliyorsunuz…' : 'Garanti BBVA ödeme sayfasına geç'}
                  </button>
                  {paymentMessage && <p role="status" className="text-sm text-nrs-ink/65">{paymentMessage}</p>}
                  {pendingOrderUrl && <Link href={pendingOrderUrl} className="inline-flex min-h-11 items-center text-sm underline">Bekleyen test siparişine devam et</Link>}
                </div>}
                {!ENABLE_CARD_PAYMENT && <div className="space-y-3 border border-nrs-ink/15 p-4 sm:p-6">
                  <button type="button" disabled aria-describedby="checkout-card-payment-status"
                    className="flex min-h-12 w-full items-center justify-center bg-nrs-charcoal px-4 py-4 text-center text-xs uppercase tracking-widest text-nrs-ivory opacity-50 cursor-not-allowed">
                    Kartla Ödeme Yap
                  </button>
                  <CardPaymentNotice id="checkout-card-payment-status" />
                </div>}
                {!ENABLE_CARD_PAYMENT && confirmedQuote && <div className="space-y-3">
                  <CheckoutLegalConsent accepted={contractAccepted} onChange={value => setAcceptedSnapshot(value ? snapshotKey : null)} error={legalError} />
                  <button type="button" disabled={busy || !!savedOrder} onClick={() => void saveManualOrder()} className="w-full bg-nrs-charcoal py-4 text-nrs-ivory">{busy ? 'Kaydediliyor…' : 'Havale / WhatsApp sipariş talebini kaydet'}</button>
                  {savedOrder && <p role="status">Sipariş talebiniz kaydedildi: {savedOrder}. Ödeme alınmadı; teyit için WhatsApp üzerinden iletişime geçin.</p>}
                </div>}
              </div>
            )}


          </section>
          <aside aria-label="Sipariş özeti" className="order-first min-w-0 lg:order-none lg:sticky lg:top-[calc(var(--nrs-header-height)+1.5rem)]">
            <section className="rounded-sm border border-nrs-ink/10 bg-nrs-panel/70 p-4 sm:p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl text-nrs-ink">Sipariş özeti</h2>
                <span className="text-xs text-nrs-ink/55">{orderSummary.items.reduce((sum, item) => sum + item.quantity, 0)} ürün</span>
              </div>
              <ul className="divide-y divide-nrs-ink/10">
                {orderSummary.items.map((item, index) => <li key={`${item.productId}-${index}`} className="flex min-w-0 justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm leading-5 text-nrs-ink">{item.name}</p>
                    <p className="mt-1 text-xs text-nrs-ink/55">{item.size ? `Ölçü ${item.size} · ` : ''}{item.quantity} adet</p>
                    {item.measurements && <details className="mt-1 min-w-0">
                      <summary className="inline-flex min-h-8 cursor-pointer items-center text-xs text-nrs-ink/60 underline underline-offset-2">Özel ölçüler</summary>
                      <p className="break-words pb-1 text-xs leading-5 text-nrs-ink/60">{formatMeasurements(item.measurements) || 'Ölçü belirtilmedi'}</p>
                    </details>}
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-nrs-ink">{money(item.unitPrice * item.quantity)}</span>
                </li>)}
              </ul>
              <dl className="space-y-2 border-t border-nrs-ink/10 pt-3 text-sm">
                <div className="flex justify-between gap-3 text-nrs-ink/65"><dt>Ara toplam</dt><dd className="tabular-nums">{money(orderSummary.subtotal)}</dd></div>
                {orderSummary.discount > 0 && <div className="flex justify-between gap-3 text-nrs-ink/65"><dt>İndirim</dt><dd className="tabular-nums">−{money(orderSummary.discount)}</dd></div>}
                <div className="flex justify-between gap-3 text-nrs-ink/65"><dt>Kargo</dt><dd>{orderSummary.shipping === null ? 'Sipariş teyidinde' : orderSummary.shipping === 0 ? 'Ücretsiz' : money(orderSummary.shipping)}</dd></div>
                <div className="flex items-baseline justify-between gap-3 border-t border-nrs-ink/10 pt-3 font-medium text-nrs-ink"><dt>Toplam</dt><dd className="font-serif text-2xl tabular-nums">{money(orderSummary.total)}</dd></div>
              </dl>
              {!confirmedQuote && <p className="mt-3 text-xs leading-5 text-nrs-ink/55">Tutar, stok ve teslimat bedeli sunucuda doğrulanınca kesinleşir.</p>}
            </section>
            <div className="mt-3">
              <CartWhatsappOrder items={items.map(item => ({ ...item, measurements: measurements[getCartItemId(item)] ?? item.measurements ?? {} }))} total={orderSummary.total} customer={{ ...formData, orderId: confirmedQuote ? savedOrder || undefined : undefined }} compact />
            </div>
          </aside>
        </div>
        </div>
      </main>
    </div>
  )
}
