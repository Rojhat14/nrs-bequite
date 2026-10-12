'use client'

import React from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag } from 'lucide-react';
import { getCartItemId, useCart } from '@/store/useCart';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useDialog } from '@/hooks/useDialog';
import CartWhatsappOrder from '@/components/CartWhatsappOrder';

const CartDrawer = () => {
  const { items, isDrawerOpen, closeDrawer, removeItem, updateQuantity, shippingAmount, totalAmount } = useCart();
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
            className="w-full max-w-[450px] bg-nrs-canvas h-[100dvh] overflow-hidden shadow-2xl px-4 pt-4 sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <ShoppingBag size={20} strokeWidth={1.5} className="text-nrs-ink" />
                <h2 id="cart-drawer-title" className="font-serif text-2xl text-nrs-ink">Your Bag</h2>
              </div>
              <button
                onClick={closeDrawer}
                aria-label="Sepeti kapat"
                className="flex min-h-11 min-w-11 items-center justify-center text-nrs-ink hover:text-nrs-rosegold transition-colors rounded-full hover:bg-nrs-black/5"
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
                <div role="list" aria-label="Sepetteki ürünler" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                  {items.map((item) => {
                    const cartItemId = getCartItemId(item)
                    return <div key={cartItemId} role="listitem" className="flex gap-3 py-3 first:pt-0 border-b border-nrs-ink/10 last:border-b-0">
                      <div className="w-16 h-20 sm:h-24 bg-nrs-black/5 flex-shrink-0 overflow-hidden relative">
                        <Image
                          src={item.image || 'https://images.unsplash.com/photo-1515378791000-01714bb6013c?q=80&w=200&auto=format&fit=crop'}
                          alt={item.title}
                          fill
                          className="object-cover opacity-80"
                          sizes="64px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="space-y-1">
                          <h3 title={item.title} className="line-clamp-2 text-sm leading-5 font-serif text-nrs-ink [overflow-wrap:anywhere]">{item.title}</h3>
                          {item.size && <p className="text-xs leading-4 text-nrs-ink/65">Beden: {item.size}</p>}
                          <p className="text-sm leading-5 font-sans tabular-nums text-nrs-ink">{item.price}</p>
                        </div>
                        <div className="flex flex-wrap gap-x-2 justify-between items-center mt-1">
                          <div className="flex items-center text-xs text-nrs-ink/75">
                            <button type="button" aria-label={`${item.title} miktarını azalt`} onClick={() => updateQuantity(cartItemId, item.quantity - 1)} className="flex h-11 w-11 items-center justify-center hover:bg-nrs-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">−</button>
                            <span className="min-w-6 text-center tabular-nums" aria-label={`Adet: ${item.quantity}`}>{item.quantity}</span>
                            <button type="button" aria-label={`${item.title} miktarını artır`} onClick={() => updateQuantity(cartItemId, item.quantity + 1)} className="flex h-11 w-11 items-center justify-center hover:bg-nrs-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">+</button>
                          </div>
                          <button
                            type="button" aria-label={`${item.title} ürününü sepetten kaldır`}
                            onClick={() => removeItem(cartItemId)}
                            className="min-h-11 px-2 text-[10px] uppercase tracking-widest text-nrs-ink/60 hover:text-red-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            Kaldır
                          </button>
                        </div>
                      </div>
                    </div>
                  })}
                </div>

                  <div role="group" aria-label="Sepet işlemleri" className="shrink-0 mt-2 pt-3 border-t border-nrs-ink/20">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-xs uppercase tracking-widest text-nrs-ink/65">Toplam</span>
                      <span className="text-xl font-serif tabular-nums text-nrs-ink">₺{totalAmount.toLocaleString('tr-TR')}</span>
                    </div>
                  <p className="mt-1 mb-3 text-xs text-nrs-ink/60">{shippingAmount === 0 ? 'Kargo ücretsiz' : `Kargo: ₺${shippingAmount.toLocaleString('tr-TR')}`}</p>
                  <button type="button"
                    onClick={() => { closeDrawer(); router.push('/checkout'); }}
                    className="flex min-h-12 w-full items-center justify-center bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 px-4 py-3 text-center text-xs uppercase tracking-widest text-nrs-ivory hover:bg-nrs-rosegold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    Ödemeye Geç
                  </button>
                  <CartWhatsappOrder items={items} total={totalAmount} compact />
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
