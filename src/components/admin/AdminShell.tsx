'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Boxes,
  X,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Settings,
  ShoppingBag,
  Tags,
  Users,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const navigation = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Ürünler', href: '/admin/products', icon: Boxes },
  { label: 'Kategoriler', href: '/admin/categories', icon: Tags },
  { label: 'Stok', href: '/admin/inventory', icon: PackageCheck },
  { label: 'Siparişler', href: '/admin/orders', icon: ShoppingBag },
  { label: 'Kullanıcılar', href: '/admin/users', icon: Users },
  { label: 'Favoriler', href: '/admin/favorites', icon: Heart },
  { label: 'Ayarlar', href: '/admin/settings', icon: Settings },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin'
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.replace('/admin/login')
      router.refresh()
    } catch {
      setLogoutError('Çıkış yapılamadı. Lütfen tekrar deneyin.')
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] md:flex">
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[#E4DED2] bg-white px-5 md:hidden">
        <Link href="/admin" className="inline-flex items-baseline gap-2"><span className="font-serif text-2xl tracking-[0.16em]">NRS</span><span className="text-[9px] uppercase tracking-[0.24em] text-[#9A8358]">Admin</span></Link>
        <button type="button" aria-label={isMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'} aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((open) => !open)} className="border border-[#E4DED2] p-2 focus:outline-none focus:ring-2 focus:ring-[#B99A62]">
          {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {isMenuOpen && <button aria-label="Menüyü kapat" className="fixed inset-0 z-30 bg-black/25 md:hidden" onClick={() => setIsMenuOpen(false)} />}

      <aside className={`${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-[#E4DED2] bg-white transition-transform md:sticky md:top-0 md:min-h-screen md:w-[260px] md:translate-x-0`}>
        <div className="flex items-center justify-between px-5 py-5 md:block md:px-7 md:pb-8 md:pt-9">
          <Link href="/admin" className="inline-flex items-baseline gap-3 focus:outline-none focus:ring-2 focus:ring-[#B99A62]">
            <span className="font-serif text-3xl tracking-[0.16em] text-[#11110F]">NRS</span>
            <span className="text-[9px] uppercase tracking-[0.28em] text-[#9A8358]">Admin</span>
          </Link>
          <p className="mt-2 hidden text-[9px] uppercase tracking-[0.2em] text-[#A09A8E] md:block">Atelier Management</p>
          <button type="button" aria-label="Menüyü kapat" onClick={() => setIsMenuOpen(false)} className="p-2 md:hidden"><X size={18} /></button>
        </div>

        <nav aria-label="Admin navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3 md:overflow-visible md:px-4 md:py-4">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setIsMenuOpen(false)}
                className={`flex shrink-0 items-center gap-3 border px-3 py-3 text-xs transition focus:outline-none focus:ring-2 focus:ring-[#B99A62] md:w-full ${active ? 'border-[#E5D9BF] bg-[#F8F4EA] text-[#5D4929]' : 'border-transparent text-[#777165] hover:border-[#EEE9DF] hover:bg-[#FAF9F6] hover:text-[#171612]'}`}
              >
                <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-[#EEE9DF] p-4 md:p-5">
          {logoutError && <p role="alert" className="mb-3 text-xs text-[#793C32]">{logoutError}</p>}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-[#777165] transition hover:bg-[#FAF9F6] hover:text-[#11110F] focus:outline-none focus:ring-2 focus:ring-[#B99A62] disabled:opacity-60"
          >
            <LogOut size={16} strokeWidth={1.6} aria-hidden="true" />
            <span>{isLoggingOut ? 'Çıkış yapılıyor…' : 'Çıkış'}</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 pb-8 pt-24 sm:px-8 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  )
}
