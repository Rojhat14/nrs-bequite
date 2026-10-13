'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCart } from '@/store/useCart'

export default function LiveObservationEntry({ autoFinalizeAvailable }: { autoFinalizeAvailable: boolean }) {
  const router = useRouter()
  const items = useCart(state => state.items)
  const addItem = useCart(state => state.addItem)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function prepare() {
    if (items.length) {
      setError('Bu özel 3 TL deneme sepeti için önce mevcut sepetinizi tamamlayın veya ürünlerini kaldırın. Mevcut sepetinize dokunmadık.')
      return
    }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/payment/live-observation/product', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || data.product?.id !== 'nrs-garanti-live-3try' || data.product?.variantId == null || data.product?.price !== '₺3') throw new Error('Deneme ürünü şu anda hazırlanamadı.')
      addItem({ id: data.product.id, slug: 'controlled-live-observation-3try', title: data.product.title, price: data.product.price,
        variantId: data.product.variantId, size: data.product.size, category: 'Kontrollü deneme' }, 1)
      router.replace('/checkout')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Deneme ürünü şu anda hazırlanamadı.')
    } finally { setBusy(false) }
  }

  return <main className="min-h-screen bg-nrs-canvas px-6 pt-40 pb-24">
    <section className="mx-auto max-w-xl space-y-6 border border-nrs-ink/15 bg-nrs-panel p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.2em] text-nrs-ink/60">Yalnızca izinli hesap · canlı banka · gözlem modu</p>
      <h1 className="font-serif text-3xl">3 TL kontrollü ödeme denemesi</h1>
      <p className="leading-7">Bu özel ürün genel katalogda yer almaz. Onay ekranı ödeme kanıtı sayılmaz; imza ve bağımsız banka sorgusu doğrulanır.</p>
      {autoFinalizeAvailable
        ? <p className="leading-7">Bu izinli hesap için tek yeni 3 TL siparişte tüm doğrulamalar geçerse sipariş otomatik tamamlanır. Diğer siparişler gözlem modunda kalır.</p>
        : <p className="leading-7">Bu siparişte otomatik tamamlama izni yok; sonuç doğrulanana kadar gözlem modunda kalır.</p>}
      <p className="font-medium">Toplam: 3,00 TL · tek çekim · TRY</p>
      <p className="text-sm leading-6">Bankanın ekranında kart bilgilerinizi yalnızca Garanti’nin sayfasına girin. Bu sitede kart veya CVV alanı yoktur. Ödeme isteğini siz checkout özeti ve sözleşme onayından sonra başlatırsınız.</p>
      <button type="button" onClick={prepare} disabled={busy || items.length > 0} className="min-h-12 w-full bg-nrs-charcoal px-4 text-sm text-nrs-ivory disabled:opacity-50">
        {busy ? 'Hazırlanıyor…' : items.length ? 'Mevcut sepetinizi koruyun; önce boşaltın' : '3 TL deneme siparişini hazırla'}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Link href="/checkout" className="inline-flex min-h-11 items-center underline">Checkout’a dön</Link>
    </section>
  </main>
}
