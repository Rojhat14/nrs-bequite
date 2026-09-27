'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '@/store/useCart'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ShoppingBag, Home, User, UserCircle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'

export default function Checkout() {
  const { items, totalAmount, clearCart } = useCart()
  const { user, profile } = useAuth()
  const [step, setStep] = useState(1) // 1: Auth Choice, 2: Shipping, 3: Payment, 4: Success
  const [checkoutMode, setCheckoutMode] = useState<'account' | 'guest' | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card')
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()

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

  if (items.length === 0 && step !== 4) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nrs-ivory">
        <div className="py-32 text-center max-w-md mx-auto px-6">
          <h2 className="font-serif text-3xl mb-4 text-nrs-black">Your bag is empty.</h2>
          <p className="text-nrs-black/40 mb-8">Please add items to your selection before proceeding to checkout.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-nrs-black text-nrs-ivory px-8 py-3 text-xs uppercase tracking-widest hover:bg-nrs-black/90 transition-colors"
          >
            Explore Collection
          </button>
        </div>
      </div>
    )
  }

  const handleCompletePurchase = async () => {
    if (!formData.email || !formData.address || !formData.phone || !formData.firstName || !formData.lastName) {
      alert('Please fill in all required shipping details.');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          totalAmount,
          checkoutMode,
          customer: {
            userId: user?.id,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            city: formData.city,
            district: formData.district,
            postalCode: formData.postalCode,
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Payment initiation failed');

      // Redirect to the payment verification page (3D Secure Simulation)
      router.push(data.paymentUrl);
    } catch (err: any) {
      console.error('Checkout Error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-nrs-ivory flex">
      <aside className="fixed left-0 top-0 h-full w-20 md:w-64 bg-white border-r border-nrs-black/10 flex flex-col items-center py-12 px-6 z-50">
        <div className="mb-12">
          <Link href="/" className="flex flex-col items-center gap-1">
            <Image
              src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
              alt="Logo"
              width={140}
              height={56}
              className="h-10 md:h-14 w-auto object-contain"
            />
            <span className="hidden md:block text-[9px] uppercase tracking-[0.4em] font-sans text-nrs-black/60 mt-1 text-center">
              Boutique Luminous
            </span>
          </Link>
        </div>
        <nav className="flex flex-col gap-8 w-full">
          <Link href="/" className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group">
            <Home size={20} className="group-hover:scale-110 transition-transform" />
            <span className="hidden md:block text-xs uppercase tracking-widest">Home</span>
          </Link>
          <button
            onClick={() => {}} // Cart drawer open logic handled by Layout usually
            className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group"
          >
            <ShoppingBag size={20} className="group-hover:scale-110 transition-transform" />
            <span className="hidden md:block text-xs uppercase tracking-widest">Bag</span>
          </button>
        </nav>
        <div className="mt-auto">
          <button onClick={() => router.push('/')} className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest text-nrs-black/40 hover:text-nrs-black transition-colors">
            <ArrowLeft size={14} />
            Return to Atelier
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-20 md:ml-64">
        <div className="max-w-3xl mx-auto py-20 px-6">
          <div className="mb-12">
            {step < 4 && (
              <button
                onClick={() => (step === 1 ? router.push('/') : setStep(step - 1))}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-nrs-black/40 hover:text-nrs-black transition-colors mb-6 group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                {step === 1 ? 'Back to Atelier' : 'Previous Step'}
              </button>
            )}
            <h1 className="font-serif text-4xl md:text-5xl mb-3 text-nrs-black">Checkout</h1>
            <p className="text-nrs-black/50">Complete your acquisition of the selected pieces.</p>
          </div>

          <div className="space-y-12">
            {step === 1 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                <h2 className="font-serif text-2xl text-nrs-black text-center">How would you like to proceed?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => { setCheckoutMode('account'); setStep(2); }}
                    className="p-8 border border-nrs-black/10 hover:border-nrs-black transition-all group flex flex-col items-center gap-4 text-center bg-white"
                  >
                    <User size={32} className="text-nrs-black group-hover:scale-110 transition-transform" />
                    <div>
                      <h3 className="font-serif text-lg text-nrs-black">Continue with Account</h3>
                      <p className="text-xs text-nrs-black/40 mt-2 uppercase tracking-widest">Faster checkout & order history</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setCheckoutMode('guest'); setStep(2); }}
                    className="p-8 border border-nrs-black/10 hover:border-nrs-black transition-all group flex flex-col items-center gap-4 text-center bg-white"
                  >
                    <UserCircle size={32} className="text-nrs-black group-hover:scale-110 transition-transform" />
                    <div>
                      <h3 className="font-serif text-lg text-nrs-black">Continue as Guest</h3>
                      <p className="text-xs text-nrs-black/40 mt-2 uppercase tracking-widest">Quick acquisition without account</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <h2 className="font-serif text-2xl text-nrs-black">Shipping Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-nrs-black/40">First Name</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="border-b border-nrs-black/20 py-3 px-0 focus:outline-none focus:border-nrs-black transition-colors bg-transparent"
                      placeholder="First Name"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-nrs-black/40">Last Name</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="border-b border-nrs-black/20 py-3 px-0 focus:outline-none focus:border-nrs-black transition-colors bg-transparent"
                      placeholder="Last Name"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-nrs-black/40">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="border-b border-nrs-black/20 py-3 px-0 focus:outline-none focus:border-nrs-black transition-colors bg-transparent"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-nrs-black/40">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="border-b border-nrs-black/20 py-3 px-0 focus:outline-none focus:border-nrs-black transition-colors bg-transparent"
                      placeholder="+90 ..."
                    />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-xs uppercase tracking-widest text-nrs-black/40">Full Address</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="border-b border-nrs-black/20 py-3 px-0 focus:outline-none focus:border-nrs-black transition-colors bg-transparent"
                      placeholder="Street, Neighborhood, Door/Floor..."
                      rows={3}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-nrs-black/40">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="border-b border-nrs-black/20 py-3 px-0 focus:outline-none focus:border-nrs-black transition-colors bg-transparent"
                      placeholder="City"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-nrs-black/40">District</label>
                    <input
                      type="text"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="border-b border-nrs-black/20 py-3 px-0 focus:outline-none focus:border-nrs-black transition-colors bg-transparent"
                      placeholder="District"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-nrs-black/40">Postal Code</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="border-b border-nrs-black/20 py-3 px-0 focus:outline-none focus:border-nrs-black transition-colors bg-transparent"
                      placeholder="Postal Code"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setStep(3)}
                  className="mt-12 w-full bg-nrs-black text-nrs-ivory py-4 uppercase tracking-widest text-xs font-sans hover:bg-nrs-black/90 transition-all"
                >
                  Continue to Payment
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <h2 className="font-serif text-2xl text-nrs-black">Payment Method</h2>
                <div className="space-y-4">
                  <div
                    onClick={() => setPaymentMethod('card')}
                    className={`border p-5 flex justify-between items-center cursor-pointer transition-all ${
                      paymentMethod === 'card' ? 'border-nrs-black bg-white shadow-sm' : 'border-nrs-black/10 hover:border-nrs-black/30'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-serif text-nrs-black">Credit Card (Visa, Mastercard, Amex)</p>
                      <p className="text-xs text-nrs-black/40 mt-1">Encrypted and secured by 256-bit SSL</p>
                    </div>
                    <div className="w-5 h-5 border border-nrs-black rounded-full flex items-center justify-center">
                      {paymentMethod === 'card' && <div className="w-2.5 h-2.5 bg-nrs-black rounded-full" />}
                    </div>
                  </div>
                  <div
                    onClick={() => setPaymentMethod('paypal')}
                    className={`border p-5 flex justify-between items-center cursor-pointer transition-all ${
                      paymentMethod === 'paypal' ? 'border-nrs-black bg-white shadow-sm' : 'border-nrs-black/10 hover:border-nrs-black/30'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-serif text-nrs-black">PayPal</p>
                      <p className="text-xs text-nrs-black/40 mt-1">Direct checkout with buyer protection</p>
                    </div>
                    <div className="w-5 h-5 border border-nrs-black rounded-full flex items-center justify-center">
                      {paymentMethod === 'paypal' && <div className="w-2.5 h-2.5 bg-nrs-black rounded-full" />}
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex justify-between items-center pt-6 border-t border-nrs-black/10">
                  <span className="text-sm uppercase tracking-widest text-nrs-black/40">Total: €{totalAmount.toLocaleString()}</span>
                  <button
                    onClick={handleCompletePurchase}
                    disabled={isProcessing}
                    className="bg-nrs-black text-nrs-ivory px-8 py-4 text-xs uppercase tracking-widest hover:bg-nrs-black/90 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? 'Processing...' : 'Complete Purchase'}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12 space-y-6">
                <div className="w-16 h-16 bg-nrs-black/5 rounded-full flex items-center justify-center mx-auto text-nrs-black">
                  <CheckCircle2 size={36} />
                </div>
                <h2 className="font-serif text-4xl text-nrs-black">Order Confirmed.</h2>
                <p className="text-nrs-black/50 max-w-md mx-auto leading-relaxed">
                  Thank you for your acquisition. Your order has been successfully placed and is being processed.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                  <button
                    onClick={() => router.push('/')}
                    className="border border-nrs-black px-8 py-3 text-xs uppercase tracking-widest hover:bg-nrs-black hover:text-nrs-ivory transition-all"
                  >
                    Return to Collection
                  </button>
                  {checkoutMode === 'guest' && (
                    <button
                      onClick={() => router.push('/auth/register')}
                      className="bg-nrs-black text-nrs-ivory px-8 py-3 text-xs uppercase tracking-widest hover:bg-nrs-black/90 transition-all"
                    >
                      Create Account
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
