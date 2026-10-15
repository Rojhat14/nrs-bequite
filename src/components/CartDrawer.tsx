'use client'

import React from 'react'
import { m as motion, AnimatePresence } from 'framer-motion'
import { X, ShoppingBag, ArrowRight, Trash2 } from 'lucide-react'
import { getCartItemId, getCartLineCampaignPrice, useCart } from '@/store/useCart'
import { isOpeningCampaignActive, OPENING_CAMPAIGN } from '@/lib/opening-campaign'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useDialog } from '@/hooks/useDialog'
import CartWhatsappOrder from '@/components/CartWhatsappOrder'

const money = (value: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value)

export default function CartDrawer() {
  const { items, isDrawerOpen, closeDrawer, removeItem, updateQuantity, subtotalAmount, discountAmount, shippingAmount, totalAmount, catalogPricesSynced, priceUpdateNotice } = useCart()
  const router = useRouter()
  const dialogRef = useDialog(isDrawerOpen, closeDrawer)

  return <AnimatePresence>
    {isDrawerOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex justify-end bg-nrs-black/40 backdrop-blur-[2px]" onClick={closeDrawer}>
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 220 }} ref={dialogRef} role="dialog" aria-modal="true"
        aria-labelledby="cart-drawer-title" tabIndex={-1}
        className="flex h-[100dvh] w-full max-w-[460px] min-w-0 flex-col bg-nrs-canvas shadow-2xl"
        onClick={event => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between border-b border-nrs-ink/10 px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-nrs-ink/55">NRS Bequite Luminous</p>
            <h2 id="cart-drawer-title" className="mt-1 font-serif text-2xl text-nrs-ink">Sepetiniz <span className="font-sans text-sm text-nrs-ink/50">({items.reduce((count, item) => count + item.quantity, 0)} ürün)</span></h2>
          </div>
          <button type="button" onClick={closeDrawer} aria-label="Sepeti kapat"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-nrs-ink/10 text-nrs-ink hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            <X size={19} strokeWidth={1.6} />
          </button>
        </header>

        {items.length === 0 ? <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-nrs-panel text-nrs-ink/55"><ShoppingBag size={25} strokeWidth={1.4} /></span>
          <h3 className="font-serif text-2xl text-nrs-ink">Sepetiniz boş</h3>
          <p className="mt-2 max-w-xs text-sm leading-6 text-nrs-ink/60">Özenle seçilmiş parçaları keşfetmeye devam edin.</p>
          <button type="button" onClick={closeDrawer} className="mt-6 inline-flex min-h-11 items-center gap-2 border-b border-nrs-ink pb-1 text-sm text-nrs-ink focus-visible:outline focus-visible:outline-2">
            Koleksiyonu keşfet <ArrowRight size={15} />
          </button>
        </div> : <>
          <ul aria-label="Sepet ürünleri" className="min-h-0 flex-1 divide-y divide-nrs-ink/10 overflow-y-auto overscroll-contain px-5 sm:px-7">
            {items.map(item => {
              const id = getCartItemId(item)
              const line = getCartLineCampaignPrice(item)
              return <li key={id} className="flex gap-3 py-4 sm:gap-4">
                <div className="relative flex h-[88px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-sm bg-nrs-panel">
                  {item.image ? <Image src={item.image} alt={item.title} fill sizes="68px" className="object-cover" /> : <ShoppingBag size={20} aria-hidden="true" className="text-nrs-ink/25" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 break-words font-serif text-[15px] leading-5 text-nrs-ink">{item.title}</h3>
                      {item.size && <p className="mt-1 text-xs text-nrs-ink/55">Ölçü: {item.size}</p>}
                    </div>
                    <div className="shrink-0 text-right text-sm tabular-nums text-nrs-ink">
                      <p>{money(line.normalLineAmount)}</p>
                      {isOpeningCampaignActive() && <p className="mt-1 text-xs font-medium text-nrs-ink/65">Sepette {money(line.saleLineAmount)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="inline-flex h-9 items-center rounded-sm border border-nrs-ink/15">
                      <button type="button" aria-label={`${item.title} miktarını azalt`} onClick={() => updateQuantity(id, item.quantity - 1)}
                        className="h-9 w-9 text-lg text-nrs-ink/70 hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2">−</button>
                      <span aria-live="polite" className="min-w-7 text-center text-xs tabular-nums">{item.quantity}</span>
                      <button type="button" aria-label={`${item.title} miktarını artır`} onClick={() => updateQuantity(id, item.quantity + 1)}
                        className="h-9 w-9 text-lg text-nrs-ink/70 hover:bg-nrs-panel focus-visible:outline focus-visible:outline-2">+</button>
                    </div>
                    <button type="button" onClick={() => removeItem(id)} aria-label={`${item.title} ürününü kaldır`}
                      className="inline-flex min-h-10 items-center gap-1.5 px-1 text-xs text-nrs-ink/55 underline underline-offset-4 hover:text-nrs-ink focus-visible:outline focus-visible:outline-2">
                      <Trash2 size={13} /> Kaldır
                    </button>
                  </div>
                </div>
              </li>
            })}
          </ul>

          <footer className="shrink-0 border-t border-nrs-ink/10 bg-nrs-warm-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
            {!catalogPricesSynced && <p role="status" className="mb-3 text-xs text-nrs-ink/65">Sepet fiyatları güncel katalogdan kontrol ediliyor…</p>}
            {catalogPricesSynced && priceUpdateNotice && <p role="status" className="mb-3 text-xs text-nrs-ink/65">Sepetinizdeki ürün fiyatları güncellendi. Güncel toplamı kontrol edin.</p>}
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-nrs-ink/65">Ürünler toplamı</dt><dd className="tabular-nums">{money(subtotalAmount)}</dd></div>
              {isOpeningCampaignActive() && <div className="flex justify-between gap-3"><dt className="text-nrs-ink/65">{OPENING_CAMPAIGN.name}</dt><dd className="tabular-nums">−{money(discountAmount)}</dd></div>}
              {shippingAmount > 0 && <div className="flex justify-between gap-3"><dt className="text-nrs-ink/65">Kargo</dt><dd className="tabular-nums">{money(shippingAmount)}</dd></div>}
              <div className="flex justify-between gap-3 border-t border-nrs-ink/10 pt-2"><dt className="font-medium">Ödenecek toplam</dt><dd className="font-serif text-xl tabular-nums">{money(totalAmount)}</dd></div>
            </dl>
            <p className="mt-1 text-[11px] text-nrs-ink/50">Kargo ve teslimat koşulları ödeme öncesinde gösterilir.</p>
            <button type="button" aria-label="Ödemeye geç" disabled={!catalogPricesSynced} onClick={() => { closeDrawer(); router.push('/checkout') }}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-nrs-charcoal px-4 text-sm font-medium text-nrs-ivory hover:bg-nrs-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60">
              {catalogPricesSynced ? <>Ödemeye geç <ArrowRight size={16} /></> : 'Fiyatlar kontrol ediliyor…'}
            </button>
            <div className="mt-2 border-t border-nrs-ink/10 pt-2">
              <CartWhatsappOrder items={items} total={totalAmount} compact />
            </div>
          </footer>
        </>}
      </motion.aside>
    </motion.div>}
  </AnimatePresence>
}
