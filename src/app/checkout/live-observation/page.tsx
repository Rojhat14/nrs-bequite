import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { paymentAvailableForUser } from '@/lib/payment/provider'
import { controlledLiveAccountAllowed, garantiLiveObservationOnly, garantiLiveSingleFinalizeArmed } from '@/lib/payment/garanti/config'
import { paymentDatabase } from '@/lib/payment/repository'
import LiveObservationEntry from './LiveObservationEntry'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kontrollü ödeme denemesi', robots: { index: false, follow: false } }

export default async function LiveObservationPage() {
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user || !controlledLiveAccountAllowed(user.id) || !paymentAvailableForUser(user.id) || !garantiLiveObservationOnly()) notFound()
  let autoFinalizeAvailable = false
  if (garantiLiveSingleFinalizeArmed(user.id, 300)) {
    try {
      const { data, error } = await paymentDatabase().from('garanti_live_single_finalize_slots')
        .select('slot_id').eq('user_id', user.id).is('claimed_order_id', null).limit(1).maybeSingle()
      autoFinalizeAvailable = !error && !!data
    } catch { /* An unreadable permission stays unavailable in the UI. */ }
  }
  return <LiveObservationEntry autoFinalizeAvailable={autoFinalizeAvailable} />
}
