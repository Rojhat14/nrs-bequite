'use client'

import { DELIVERY_TERMS } from '@/lib/delivery-policy'
import { m as motion } from 'framer-motion'
import { getCartItemId, parsePrice, useCart } from '@/store/useCart'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingBag, Home, User } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import AccountModal from '@/components/AccountModal'
import CartWhatsappOrder from '@/components/CartWhatsappOrder'
import { useCardPaymentEnabled } from '@/lib/feature-flags'
import CheckoutLegalConsent from '@/components/legal/CheckoutLegalConsent'
import LegalOrderSummary from '@/components/legal/LegalOrderSummary'
import LegalDocumentContent from '@/components/legal/LegalDocumentContent'
import { getLegalDocument, LEGAL_DOCUMENT_VERSIONS } from '@/lib/legal/documents'
import { withLegalAcceptance } from '@/lib/legal/acceptance'
import type { Quote } from '@/lib/payment/types'
import type { LegalOrderSummary as OrderSummary } from '@/lib/legal/order-summary'

import { MEASUREMENT_LABELS, MEASUREMENT_HELP, MEASUREMENT_RANGES, measurementFields, measurementKind, requiredMeasurements, validateRequiredMeasurements, type Measurements } from '@/lib/order-measurements'

export default function Checkout() {
  const ENABLE_CARD_PAYMENT = useCardPaymentEnabled()
  const { items, subtotalAmount, discountAmount, shippingAmount, totalAmount, openDrawer, updateMeasurements } = useCart()
  const { user, profile } = useAuth()
  const [step, setStep] = useState(1) // 1: Auth Choice, 2: Shipping, 3: Payment
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [acceptedSnapshot, setAcceptedSnapshot] = useState<string | null>(null)
  const [legalError, setLegalError] = useState('')
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

  useEffect(() => {
    if (!profile) return
    setFormData(current => ({ ...current, firstName: current.firstName || profile.first_name || '', lastName: current.lastName || profile.last_name || '', email: current.email || profile.email || '', phone: current.phone || profile.phone || '' }))
  }, [profile])

  const inputKey = JSON.stringify({ items, measurements, formData, subtotalAmount, discountAmount, shippingAmount, totalAmount })
  const confirmedQuote = quoteKey === inputKey ? quote : null
  const snapshotKey = JSON.stringify({ inputKey, quoteHash: confirmedQuote?.hash })
  const checkoutInput = () => ({ items: items.map(item => ({ productId: item.id, variantId: item.variantId, quantity: item.quantity, measurements: measurements[getCartItemId(item)] ?? item.measurements ?? {} })), customer: formData })
  const contractAccepted = acceptedSnapshot === snapshotKey
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
    if (!formData.firstName.trim() || !formData.lastName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) || !formData.phone.trim() || !formData.address.trim() || !formData.city.trim() || !formData.district.trim() || !/^\d{5}$/.test(formData.postalCode)) {
      setLegalError('Lütfen ad, soyad, geçerli e-posta, telefon ve teslimat adresini doldurun.')
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
    try {
      // Consent is checked BEFORE any payment request. Client commercial values
      // never reach payment/create; only IDs, quantity and approved quote hash.
      const payload = withLegalAcceptance({ ...checkoutInput(), quoteHash: confirmedQuote?.hash, idempotencyKey }, contractAccepted)
      if (!user) throw new Error('Kartla ödeme için hesabınıza giriş yapın.')
      if (!confirmedQuote) throw new Error('Ödeme öncesinde sipariş özetini yeniden doğrulayın.')
      setLegalError(''); setBusy(true)
      const response = await fetch('/api/payment/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Ödeme başlatılamadı.')
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
        <div className="py-32 text-center max-w-md mx-auto px-6">
          <h2 className="font-serif text-3xl mb-4 text-nrs-ink">Your bag is empty.</h2>
          <p className="text-nrs-ink/60 mb-8">Please add items to your selection before proceeding to checkout.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory px-8 py-3 text-xs uppercase tracking-widest hover:bg-nrs-black/90 transition-colors"
          >
            Explore Collection
          </button>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-nrs-canvas flex">
      <AccountModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <aside className="fixed left-0 top-[var(--nrs-header-height)] bottom-0 w-64 bg-nrs-panel border-r border-nrs-ink/10 hidden md:flex flex-col items-center py-12 px-6 z-50">
        <div className="mb-12">
          <Link href="/" className="flex flex-col items-center gap-1">
            <Image
              src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
              alt="Logo"
              width={140}
              height={56}
              className="h-10 md:h-14 w-auto object-contain"
            />
            <span className="hidden md:block text-[9px] uppercase tracking-[0.4em] font-sans text-nrs-ink/60 mt-1 text-center">
              Boutique Luminous
            </span>
          </Link>
        </div>
        <nav className="flex flex-col gap-8 w-full">
          <Link href="/" className="flex items-center gap-4 text-nrs-ink/60 hover:text-nrs-ink transition-colors group">
            <Home size={20} className="group-hover:scale-110 transition-transform" />
            <span className="hidden md:block text-xs uppercase tracking-widest">Home</span>
          </Link>
          <button
            onClick={openDrawer}
            className="flex items-center gap-4 text-nrs-ink/60 hover:text-nrs-ink transition-colors group"
          >
            <ShoppingBag size={20} className="group-hover:scale-110 transition-transform" />
            <span className="hidden md:block text-xs uppercase tracking-widest">Bag</span>
          </button>
        </nav>
        <div className="mt-auto">
          <button onClick={() => router.push('/')} className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest text-nrs-ink/60 hover:text-nrs-ink transition-colors">
            <ArrowLeft size={14} />
            Return to Atelier
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 md:ml-64 pt-[var(--nrs-header-height)]">
        <div className="max-w-3xl mx-auto py-20 px-6">
          <div className="mb-12">
            {ENABLE_CARD_PAYMENT && step <= 3 && (
              <button
                onClick={() => (step === 1 ? router.push('/') : setStep(step - 1))}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-nrs-ink/60 hover:text-nrs-ink transition-colors mb-6 group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                {step === 1 ? 'Back to Atelier' : 'Previous Step'}
              </button>
            )}
            <h1 className="font-serif text-4xl md:text-5xl mb-3 text-nrs-ink">{ENABLE_CARD_PAYMENT ? 'Checkout' : 'Sipariş'}</h1>
            {ENABLE_CARD_PAYMENT && <p className="text-nrs-ink/65">Complete your acquisition of the selected pieces.</p>}
          </div>

          <div className="space-y-12">
            {ENABLE_CARD_PAYMENT && step === 1 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                <h2 className="font-serif text-2xl text-nrs-ink text-center">How would you like to proceed?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => { if (!user) { setAuthOpen(true); return; } setStep(2); }}
                    className="p-8 border border-nrs-ink/10 hover:border-nrs-ink transition-all group flex flex-col items-center gap-4 text-center bg-nrs-panel"
                  >
                    <User size={32} className="text-nrs-ink group-hover:scale-110 transition-transform" />
                    <div>
                      <h3 className="font-serif text-lg text-nrs-ink">Continue with Account</h3>
                      <p className="text-xs text-nrs-ink/60 mt-2 uppercase tracking-widest">Faster checkout & order history</p>
                    </div>
                  </button>
                  <p className="p-8 text-sm text-nrs-ink/65">Kartla ödeme ve sipariş belgelerine erişim için hesabınıza giriş yapın. Hesapsız sipariş talebinizi WhatsApp üzerinden iletebilirsiniz.</p>
                </div>
              </motion.div>
            )}

            {(!ENABLE_CARD_PAYMENT || step === 2) && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <h2 className="font-serif text-2xl text-nrs-ink">Müşteri ve teslimat bilgileri</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-firstName" className="text-xs uppercase tracking-widest text-nrs-ink/60">Ad</label>
                    <input
                      type="text"
                      id="checkout-firstName" autoComplete="given-name" value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="Ad"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-lastName" className="text-xs uppercase tracking-widest text-nrs-ink/60">Soyad</label>
                    <input
                      type="text"
                      id="checkout-lastName" autoComplete="family-name" value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="Soyad"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-email" className="text-xs uppercase tracking-widest text-nrs-ink/60">E-posta</label>
                    <input
                      type="email"
                      id="checkout-email" autoComplete="email" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-phone" className="text-xs uppercase tracking-widest text-nrs-ink/60">Telefon</label>
                    <input
                      type="text"
                      id="checkout-phone" autoComplete="tel" value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="+90 ..."
                    />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label htmlFor="checkout-address" className="text-xs uppercase tracking-widest text-nrs-ink/60">Açık adres</label>
                    <textarea
                      id="checkout-address" autoComplete="street-address" value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="Mahalle, sokak, bina, daire..."
                      rows={3}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-city" className="text-xs uppercase tracking-widest text-nrs-ink/60">İl</label>
                    <input
                      type="text"
                      id="checkout-city" autoComplete="address-level1" value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="İl"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-district" className="text-xs uppercase tracking-widest text-nrs-ink/60">İlçe</label>
                    <input
                      type="text"
                      id="checkout-district" autoComplete="address-level2" value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="İlçe"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-postalCode" className="text-xs uppercase tracking-widest text-nrs-ink/60">Posta kodu</label>
                    <input
                      type="text"
                      id="checkout-postalCode" autoComplete="postal-code" value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="Posta kodu"
                    />
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
                    <div className="grid grid-cols-2 gap-3">{measurementFields((item.category || '') + ' ' + item.title).map(field => <label key={field} className="text-sm">{MEASUREMENT_LABELS[field]} (cm){requiredMeasurements(measurementKind((item.category || '') + ' ' + item.title)).includes(field) ? ' *' : ' (isteğe bağlı)'}
                      <input type="number" required={requiredMeasurements(measurementKind((item.category || '') + ' ' + item.title)).includes(field)} min={MEASUREMENT_RANGES[field][0]} max={MEASUREMENT_RANGES[field][1]} step="0.1" value={(measurements[getCartItemId(item)] ?? item.measurements)?.[field] ?? ''} onChange={e => {
                        const values = { ...(measurements[getCartItemId(item)] ?? item.measurements) }; if (e.target.value === '') delete values[field]; else values[field] = Number(e.target.value)
                        setMeasurements({ ...measurements, [getCartItemId(item)]: values }); updateMeasurements(getCartItemId(item), values)
                      }} className="mt-1 w-full border border-nrs-ink/20 bg-transparent p-2" />
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
              <div className="space-y-6">
                {ENABLE_CARD_PAYMENT && <>
                  <h2 className="font-serif text-2xl">Ödeme</h2>
                  <p role="status" className="text-nrs-ink/60">Lütfen sunucuda doğrulanan sipariş özetini ve sözleşmeleri inceleyin. Ödeme yükümlülüğü, aşağıdaki ödeme butonuna basıldığında doğar.</p>
                </>}
                <p>Toplam: ₺{orderSummary.total.toLocaleString('tr-TR')}</p>
                <LegalOrderSummary summary={orderSummary} preview={!confirmedQuote} />
                <div className="space-y-3">
                  {(['contract', 'preInformation'] as const).map(kind => {
                    const slug = kind === 'contract' ? 'mesafeli-satis-sozlesmesi' : 'on-bilgilendirme-formu'
                    const document = getLegalDocument(slug, LEGAL_DOCUMENT_VERSIONS[kind])!
                    return <details key={kind} className="min-w-0 border border-nrs-ink/15 p-4 sm:p-6">
                      <summary className="min-h-11 cursor-pointer font-serif text-lg">{document.title} · {LEGAL_DOCUMENT_VERSIONS[kind]}</summary>
                      <div className="pt-6"><LegalDocumentContent document={document} /></div>
                      <Link href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center mt-4 text-sm underline">{document.title} sayfasını aç</Link>
                    </details>
                  })}
                </div>
                {ENABLE_CARD_PAYMENT && <div className="space-y-4">
                  <CheckoutLegalConsent accepted={contractAccepted} onChange={value => {
                    setAcceptedSnapshot(value ? snapshotKey : null); setLegalError(''); setPaymentMessage('')
                  }} error={legalError} />
                  <button type="button" onClick={() => void prepareCardPayment()} disabled={busy}
                    className="w-full bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory py-4 uppercase tracking-widest text-xs hover:bg-nrs-black/90 transition-all">
                    Siparişi Ver ve Ödeme Yap
                  </button>
                  {paymentMessage && <p role="status" className="text-sm text-nrs-ink/65">{paymentMessage}</p>}
                </div>}
                {!ENABLE_CARD_PAYMENT && confirmedQuote && <div className="space-y-3">
                  <CheckoutLegalConsent accepted={contractAccepted} onChange={value => setAcceptedSnapshot(value ? snapshotKey : null)} error={legalError} />
                  <button type="button" disabled={busy || !!savedOrder} onClick={() => void saveManualOrder()} className="w-full bg-nrs-charcoal py-4 text-nrs-ivory">{busy ? 'Kaydediliyor…' : 'Havale / WhatsApp sipariş talebini kaydet'}</button>
                  {savedOrder && <p role="status">Sipariş talebiniz kaydedildi: {savedOrder}. Ödeme alınmadı; teyit için WhatsApp üzerinden iletişime geçin.</p>}
                </div>}
                <CartWhatsappOrder items={items.map(item => ({ ...item, measurements: measurements[getCartItemId(item)] ?? item.measurements ?? {} }))} total={orderSummary.total} customer={{ ...formData, orderId: confirmedQuote ? savedOrder || undefined : undefined }} />
              </div>
            )}


          </div>
        </div>
      </main>
    </div>
  )
}
