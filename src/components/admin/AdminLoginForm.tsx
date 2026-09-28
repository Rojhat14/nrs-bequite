'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function AdminLoginForm({ notice }: { notice: string | null }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setErrorMessage('Giriş bilgileri doğrulanamadı. E-posta ve şifrenizi kontrol edin.')
        return
      }

      router.replace('/admin')
      router.refresh()
    } catch {
      setErrorMessage('Giriş şu anda tamamlanamadı. Lütfen daha sonra tekrar deneyin.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5F0] px-5 py-12">
      <section className="w-full max-w-[440px] border border-[#D8D0C3] bg-white px-7 py-10 shadow-[0_24px_80px_rgba(28,25,20,0.07)] sm:px-12 sm:py-14">
        <div className="mb-10 text-center">
          <div className="font-serif text-5xl tracking-[0.18em] text-[#11110F]">NRS</div>
          <div className="mx-auto my-5 h-px w-12 bg-[#B99A62]" />
          <p className="text-[10px] uppercase tracking-[0.48em] text-[#827966]">Admin Atelier</p>
          <h1 className="mt-4 font-serif text-3xl text-[#11110F]">Yönetici girişi</h1>
        </div>

        {notice && (
          <p role="status" className="mb-6 border border-[#D8D0C3] bg-[#F7F5F0] px-4 py-3 text-sm leading-6 text-[#66583F]">
            {notice}
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="mb-6 border border-[#D9B8B1] bg-[#FCF7F5] px-4 py-3 text-sm leading-6 text-[#793C32]">
            {errorMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="admin-email" className="mb-2 block text-[10px] font-medium uppercase tracking-[0.24em] text-[#777165]">
              E-mail
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border border-[#D8D0C3] bg-white px-4 py-3.5 text-sm text-[#11110F] outline-none transition focus:border-[#9E804A] focus:ring-2 focus:ring-[#B99A62]/20"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-2 block text-[10px] font-medium uppercase tracking-[0.24em] text-[#777165]">
              Password
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border border-[#D8D0C3] bg-white px-4 py-3.5 text-sm text-[#11110F] outline-none transition focus:border-[#9E804A] focus:ring-2 focus:ring-[#B99A62]/20"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex min-h-12 w-full items-center justify-center border border-[#11110F] bg-[#11110F] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.3em] text-white transition hover:border-[#8D7447] hover:bg-[#8D7447] focus:outline-none focus:ring-2 focus:ring-[#B99A62] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.18em] text-[#9A9385]">
          NRS · Yönetici erişimi
        </p>
      </section>
    </main>
  )
}
