import 'server-only'

import { UUID } from '@/lib/payment/request'
import { paymentDatabase } from '@/lib/payment/repository'
import { garantiLiveObservationOnly } from './config'

/** Reads only the bounded, order-bound diagnostic fields after the caller has
 * already verified access to the associated order. Never returns callback text. */
export async function readGarantiLiveSingleFinalizeFailure(orderId: string) {
  if (!garantiLiveObservationOnly() || !UUID.test(orderId)) return null
  const { data, error } = await paymentDatabase().from('garanti_live_single_finalize_failures')
    .select('source,callback_signature_verified,order_match,amount_match,currency_match,terminal_match,request_match,callback_response,callback_procreturncode')
    .eq('order_id', orderId).maybeSingle()
  if (error || !data || data.source !== 'failure') return null
  return data
}
