import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { controlledLiveAccountAllowed, garantiLiveSingleFinalizeArmed, garantiLiveObservationOnly } from '@/lib/payment/garanti/config'
import { paymentAvailableForUser } from '@/lib/payment/provider'
import { paymentDatabase } from '@/lib/payment/repository'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const unavailable = () => NextResponse.json({ error: 'Bu kontrollü ödeme izni kullanılamıyor.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request: Request) {
  try {
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user || !controlledLiveAccountAllowed(user.id) || !paymentAvailableForUser(user.id)
      || !garantiLiveObservationOnly() || !garantiLiveSingleFinalizeArmed(user.id, 300)) return unavailable()
    const db = paymentDatabase()
    if (new URL(request.url).searchParams.get('verifyRpcs') === '1') {
      const { data, error } = await db.rpc('nrs_test_garanti_live_single_finalize_rpcs', { p_user_id: user.id })
      if (error || !data?.rollback || !data?.anonAuthenticatedDenied) {
        return NextResponse.json({ error: 'Production ödeme RPC doğrulaması tamamlanamadı.', code: 'GARANTI_PROD_RPC_SELFTEST_FAILED' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } })
      }
      return NextResponse.json({ ...data, accountOnly: true, productionObservationOnly: true },
        { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
    }
    const [{ data, error }, unresolved] = await Promise.all([
      db.from('garanti_live_single_finalize_slots').select('slot_id').eq('user_id', user.id)
        .is('claimed_order_id', null).limit(1).maybeSingle(),
      db.from('payment_orders').select('order_id', { count: 'exact', head: true }).eq('user_id', user.id).in('state', ['initiating', 'pending']),
    ])
    if (error) return NextResponse.json({ error: 'İzin durumu doğrulanamadı.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    if (unresolved.error) return NextResponse.json({ error: 'İzin durumu doğrulanamadı.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ armed: true, unused: !!data, amountMinor: 300, currency: 'TRY',
      otherOrdersRemainObservationOnly: true, generalCustomerPaymentsEnabled: false,
      unresolvedExistingOrderCount: unresolved.count ?? 0 },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
  } catch { return unavailable() }
}
