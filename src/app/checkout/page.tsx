'use client'

import { motion } from 'framer-motion'
import { useCart } from '@/store/useCart'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingBag, Home, User, UserCircle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import AccountModal from '@/components/AccountModal'

export default function Checkout() {
  const { items, totalAmount, openDrawer } = useCart()
  const { user, profile } = useAuth()
  const [step, setStep] = useState(1) // 1: Auth Choice, 2: Shipping, 3: Payment
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
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
  })

  useEffect(() => {
    if (!profile) return
    setFormData(current => ({ ...current, firstName: current.firstName || profile.first_name || '', lastName: current.lastName || profile.last_name || '', email: current.email || profile.email || '', phone: current.phone || profile.phone || '' }))
  }, [profile])

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
            {step <= 3 && (
              <button
                onClick={() => (step === 1 ? router.push('/') : setStep(step - 1))}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-nrs-ink/60 hover:text-nrs-ink transition-colors mb-6 group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                {step === 1 ? 'Back to Atelier' : 'Previous Step'}
              </button>
            )}
            <h1 className="font-serif text-4xl md:text-5xl mb-3 text-nrs-ink">Checkout</h1>
            <p className="text-nrs-ink/65">Complete your acquisition of the selected pieces.</p>
          </div>

          <div className="space-y-12">
            {step === 1 && (
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
                  <button
                    onClick={() => { setStep(2); }}
                    className="p-8 border border-nrs-ink/10 hover:border-nrs-ink transition-all group flex flex-col items-center gap-4 text-center bg-nrs-panel"
                  >
                    <UserCircle size={32} className="text-nrs-ink group-hover:scale-110 transition-transform" />
                    <div>
                      <h3 className="font-serif text-lg text-nrs-ink">Continue as Guest</h3>
                      <p className="text-xs text-nrs-ink/60 mt-2 uppercase tracking-widest">Quick acquisition without account</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <h2 className="font-serif text-2xl text-nrs-ink">Shipping Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-firstName" className="text-xs uppercase tracking-widest text-nrs-ink/60">First Name</label>
                    <input
                      type="text"
                      id="checkout-firstName" autoComplete="given-name" value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="First Name"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-lastName" className="text-xs uppercase tracking-widest text-nrs-ink/60">Last Name</label>
                    <input
                      type="text"
                      id="checkout-lastName" autoComplete="family-name" value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="Last Name"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-email" className="text-xs uppercase tracking-widest text-nrs-ink/60">Email Address</label>
                    <input
                      type="email"
                      id="checkout-email" autoComplete="email" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-phone" className="text-xs uppercase tracking-widest text-nrs-ink/60">Phone Number</label>
                    <input
                      type="text"
                      id="checkout-phone" autoComplete="tel" value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="+90 ..."
                    />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label htmlFor="checkout-address" className="text-xs uppercase tracking-widest text-nrs-ink/60">Full Address</label>
                    <textarea
                      id="checkout-address" autoComplete="street-address" value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="Street, Neighborhood, Door/Floor..."
                      rows={3}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-city" className="text-xs uppercase tracking-widest text-nrs-ink/60">City</label>
                    <input
                      type="text"
                      id="checkout-city" autoComplete="address-level1" value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="City"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-district" className="text-xs uppercase tracking-widest text-nrs-ink/60">District</label>
                    <input
                      type="text"
                      id="checkout-district" autoComplete="address-level2" value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="District"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="checkout-postalCode" className="text-xs uppercase tracking-widest text-nrs-ink/60">Postal Code</label>
                    <input
                      type="text"
                      id="checkout-postalCode" autoComplete="postal-code" value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full min-w-0 border-b border-nrs-ink/20 py-3 px-0 focus:outline-none focus:border-nrs-ink transition-colors bg-transparent"
                      placeholder="Postal Code"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!formData.firstName.trim() || !formData.lastName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) || !formData.phone.trim() || !formData.address.trim() || !formData.city.trim() || !formData.district.trim()) {
                      alert('Lütfen ad, soyad, geçerli e-posta, telefon ve teslimat adresini doldurun.');
                      return;
                    }
                    setStep(3);
                  }}
                  className="mt-12 w-full bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory py-4 uppercase tracking-widest text-xs font-sans hover:bg-nrs-black/90 transition-all"
                >
                  Continue to Payment
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h2 className="font-serif text-2xl">Ödeme</h2>
                <p role="status" className="text-nrs-ink/60">Online ödeme henüz kullanılamıyor. Sipariş için bizimle iletişime geçebilirsiniz. Sepetiniz korunur.</p>
                <p>Toplam: ₺{totalAmount.toLocaleString('tr-TR')}</p>
                <Link href="/contact" className="inline-block bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 px-8 py-4 text-nrs-ivory">İletişime geç</Link>
              </div>
            )}


          </div>
        </div>
      </main>
    </div>
  )
}
