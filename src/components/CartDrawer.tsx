'use client';

import React from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag } from 'lucide-react';
import { getCartItemId, useCart } from '@/store/useCart';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useDialog } from '@/hooks/useDialog';

const CartDrawer = () => {
  const { items, isDrawerOpen, closeDrawer, removeItem, updateQuantity, subtotalAmount, discountAmount, shippingAmount, totalAmount } = useCart();
  const router = useRouter();
  const dialogRef = useDialog(isDrawerOpen, closeDrawer);

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-nrs-black/40 backdrop-blur-sm flex justify-end"
          onClick={closeDrawer}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            tabIndex={-1}
            className="w-full max-w-[450px] bg-nrs-canvas h-[100dvh] overflow-y-auto shadow-2xl p-4 sm:p-8 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 justify-between items-center mb-6 sm:mb-12">
              <div className="flex items-center gap-3">
                <ShoppingBag size={20} strokeWidth={1.5} className="text-nrs-ink" />
                <h2 id="cart-drawer-title" className="font-serif text-2xl text-nrs-ink">Your Bag</h2>
              </div>
              <button
                onClick={closeDrawer}
                aria-label="Sepeti kapat"
                className="p-2 text-nrs-ink hover:text-nrs-rosegold transition-colors rounded-full hover:bg-nrs-black/5"
              >
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="p-6 bg-nrs-black/5 rounded-full">
                  <ShoppingBag size={40} strokeWidth={1} className="text-nrs-ink/20" />
                </div>
                <div className="space-y-2">
                  <p className="text-nrs-ink/60 italic font-serif text-lg">Your bag is currently empty.</p>
                  <p className="text-xs uppercase tracking-widest text-nrs-ink/60">Discover our new collection</p>
                </div>
                <button
                  onClick={closeDrawer}
                  className="px-8 py-3 bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory text-xs uppercase tracking-widest hover:bg-nrs-rosegold transition-all duration-500"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <>
                <div className="min-h-24 flex-1 overflow-y-auto pr-1 sm:pr-4 space-y-8">
                  {items.map((item) => {
                    const cartItemId = getCartItemId(item)
                    return <div key={cartItemId} className="flex gap-3 sm:gap-6 pb-8 border-b border-nrs-ink/10">
                      <div className="w-16 h-24 sm:w-24 sm:h-32 bg-nrs-black/5 flex-shrink-0 overflow-hidden relative">
                        <Image
                          src={item.image || 'https://images.unsplash.com/photo-1515378791000-01714bb6013c?q=80&w=200&auto=format&fit=crop'}
                          alt={item.title}
                          fill
                          className="object-cover opacity-80"
                          sizes="96px"
                        />
                      </div>
                      <div className="min-w-0 flex flex-col justify-between flex-1 py-1">
                        <div className="flex flex-wrap justify-between gap-2 items-start">
                          <h3 className="text-sm font-serif text-nrs-ink">{item.title}</h3>
                          <p className="text-sm font-sans text-nrs-ink">{item.price}</p>
                        </div>
                        <div className="flex flex-wrap gap-3 justify-between items-center mt-4">
                          <div className="space-y-2">
                            {item.size && <p className="text-xs text-nrs-ink/65">Beden: {item.size}</p>}
                            <div className="flex items-center gap-3 text-xs text-nrs-ink/65 uppercase tracking-widest">
                              <button type="button" aria-label={`${item.title} miktarını azalt`} onClick={() => updateQuantity(cartItemId, item.quantity - 1)} className="h-7 w-7 border border-nrs-ink/15 hover:border-nrs-ink">−</button>
                              <span>Qty: {item.quantity}</span>
                              <button type="button" aria-label={`${item.title} miktarını artır`} onClick={() => updateQuantity(cartItemId, item.quantity + 1)} className="h-7 w-7 border border-nrs-ink/15 hover:border-nrs-ink">+</button>
                            </div>
                          </div>
                          <button
                            onClick={() => removeItem(cartItemId)}
                            className="text-[10px] uppercase tracking-widest text-nrs-ink/60 hover:text-red-400 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  })}
                </div>

                  <div className="shrink-0 pt-4 sm:pt-8 border-t border-nrs-ink/20 space-y-4 sm:space-y-6">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-nrs-ink/60 uppercase tracking-widest">Ara Toplam</span>
                        <span className="font-serif text-nrs-ink">₺{subtotalAmount.toLocaleString('tr-TR')}</span>
                      </div>
                      {discountAmount > 0 && <div className="flex justify-between items-center text-nrs-ink/55">
                        <span className="uppercase tracking-widest">İndirim</span>
                        <span>−₺{discountAmount.toLocaleString('tr-TR')}</span>
                      </div>}
                      <div className="flex justify-between items-center text-nrs-ink/55">
                        <span className="uppercase tracking-widest">Kargo</span>
                        <span>{shippingAmount === 0 ? 'Henüz tanımlanmadı' : `₺${shippingAmount.toLocaleString('tr-TR')}`}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-nrs-ink/10 pt-3">
                        <span className="text-nrs-ink/60 uppercase tracking-widest">Genel Toplam</span>
                        <span className="text-lg font-serif text-nrs-ink">₺{totalAmount.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                  <button
                    onClick={() => {
                      closeDrawer();
                      router.push('/checkout');
                    }}
                    className="w-full bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory py-5 text-xs uppercase tracking-widest hover:bg-nrs-rosegold transition-all duration-500 flex items-center justify-center gap-3"
                  >
                    Proceed to Checkout
                    <ShoppingBag size={16} />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
