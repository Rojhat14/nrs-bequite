'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { duplicateProduct } from '@/app/admin/(protected)/actions'

export default function DuplicateProductButton({ productId }: { productId: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    confirmRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        setIsOpen(false)
        requestAnimationFrame(() => triggerRef.current?.focus())
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isPending])

  async function confirmDuplicate() {
    if (isPending) return
    setIsPending(true)
    setError(null)
    try {
      const result = await duplicateProduct(productId)
      if (!result.ok || !result.id) {
        setError(result.message || 'Ürün kopyalanırken bir hata oluştu.')
        setIsPending(false)
        return
      }
      router.push(`/admin/products/${encodeURIComponent(result.id)}?duplicated=1`)
      router.refresh()
    } catch {
      setError('Ürün kopyalanırken bir hata oluştu.')
      setIsPending(false)
    }
  }

  return <>
    <button
      ref={triggerRef}
      type="button"
      onClick={() => { setError(null); setIsOpen(true) }}
      aria-label="Ürünü kopyala"
      title="Kopyala"
      className="ml-3 inline-flex min-h-9 items-center gap-1.5 text-xs text-[#6B5734] underline underline-offset-4 transition-colors hover:text-[#3D3324] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
    >
      <Copy size={14} strokeWidth={1.5} />Kopyala
    </button>

    {isOpen && <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) {
          setIsOpen(false)
          requestAnimationFrame(() => triggerRef.current?.focus())
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`duplicate-title-${productId}`}
        className="w-full max-w-md border border-[#E4DED2] bg-nrs-ivory p-6 shadow-[0_18px_60px_rgba(20,18,15,0.2)] sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="text-[9px] uppercase tracking-[0.24em] text-[#9A8358]">Ürün kataloğu</p>
        <h2 id={`duplicate-title-${productId}`} className="mt-2 font-serif text-2xl">Ürünü kopyala</h2>
        <p className="mt-3 text-sm leading-6 text-[#777165]">Bu ürünü kopyalamak istediğinize emin misiniz? Yeni ürün taslak olarak oluşturulur; görseller, varyantlar ve koleksiyonlar bağımsız kayıtlarla kopyalanır.</p>
        {error && <p role="alert" className="mt-4 border border-rose-200 bg-white px-3 py-2 text-sm text-rose-800">{error}</p>}
        <div className="mt-7 flex justify-end gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => { setIsOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()) }}
            className="admin-secondary"
          >İptal</button>
          <button ref={confirmRef} type="button" disabled={isPending} onClick={confirmDuplicate} className="admin-primary min-w-36">
            {isPending ? 'Kopyalanıyor...' : 'Ürünü Kopyala'}
          </button>
        </div>
      </section>
    </div>}
  </>
}
