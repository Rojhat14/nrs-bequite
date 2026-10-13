import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { paymentAvailableForUser } from '@/lib/payment/provider'
import { controlledLiveAccountAllowed, garantiLiveObservationOnly } from '@/lib/payment/garanti/config'
import LiveObservationEntry from './LiveObservationEntry'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kontrollü ödeme denemesi', robots: { index: false, follow: false } }

export default async function LiveObservationPage() {
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user || !controlledLiveAccountAllowed(user.id) || !paymentAvailableForUser(user.id) || !garantiLiveObservationOnly()) notFound()
  return <LiveObservationEntry />
}
