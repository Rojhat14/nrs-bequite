import 'server-only'
import type { GarantiConfig } from './config'
import type { PaymentOrder } from '@/lib/payment/types'

export type TestQueryEvidence = {
  http: number
  mode_evidence: 'response' | 'test_endpoint_and_request' | 'conflict'
  identity_match: boolean; amount_match: boolean; auth_match: boolean | null
  response_code: string | null; reason_code: string | null; result_code: string | null
  status: 'APPROVED' | 'DECLINED' | 'CANCELLED' | null
  charge_type: 'S' | 'P' | null
  auth_code_present: boolean; bank_reference_present: boolean
}
// The public response table describes Mode values but does not declare presence
// or non-empty cardinality. Only isolated TEST observation/single-finalize paths may use the documented TEST
// HTTPS endpoint + outgoing TEST request when the echo is absent/empty.
// https://dev.garantibbva.com.tr/sanalpos-sorgulama-siparis-sorgulama
// A contradictory/non-scalar echo is never ignored. This is not a settlement DTO.
export function testQueryEvidence(c: GarantiConfig, order: PaymentOrder, q: any, http: number, authCode?: string): TestQueryEvidence {
  if ((!c.observationOnly && !c.singleFinalizeTest) || c.mode !== 'TEST' || c.queryUrl !== 'https://sanalposprovtest.garantibbva.com.tr/VPServlet') throw new Error('TEST query context required.')
  const mode = q.Mode === 'TEST' ? 'response'
    : q.Mode === undefined || q.Mode === '' ? 'test_endpoint_and_request' : 'conflict'
  const r = q.Order?.OrderInqResult
  const code = (v: unknown) => typeof v === 'string' && /^\d{0,4}$/.test(v) ? v : null
  return {
    http, mode_evidence: mode,
    identity_match: mode !== 'conflict' && q.Terminal?.ID === c.terminalId
      && q.Terminal?.MerchantID === c.merchantId && q.Order?.OrderID === order.merchantReference,
    amount_match: r?.AuthAmount === String(order.amountMinor) && order.currency === 'TRY',
    auth_match: authCode === undefined ? null : !!authCode && r?.AuthCode === authCode,
    response_code: code(q.Transaction?.Response?.Code), reason_code: code(q.Transaction?.Response?.ReasonCode), result_code: code(r?.Code),
    status: ['APPROVED', 'DECLINED', 'CANCELLED'].includes(r?.Status) ? r.Status : null,
    charge_type: ['S', 'P'].includes(r?.ChargeType) ? r.ChargeType : null,
    auth_code_present: typeof r?.AuthCode === 'string' && r.AuthCode.length > 0,
    bank_reference_present: typeof r?.RetrefNum === 'string' && r.RetrefNum.length > 0,
  }
}
