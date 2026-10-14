import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import type { PaymentProvider, PaymentOrder, VerifiedPayment } from '@/lib/payment/types'
import { UUID } from '@/lib/payment/request'
import { controlledLiveAccountAllowed, garantiConfig, type GarantiConfig } from './config'
import { loadGarantiOrder } from './order'
import { testQueryEvidence, type TestQueryEvidence } from './query-evidence'
import { bankFields, initiationHash, equalHex, isoBytes, ReturnSignatureError, parseReturn, verifyReturnHash, queryXml, parseQuery, scalar } from './protocol'

export class GarantiPending extends Error {
  constructor(readonly reference: string) { super('Payment awaits bank reconciliation.') }
}
function authDateFormat(value: unknown): 'missing' | 'yyyymmdd' | 'timestamp' | 'invalid' {
  if (value === undefined || value === '') return 'missing'
  if (typeof value !== 'string') return 'invalid'
  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4)), month = Number(value.slice(4, 6)), day = Number(value.slice(6, 8))
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.toISOString().slice(0, 10) === `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` ? 'yyyymmdd' : 'invalid'
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(value)) {
    const date = new Date(`${value.replace(' ', 'T')}Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().replace('T', ' ').replace('Z', '') === value ? 'timestamp' : 'invalid'
  }
  return 'invalid'
}
export type SuccessfulTestReturnEvidence = {
  order_id: string
  signature_verified: true
  order_match: true; amount_match: true; currency_match: true; terminal_match: true; request_match: true
  query_evidence: TestQueryEvidence
}
export type SuccessfulLiveReturnEvidence = {
  order_id: string; signature_verified: true; signature_algorithm: 'sha1'; signature_encoding: 'iso-8859-9'
  order_match: true; amount_match: true; currency_match: true; terminal_match: true; request_match: true
  callback_mdstatus: '1'; callback_response: 'approved'; callback_procreturncode: '00'
  query_http: number; query_order_match: true; query_identity_match: true; query_amount_match: true
  query_result_codes_match: true; query_status: 'APPROVED'; query_charge_type: 'S'
  auth_date_format: 'missing' | 'yyyymmdd' | 'timestamp'; auth_code_match: true; bank_reference_present: true
}
export type LiveReconciliationEvidence = {
  order_id: string; http: number | null; decision: 'verified_success' | 'verified_failure' | 'pending'
  reason: string; order_match: boolean | null; terminal_match: boolean | null; mode_match: boolean | null
  order_currency_match?: boolean | null
  prov_user_match: boolean | null; agent_user_match: boolean | null; order_result_present: boolean | null
  amount_match: boolean | null; outer_response_code: string | null; outer_reason_code: string | null
  result_code: string | null; result_reason_code: string | null; status: string | null; charge_type: string | null
  auth_amount_state: 'missing' | 'zero' | 'matching' | 'other' | null
  auth_code_present: boolean | null; bank_reference_present: boolean | null
  history_http?: number | null; history_transaction_code?: string | null; history_transaction_reason_code?: string | null
  history_result_state?: string | null; history_record_count?: number | null; history_identity_match?: boolean | null
  payment_event_count?: number; signed_callback_evidence_count?: number; live_finalize_evidence_count?: number
}
type SuccessfulLiveQueryEvidence = Pick<SuccessfulLiveReturnEvidence,
  'query_http' | 'query_order_match' | 'query_identity_match' | 'query_amount_match' | 'query_result_codes_match'
  | 'query_status' | 'query_charge_type' | 'auth_date_format' | 'auth_code_match' | 'bank_reference_present'>
export class GarantiProvider implements PaymentProvider {
  get settlementDisabled() { return this.config.observationOnly === true || this.config.liveObservationOnly === true }
  get testObservationOnly() { return this.config.observationOnly === true }
  get initiationMaxAmountMinor() { return this.config.initiationMaxAmountMinor }
  readonly name = 'garanti-oos'
  readonly merchantId: string
  readonly allowedRedirectOrigins: readonly string[]
  private lastTestQueryEvidence: TestQueryEvidence | null = null
  private successfulTestReturnEvidence: SuccessfulTestReturnEvidence | null = null
  private lastSuccessfulLiveQueryEvidence: SuccessfulLiveQueryEvidence | null = null
  private successfulLiveReturnEvidence: SuccessfulLiveReturnEvidence | null = null
  private lastLiveReconciliationEvidence: LiveReconciliationEvidence | null = null
  private liveReturnVerification: Record<string, unknown> | null = null
  private verificationStage: 'callback_parse' | 'callback_signature' | 'order_lookup' | 'callback_match'
    | 'orderinq_request' | 'orderinq_response' | 'orderinq_identity' | 'orderinq_status' | 'orderinq_result'
    | 'orderinq_capture' | 'orderinq_auth_code' | 'verified_payment' = 'callback_parse'
  get lastVerificationStage() { return this.verificationStage }
  takeLiveReturnVerification() {
    const evidence = this.liveReturnVerification
    this.liveReturnVerification = null
    return evidence
  }
  constructor(readonly config: GarantiConfig = garantiConfig(),
    private readonly loadOrder: (id: string) => Promise<PaymentOrder> = loadGarantiOrder,
    private readonly transport: typeof fetch = fetch) {
    this.merchantId = config.merchantId
    this.allowedRedirectOrigins = [config.siteOrigin]
  }
  async initiate(order: PaymentOrder, _key: string, context?: { customerIp: string }) {
    if (order.state !== 'initiating' || order.id !== order.merchantReference || !UUID.test(order.id)
      || order.currency !== 'TRY' || !Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0
      || !context || isIP(context.customerIp) !== 4) throw new Error('Invalid bank initiation.')
    const payload = Buffer.from(JSON.stringify({ id: order.id, ip: context.customerIp, exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url')
    const signature = this.sign(payload)
    return { redirectUrl: `${this.config.siteOrigin}/api/payment/garanti/handoff?token=${payload}.${signature}` }
  }
  private sign(payload: string) { return createHmac('sha256', this.config.handoffSecret).update(payload).digest('hex') }
  handoff(token: string, allowExpired = false) {
    if (token.length > 1000) throw new Error('Invalid handoff.')
    const [payload, signature, extra] = token.split('.')
    if (extra || !payload || !/^[a-f0-9]{64}$/.test(signature || '') || !timingSafeEqual(Buffer.from(signature), Buffer.from(this.sign(payload)))) throw new Error('Invalid handoff.')
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!UUID.test(value.id) || isIP(value.ip) !== 4 || !Number.isSafeInteger(value.exp) || (!allowExpired && value.exp < Date.now() / 1000)) throw new Error('Expired handoff.')
    return value as { id: string; ip: string; exp: number }
  }
  fields(order: PaymentOrder, ip: string) { return bankFields(this.config, order, ip) }
  returnChecks(f: Record<string, string>, order: PaymentOrder) {
    const c = this.config
    return {
      order_match: f.oid === order.merchantReference && f.orderid === order.merchantReference,
      amount_match: f.txnamount === String(order.amountMinor),
      currency_match: f.txncurrencycode === '949' && order.currency === 'TRY',
      terminal_match: f.clientid === c.terminalId && f.terminalid === c.terminalId && f.terminalmerchantid === c.merchantId,
      request_match: f.mode === c.mode && f.apiversion === '512' && f.txntype === 'sales'
        && f.secure3dsecuritylevel === '3D_OOS_PAY' && f.txninstallmentcount === c.installment
        && f.successurl === c.successUrl && f.errorurl === c.errorUrl
        && equalHex(f.secure3dhash || '', initiationHash(c, order)),
    }
  }
  async verifyCallback(raw: string, headers: Headers) { return this.verifyReturn(raw, headers) }
  async verifyReturn(raw: string, headers: Headers): Promise<VerifiedPayment> {
    const c = this.config
    this.verificationStage = 'callback_parse'
    this.lastTestQueryEvidence = null
    this.successfulTestReturnEvidence = null
    this.lastSuccessfulLiveQueryEvidence = null
    this.successfulLiveReturnEvidence = null
    this.liveReturnVerification = null
    // Garanti's Production common-payment callback may repeat terminalid.
    // parseReturn collapses only when every decoded occurrence is identical;
    // conflicting values still fail before signature or payment checks.
    const f = parseReturn(raw, headers, { allowIdenticalDuplicates: true })
    // The bank documents hash checking for successful (00) returns only. Failed
    // unsigned returns may not cancel a DB order or release reserved stock.
    this.verificationStage = 'callback_signature'
    try { verifyReturnHash(c, f) } catch (error) {
      if (c.liveObservationOnly || c.liveDiagnostics) console.info(JSON.stringify({ event: 'garanti_live_return_rejected',
        order_id: UUID.test(f.oid || '') ? f.oid : null, signature_verified: false,
        signature_result: error instanceof ReturnSignatureError ? error.result : 'verification_error' }))
      throw error
    }
    this.verificationStage = 'order_lookup'
    const order = await this.loadOrder(f.oid)
    this.verificationStage = 'callback_match'
    const matches = this.returnChecks(f, order)
    if (c.liveObservationOnly || c.liveDiagnostics) this.liveReturnVerification = {
      signature_verified: true,
      signature_result: 'verified',
      ...matches,
      callback_mdstatus: /^\d$/.test(f.mdstatus || '') ? f.mdstatus : null,
      callback_response: ['approved', 'declined', 'error', 'failed'].includes((f.response || '').toLowerCase()) ? f.response.toLowerCase() : null,
      callback_procreturncode: /^\d{2}$/.test(f.procreturncode || '') ? f.procreturncode : null,
    }
    if (c.liveObservationOnly || c.liveDiagnostics) {
      const safe = (value: string) => /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : (value ? 'invalid' : 'missing')
      console.info(JSON.stringify({ event: 'garanti_live_return_verified', order_id: order.id,
        signature_verified: true, signature_result: 'verified', signature_algorithm: 'sha1',
        signature_encoding: 'iso-8859-9', ...matches, mdstatus: safe(f.mdstatus || ''),
        response: safe(f.response || ''), procreturncode: safe(f.procreturncode || '') }))
    }
    if (!Object.values(matches).every(Boolean)) throw new Error('Bank return order mismatch.')
    const result = await this.query(order, f.customeripaddress, f.authcode, true)
    this.verificationStage = 'verified_payment'
    if (result.status === 'paid' && (f.procreturncode !== '00' || f.response.toLowerCase() !== 'approved' || f.mdstatus !== '1')) throw new GarantiPending(order.id)
    if (result.status === 'paid' && c.mode === 'TEST' && c.singleFinalizeTest && this.lastTestQueryEvidence) {
      this.successfulTestReturnEvidence = { order_id: order.id, signature_verified: true,
        order_match: true, amount_match: true, currency_match: true, terminal_match: true, request_match: true,
        query_evidence: this.lastTestQueryEvidence }
    }
    const liveQueryEvidence = this.lastSuccessfulLiveQueryEvidence as SuccessfulLiveQueryEvidence | null
    if (result.status === 'paid' && c.mode === 'PROD' && liveQueryEvidence
      && f.mdstatus === '1' && f.response.toLowerCase() === 'approved' && f.procreturncode === '00') {
      this.successfulLiveReturnEvidence = { order_id: order.id, signature_verified: true,
        signature_algorithm: 'sha1', signature_encoding: 'iso-8859-9', order_match: true,
        amount_match: true, currency_match: true, terminal_match: true, request_match: true,
        callback_mdstatus: '1', callback_response: 'approved', callback_procreturncode: '00',
        query_http: liveQueryEvidence.query_http, query_order_match: liveQueryEvidence.query_order_match,
        query_identity_match: liveQueryEvidence.query_identity_match, query_amount_match: liveQueryEvidence.query_amount_match,
        query_result_codes_match: liveQueryEvidence.query_result_codes_match, query_status: liveQueryEvidence.query_status,
        query_charge_type: liveQueryEvidence.query_charge_type, auth_date_format: liveQueryEvidence.auth_date_format,
        auth_code_match: liveQueryEvidence.auth_code_match, bank_reference_present: liveQueryEvidence.bank_reference_present }
    }
    // Strict fully authenticated 3DS only; half/attempted authentication is not
    // silently accepted. Query, not browser response, decides captured status.
    return { ...result, threeDS: result.status === 'paid' ? 'authenticated' : 'failed' }
  }
  takeSuccessfulTestReturnEvidence() {
    const evidence = this.successfulTestReturnEvidence
    this.successfulTestReturnEvidence = null
    return evidence
  }
  takeSuccessfulLiveReturnEvidence() {
    const evidence = this.successfulLiveReturnEvidence
    this.successfulLiveReturnEvidence = null
    return evidence
  }
  takeLiveReconciliationEvidence() {
    const evidence = this.lastLiveReconciliationEvidence
    this.lastLiveReconciliationEvidence = null
    return evidence
  }
  private async inquire(order: PaymentOrder, ip: string, queryType: 'orderinq' | 'orderhistoryinq' = 'orderinq') {
    if (isIP(ip) !== 4) throw new GarantiPending(order.id)
    const c = this.config
    const endpoint = c.mode === 'TEST' ? 'https://sanalposprovtest.garantibbva.com.tr/VPServlet' : 'https://sanalposprov.garanti.com.tr/VPServlet'
    if (c.queryUrl !== endpoint) throw new Error('Bank query endpoint mismatch.')
    let response: Response
    try {
      response = await this.transport(c.queryUrl, { method: 'POST', redirect: 'error', cache: 'no-store',
        headers: { 'Content-Type': 'text/xml; charset=iso-8859-9' },
        body: new Uint8Array(isoBytes(queryXml(c, order, ip, queryType))), signal: AbortSignal.timeout(10000) })
    } catch { throw new GarantiPending(order.id) }
    if (!response.ok || !response.body) throw new GarantiPending(order.id)
    const reader = response.body.getReader(); let length = 0; const chunks: Uint8Array[] = []
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break
        length += value.length; if (length > 65536) { await reader.cancel(); throw new GarantiPending(order.id) } chunks.push(value) }
    } finally { reader.releaseLock() }
    const bytes = Buffer.concat(chunks)
    const charset = response.headers.get('content-type') || ''
    const xml = new TextDecoder(/utf-8/i.test(charset) || /encoding=["']utf-8/i.test(bytes.subarray(0, 100).toString()) ? 'utf-8' : 'windows-1254', { fatal: true }).decode(bytes)
    const q = parseQuery(xml)
    return { http: response.status, q }
  }
  async observeQuery(order: PaymentOrder, ip: string, authCode?: string) {
    if (!this.config.observationOnly || this.config.mode !== 'TEST') throw new Error('TEST observation required.')
    const { http, q } = await this.inquire(order, ip)
    const evidence = testQueryEvidence(this.config, order, q, http, authCode)
    console.info(JSON.stringify({ event: 'garanti_test_orderinq', ...evidence }))
    return evidence
  }
  // Authenticated, fixed-order diagnostics may inspect a Production inquiry,
  // but never create a sale, write the order, or call the finalize RPC.
  async readOnlyOrderInquiry(order: PaymentOrder & { userId: string; redirectUrl: string | null }, userId: string, expectedBankReference?: string) {
    const c = this.config
    if (!c.liveObservationOnly || c.mode !== 'PROD' || !controlledLiveAccountAllowed(userId)
      || order.userId !== userId || order.state !== 'pending') throw new Error('Live read-only inquiry is not authorized.')
    if (c.queryUser !== 'PROVAUT' || c.queryAgentUserId !== 'PROVAUT') throw new Error('Live query identity configuration mismatch.')
    if (!order.redirectUrl) throw new Error('Submitted handoff is required.')
    const redirect = new URL(order.redirectUrl)
    const token = redirect.searchParams.get('token')
    if (redirect.origin !== c.siteOrigin || redirect.pathname !== '/api/payment/garanti/handoff'
      || redirect.searchParams.get('used') !== '1' || !token) throw new Error('Submitted handoff is required.')
    const handoff = this.handoff(token, true)
    if (handoff.id !== order.id) throw new Error('Handoff order mismatch.')

    const { http, q } = await this.inquire(order, handoff.ip)
    const safeCode = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null
    const response = q.Transaction?.Response
    const result = q.Order?.OrderInqResult
    const mode = safeCode(q.Mode)
    const echo = q.Terminal
    const authDateShape = authDateFormat(result?.AuthDate)
    const evidence = {
      order_id: order.id,
      http,
      request_mode: 'PROD',
      request_currency_code: '949',
      order_currency_match: order.currency === 'TRY',
      request_terminal_matches_config: true,
      request_prov_user_matches_expected: c.queryUser === 'PROVAUT',
      request_agent_user_matches_expected: c.queryAgentUserId === 'PROVAUT',
      response_mode_match: mode === null ? null : mode === 'PROD',
      response_prov_user_match: typeof echo?.ProvUserID === 'string' ? echo.ProvUserID === c.queryUser : null,
      response_agent_user_match: typeof echo?.UserID === 'string' ? echo.UserID === c.queryAgentUserId : null,
      response_terminal_match: typeof echo?.ID === 'string' ? echo.ID === c.terminalId : null,
      response_merchant_match: typeof echo?.MerchantID === 'string' ? echo.MerchantID === c.merchantId : null,
      response_order_match: typeof q.Order?.OrderID === 'string' ? q.Order.OrderID === order.merchantReference : null,
      transaction_code: safeCode(response?.Code),
      transaction_reason_code: safeCode(response?.ReasonCode),
      order_result_code: safeCode(result?.Code),
      order_result_reason_code: safeCode(result?.ReasonCode),
      status: safeCode(result?.Status),
      charge_type: safeCode(result?.ChargeType),
      auth_amount_match: typeof result?.AuthAmount === 'string' ? result.AuthAmount === String(order.amountMinor) : null,
      auth_code_present: typeof result?.AuthCode === 'string' && result.AuthCode.length > 0,
      bank_reference_present: typeof result?.RetrefNum === 'string' && result.RetrefNum.length > 0,
      auth_date_format: authDateShape,
      mode_evidence: mode === null ? 'missing' : mode === 'PROD' ? 'response' : 'conflict',
      order_result_success_codes_match: result?.Code === '00' && result?.ReasonCode === '00',
      reported_bank_reference_match: expectedBankReference
        ? result?.RetrefNum === expectedBankReference : null,
      database_changed: false,
      sale_started: false,
      finalize_called: false,
    }
    console.info(JSON.stringify({ event: 'garanti_live_read_only_orderinq', ...evidence }))
    return evidence
  }
  async readOnlyOrderHistoryInquiry(order: PaymentOrder & { userId: string; redirectUrl: string | null }, userId: string) {
    const c = this.config
    if (!c.liveObservationOnly || c.mode !== 'PROD' || !controlledLiveAccountAllowed(userId)
      || order.userId !== userId || order.state !== 'pending') throw new Error('Live read-only history inquiry is not authorized.')
    if (c.queryUser !== 'PROVAUT' || c.queryAgentUserId !== 'PROVAUT' || !order.redirectUrl) throw new Error('Live query identity configuration mismatch.')
    const redirect = new URL(order.redirectUrl)
    const token = redirect.searchParams.get('token')
    if (redirect.origin !== c.siteOrigin || redirect.pathname !== '/api/payment/garanti/handoff'
      || redirect.searchParams.get('used') !== '1' || !token) throw new Error('Submitted handoff is required.')
    const handoff = this.handoff(token, true)
    if (handoff.id !== order.id) throw new Error('Handoff order mismatch.')
    const { http, q } = await this.inquire(order, handoff.ip, 'orderhistoryinq')
    const safeCode = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null
    const safeAmount = (value: unknown) => typeof value === 'string' && /^\d{1,17}$/.test(value) ? value : null
    const safeDate = (value: unknown) => typeof value === 'string' && /^[0-9 .:-]{0,32}$/.test(value) ? value : null
    const response = q.Transaction?.Response
    const result = q.Order?.OrderHistInqResult
    const rawRows = result?.OrderTxnList?.OrderTxn
    const rows: unknown[] = rawRows === undefined ? [] : Array.isArray(rawRows) ? rawRows : [rawRows]
    const records = rows.map((value, index) => {
      const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
      const reference = row.RetrefNum
      return { index: index + 1, type: safeCode(row.Type), status: safeCode(row.Status),
        auth_amount_minor: safeAmount(row.AuthAmount), void_date: safeDate(row.VoidDate),
        return_code: safeCode(row.ReturnCode), transaction_reference_present: typeof reference === 'string' && reference.length > 0,
        currency_code: safeCode(row.CurrencyCode) }
    })
    const mode = safeCode(q.Mode)
    const echo = q.Terminal
    const resultState = result === undefined ? 'missing' : result.OrderTxnList === undefined ? 'missing_list'
      : rows.length === 0 ? 'empty' : rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)) ? 'invalid_rows' : 'present'
    return { order_id: order.id, http, request_type: 'orderhistoryinq', request_mode: 'PROD',
      request_amount_minor: order.amountMinor, request_currency_code: '949', order_currency_match: order.currency === 'TRY',
      request_terminal_matches_config: true, request_prov_user_matches_expected: c.queryUser === 'PROVAUT',
      request_agent_user_matches_expected: c.queryAgentUserId === 'PROVAUT',
      response_mode_match: mode === null ? null : mode === 'PROD',
      response_prov_user_match: typeof echo?.ProvUserID === 'string' ? echo.ProvUserID === c.queryUser : null,
      response_agent_user_match: typeof echo?.UserID === 'string' ? echo.UserID === c.queryAgentUserId : null,
      response_terminal_match: typeof echo?.ID === 'string' ? echo.ID === c.terminalId : null,
      response_merchant_match: typeof echo?.MerchantID === 'string' ? echo.MerchantID === c.merchantId : null,
      response_order_match: typeof q.Order?.OrderID === 'string' ? q.Order.OrderID === order.merchantReference : null,
      transaction_code: safeCode(response?.Code), transaction_reason_code: safeCode(response?.ReasonCode),
      result_state: resultState, record_count: records.length, records,
      database_changed: false, sale_started: false, cancel_started: false, refund_started: false, finalize_called: false }
  }
  async reconcileOwnedPendingOrder(orderId: string, userId: string, paymentProof: {
    payment_event_count: number; signed_callback_evidence_count: number; live_finalize_evidence_count: number
  }): Promise<VerifiedPayment> {
    if (!this.config.liveObservationOnly || this.config.mode !== 'PROD' || !controlledLiveAccountAllowed(userId)) {
      throw new Error('Owned reconciliation is not authorized.')
    }
    const stored = await this.loadOrder(orderId) as PaymentOrder & { userId?: string; redirectUrl?: string | null }
    if (stored.userId !== userId || stored.state !== 'pending' || stored.currency !== 'TRY' || !stored.redirectUrl
      || (this.config.initiationMaxAmountMinor !== null && stored.amountMinor > this.config.initiationMaxAmountMinor)) {
      throw new Error('Owned pending order unavailable.')
    }
    const redirect = new URL(stored.redirectUrl)
    const token = redirect.searchParams.get('token')
    if (redirect.origin !== this.config.siteOrigin || redirect.pathname !== '/api/payment/garanti/handoff'
      || redirect.searchParams.get('used') !== '1' || !token) throw new Error('Submitted handoff is required.')
    const handoff = this.handoff(token, true)
    if (handoff.id !== stored.id) throw new Error('Handoff order mismatch.')
    const settlementProvider = new GarantiProvider({ ...this.config, liveObservationOnly: false,
      capturedStatus: 'APPROVED', capturedResultCode: '00', saleChargeType: 'S', failedStatuses: this.config.failedStatuses },
      this.loadOrder, this.transport)
    let payment: VerifiedPayment | null = null
    let orderinqFailure: unknown = null
    try {
      payment = await settlementProvider.query(stored, handoff.ip)
      this.lastLiveReconciliationEvidence = settlementProvider.takeLiveReconciliationEvidence()
    } catch (error) {
      orderinqFailure = error
      this.lastLiveReconciliationEvidence = settlementProvider.takeLiveReconciliationEvidence()
      const isOrderRecordMissing = this.lastLiveReconciliationEvidence?.http === 200
        && this.lastLiveReconciliationEvidence.outer_response_code === '92'
        && this.lastLiveReconciliationEvidence.outer_reason_code === '0110'
      if (!isOrderRecordMissing) throw error
    }

    const isOrderRecordMissing = !payment && this.lastLiveReconciliationEvidence?.http === 200
      && this.lastLiveReconciliationEvidence.outer_response_code === '92'
      && this.lastLiveReconciliationEvidence.outer_reason_code === '0110'
    if (isOrderRecordMissing) {
      const orderinq = this.lastLiveReconciliationEvidence!
      const history = await this.readOnlyOrderHistoryInquiry(stored as PaymentOrder & { userId: string; redirectUrl: string | null }, userId)
      const orderinqIdentityMatch = orderinq.order_match === true && orderinq.terminal_match === true
        && orderinq.order_currency_match === true
        && orderinq.prov_user_match === true && orderinq.agent_user_match === true && orderinq.mode_match !== false
      const historyIdentityMatch = history.response_terminal_match === true && history.response_merchant_match === true
        && history.response_order_match === true && history.order_currency_match === true
        && history.request_terminal_matches_config === true && history.request_prov_user_matches_expected === true
        && history.request_agent_user_matches_expected === true && history.response_mode_match !== false
        && history.response_prov_user_match === true && history.response_agent_user_match === true
      const pairedNoRecord = history.http === 200 && history.transaction_code === '92'
        && history.transaction_reason_code === '0108' && history.result_state === 'empty'
        && history.record_count === 0 && orderinqIdentityMatch && historyIdentityMatch
        // Garanti can return an OrderInqResult envelope with only AuthAmount=0
        // even when the outer response says no order record exists. Treat that
        // as an empty result shell, never as proof of zero capture. Non-empty
        // sale status/codes, a nonzero amount, or transaction references make
        // the pair conflicting and keep it unconfirmed.
        && (orderinq.order_result_present === false || (
          !orderinq.status && !orderinq.result_code && !orderinq.result_reason_code
          && ['missing', 'zero'].includes(orderinq.auth_amount_state || '')
          && orderinq.auth_code_present === false && orderinq.bank_reference_present === false
        ))
      const noPaymentProof = paymentProof.payment_event_count === 0
        && paymentProof.signed_callback_evidence_count === 0 && paymentProof.live_finalize_evidence_count === 0
      this.lastLiveReconciliationEvidence = {
        ...orderinq,
        decision: 'pending',
        reason: pairedNoRecord && noPaymentProof ? 'GARANTI_BANK_RECORD_NOT_FOUND'
          : pairedNoRecord ? 'GARANTI_BANK_RECORD_NOT_FOUND_CONFLICTING_PAYMENT_EVIDENCE'
            : 'GARANTI_BANK_RECORD_NOT_FOUND_PAIR_UNCONFIRMED',
        history_http: history.http,
        history_transaction_code: history.transaction_code,
        history_transaction_reason_code: history.transaction_reason_code,
        history_result_state: history.result_state,
        history_record_count: history.record_count,
        history_identity_match: historyIdentityMatch,
        payment_event_count: paymentProof.payment_event_count,
        signed_callback_evidence_count: paymentProof.signed_callback_evidence_count,
        live_finalize_evidence_count: paymentProof.live_finalize_evidence_count,
      }
      // The pair documents a missing bank record, not a terminal decline. Keep
      // this payment pending and its reservation intact; a new idempotency key
      // may create a separately stock-checked order for this account.
      throw new GarantiPending(orderId)
    }

    if (!payment) {
      if (orderinqFailure) throw orderinqFailure
      throw new GarantiPending(orderId)
    }
    try {
      const history = await this.readOnlyOrderHistoryInquiry(stored as PaymentOrder & { userId: string; redirectUrl: string | null }, userId)
      const historyIdentityMatch = history.response_terminal_match === true && history.response_merchant_match === true
        && history.response_order_match === true && history.order_currency_match === true
        && history.request_terminal_matches_config === true && history.request_prov_user_matches_expected === true
        && history.request_agent_user_matches_expected === true
        && history.response_mode_match !== false && history.response_prov_user_match !== false
        && history.response_agent_user_match !== false
      const historyCompleteEmpty = history.http === 200 && history.transaction_code === '00'
        && (!history.transaction_reason_code || history.transaction_reason_code === '00')
        && history.result_state === 'empty' && history.record_count === 0 && historyIdentityMatch
      if (this.lastLiveReconciliationEvidence) this.lastLiveReconciliationEvidence = {
        ...this.lastLiveReconciliationEvidence,
        history_http: history.http,
        history_transaction_code: history.transaction_code,
        history_transaction_reason_code: history.transaction_reason_code,
        history_result_state: history.result_state,
        history_record_count: history.record_count,
        history_identity_match: historyIdentityMatch,
      }
      if (payment.status === 'failed' && !historyCompleteEmpty) {
        if (this.lastLiveReconciliationEvidence) this.lastLiveReconciliationEvidence = {
          ...this.lastLiveReconciliationEvidence, decision: 'pending',
          reason: 'GARANTI_ORDERHISTORYINQ_INCOMPLETE_OR_RECORDS_PRESENT',
        }
        throw new GarantiPending(orderId)
      }
      if (payment.status === 'paid') {
        if (this.lastLiveReconciliationEvidence) this.lastLiveReconciliationEvidence = {
          ...this.lastLiveReconciliationEvidence, decision: 'pending',
          reason: 'GARANTI_SIGNED_SUCCESS_RETURN_REQUIRED',
        }
        throw new GarantiPending(orderId)
      }
      return payment
    } catch (error) {
      const evidence = settlementProvider.takeLiveReconciliationEvidence()
      if (evidence && !this.lastLiveReconciliationEvidence) this.lastLiveReconciliationEvidence = evidence
      throw error
    }
  }
  // One existing, operator-authorized Production order can be reconciled once
  // its order-bound signed callback has been verified from protected runtime
  // evidence. Both exact-order environment gates are set only for that order.
  async verifyAuthorizedExistingLiveOrder(orderId: string, userId: string) {
    const targetOrderId = 'f5bf8734-85e1-4a2f-8d04-c8d0145573ea'
    if (!this.config.liveObservationOnly || !controlledLiveAccountAllowed(userId)
      || orderId !== targetOrderId || process.env.GARANTI_LIVE_SINGLE_FINALIZE_ORDER_ID !== targetOrderId
      || process.env.GARANTI_LIVE_VERIFIED_CALLBACK_ORDER_ID !== targetOrderId) throw new Error('Single-order live finalize is not authorized.')
    const stored = await this.loadOrder(orderId) as PaymentOrder & { userId?: string; redirectUrl?: string | null }
    if (stored.userId !== userId || stored.currency !== 'TRY' || stored.amountMinor !== 300
      || !['pending', 'paid'].includes(stored.state) || !stored.redirectUrl) throw new Error('Single-order live finalize order mismatch.')
    const redirect = new URL(stored.redirectUrl)
    const token = redirect.searchParams.get('token')
    if (redirect.origin !== this.config.siteOrigin || redirect.pathname !== '/api/payment/garanti/handoff'
      || redirect.searchParams.get('used') !== '1' || !token) throw new Error('Submitted handoff is required.')
    const handoff = this.handoff(token, true)
    if (handoff.id !== orderId) throw new Error('Handoff order mismatch.')
    const settlementProvider = new GarantiProvider({ ...this.config, liveObservationOnly: false,
      capturedStatus: 'APPROVED', capturedResultCode: '00', saleChargeType: 'S', failedStatuses: [] }, this.loadOrder, this.transport)
    const verified = await settlementProvider.query(stored, handoff.ip)
    if (verified.status !== 'paid' || verified.amountMinor !== 300 || verified.currency !== 'TRY') throw new GarantiPending(orderId)
    return { ...verified, threeDS: 'authenticated' as const }
  }
  private async observeLiveQuery(order: PaymentOrder, ip: string, authCode: string | undefined, signedReturnVerified: boolean): Promise<never> {
    try {
      const { http, q } = await this.inquire(order, ip)
      const optional = (value: unknown) => value === undefined ? '' : scalar(value)
      const safe = (value: string) => /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : (value ? 'invalid' : 'missing')
      const r = q.Order?.OrderInqResult
      const response = q.Transaction?.Response
      const mode = optional(q.Mode)
      const orderId = optional(q.Order?.OrderID)
      const terminalId = optional(q.Terminal?.ID)
      const merchantId = optional(q.Terminal?.MerchantID)
      const authAmount = optional(r?.AuthAmount)
      const responseCode = optional(response?.Code)
      const responseReasonCode = optional(response?.ReasonCode)
      const resultCode = optional(r?.Code)
      const resultReasonCode = optional(r?.ReasonCode)
      const bankAuthCode = optional(r?.AuthCode)
      const presentResponseCodes = [responseCode, responseReasonCode].filter(Boolean)
      const checks = {
        order_match: orderId === order.merchantReference,
        terminal_match: terminalId === this.config.terminalId && merchantId === this.config.merchantId,
        mode_match: mode === '' ? null : mode === 'PROD',
        amount_match: authAmount === '' ? null : authAmount === String(order.amountMinor),
        explicit_response_ok: presentResponseCodes.length ? presentResponseCodes.every(code => code === '00') : null,
        order_result_success_codes_match: resultCode === '00' && resultReasonCode === '00',
        signed_return_verified: signedReturnVerified,
        auth_code_match: authCode === undefined || !bankAuthCode ? null : bankAuthCode === authCode,
      }
      this.verificationStage = !checks.order_match || !checks.terminal_match ? 'orderinq_identity'
        : presentResponseCodes.some(code => code !== '00') ? 'orderinq_status'
          : resultCode !== '00' || resultReasonCode !== '00' || optional(r?.Status) !== 'APPROVED'
            ? 'orderinq_result' : 'verified_payment'
      console.info(JSON.stringify({ event: 'garanti_live_observation', order_id: order.id, http,
        ...checks, mode: safe(mode), response_code: safe(responseCode), response_reason_code: safe(responseReasonCode),
        order_result_code: safe(resultCode), order_result_reason_code: safe(resultReasonCode),
        status: safe(optional(r?.Status)), charge_type: safe(optional(r?.ChargeType)),
        auth_date_format: authDateFormat(r?.AuthDate) }))
      // Live response-field semantics are not confirmed. Preserve all positive
      // evidence for review, but never create a settlement DTO in this mode.
    } catch {
      console.info(JSON.stringify({ event: 'garanti_live_observation', order_id: order.id,
        signed_return_verified: signedReturnVerified, query_received: false,
        order_match: null, query_result: 'unavailable_or_ambiguous' }))
    }
    throw new GarantiPending(order.id)
  }
  async query(order: PaymentOrder, ip: string, authCode?: string, signedReturnVerified = false): Promise<VerifiedPayment> {
    const c = this.config
    if (c.observationOnly) {
      await this.observeQuery(order, ip, authCode)
      throw new GarantiPending(order.id)
    }
    if (c.liveObservationOnly) {
      this.verificationStage = 'orderinq_request'
      return this.observeLiveQuery(order, ip, authCode, signedReturnVerified)
    }
    this.verificationStage = 'orderinq_request'
    const { http, q } = await this.inquire(order, ip)
    const r = q.Order?.OrderInqResult
    const response = q.Transaction?.Response
    const safeField = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null
    const authAmount = r?.AuthAmount === undefined ? '' : typeof r.AuthAmount === 'string' ? r.AuthAmount : '__invalid__'
    const modeValue = q.Mode === undefined ? '' : typeof q.Mode === 'string' ? q.Mode : '__invalid__'
    const queryEvidence: LiveReconciliationEvidence = {
      order_id: order.id, http, decision: 'pending', reason: 'GARANTI_ORDERINQ_UNCLASSIFIED',
      order_currency_match: order.currency === 'TRY',
      order_match: q.Order?.OrderID === order.merchantReference,
      terminal_match: q.Terminal?.ID === c.terminalId && q.Terminal?.MerchantID === c.merchantId,
      mode_match: modeValue === '' ? null : modeValue === c.mode,
      prov_user_match: q.Terminal?.ProvUserID === undefined ? null : scalar(q.Terminal.ProvUserID) === c.queryUser,
      agent_user_match: q.Terminal?.UserID === undefined ? null : scalar(q.Terminal.UserID) === c.queryAgentUserId,
      order_result_present: r !== undefined,
      amount_match: authAmount === '' || authAmount === '__invalid__' ? null : authAmount === String(order.amountMinor),
      outer_response_code: safeField(response?.Code), outer_reason_code: safeField(response?.ReasonCode),
      result_code: safeField(r?.Code), result_reason_code: safeField(r?.ReasonCode),
      status: safeField(r?.Status), charge_type: safeField(r?.ChargeType),
      auth_amount_state: authAmount === '' ? 'missing' : ['0', '0.00'].includes(authAmount) ? 'zero'
        : authAmount === String(order.amountMinor) ? 'matching' : 'other',
      auth_code_present: typeof r?.AuthCode === 'string' && r.AuthCode.length > 0,
      bank_reference_present: typeof r?.RetrefNum === 'string' && r.RetrefNum.length > 0,
    }
    this.lastLiveReconciliationEvidence = queryEvidence
    this.verificationStage = 'orderinq_identity'
    const echoedMode = q.Mode === undefined ? '' : scalar(q.Mode)
    // Garanti's response schema lists Mode but doesn't mark the echo mandatory.
    // Missing/empty is recorded as absent; a contradictory echo is rejected.
    if ((echoedMode !== '' && echoedMode !== c.mode) || scalar(q.Terminal?.ID) !== c.terminalId
      || scalar(q.Terminal?.MerchantID) !== c.merchantId || scalar(q.Order?.OrderID) !== order.merchantReference
      || (q.Terminal?.ProvUserID !== undefined && scalar(q.Terminal.ProvUserID) !== c.queryUser)
      || (q.Terminal?.UserID !== undefined && scalar(q.Terminal.UserID) !== c.queryAgentUserId)) {
      this.lastLiveReconciliationEvidence = { ...queryEvidence, reason: 'GARANTI_ORDERINQ_IDENTITY_MISMATCH' }
      throw new Error('Bank query identity mismatch.')
    }
    // A display-only TEST journey never returns a settlement DTO, even if
    // mappings are later populated or the bank reports a successful capture.
    if (c.observationOnly) throw new GarantiPending(order.id)
    // Query response does not document a currency field. Fixed TRY is bound in
    // the original bank hash and authenticated query; do not invent a response tag.
    // Transaction.Response is the outer order-query response. Sale result
    // codes are nested under Order.OrderInqResult per Garanti's mail example.
    // Explicit outer errors remain fatal, but their optional ReasonCode is not
    // confused with the sale's result ReasonCode.
    this.verificationStage = 'orderinq_status'
    for (const code of [response?.Code, response?.ReasonCode]) {
      if (code !== undefined && scalar(code) !== '' && scalar(code) !== '00') {
        this.lastLiveReconciliationEvidence = { ...queryEvidence, reason: 'GARANTI_ORDERINQ_RESPONSE_ERROR' }
        throw new GarantiPending(order.id)
      }
    }
    const status = scalar(r.Status)
    const captured = status === c.capturedStatus && scalar(r.ChargeType) === c.saleChargeType
    const resultCode = r.Code === undefined ? '' : scalar(r.Code)
    const resultReasonCode = r.ReasonCode === undefined ? '' : scalar(r.ReasonCode)
    const failed = c.mode === 'PROD'
      ? scalar(r.ChargeType) === c.saleChargeType
        && (c.failedResultMappings || []).some(mapping => mapping.status === status && mapping.code === resultCode && mapping.reasonCode === resultReasonCode)
      : c.failedStatuses.includes(status)
    if (!captured && !failed) {
      const hasConfiguredFailureStatus = (c.failedResultMappings || []).some(mapping => mapping.status === status)
      this.lastLiveReconciliationEvidence = { ...queryEvidence, reason: status === '' ? 'GARANTI_ORDERINQ_STATUS_MISSING'
        : hasConfiguredFailureStatus ? 'GARANTI_ORDERINQ_FAILURE_MAPPING_MISMATCH' : 'GARANTI_ORDERINQ_STATUS_UNMAPPED' }
      throw new GarantiPending(order.id)
    }
    this.verificationStage = 'orderinq_result'
    if (captured && (resultCode !== c.capturedResultCode || resultReasonCode !== '00')) {
      this.lastLiveReconciliationEvidence = { ...queryEvidence, reason: 'GARANTI_ORDERINQ_SUCCESS_CODES_MISMATCH' }
      throw new GarantiPending(order.id)
    }
    const authDateShape = authDateFormat(r.AuthDate === undefined ? undefined : scalar(r.AuthDate))
    const authDateValid = ['missing', 'yyyymmdd', 'timestamp'].includes(authDateShape)
    this.verificationStage = 'orderinq_capture'
    if (captured && (scalar(r.AuthAmount) !== String(order.amountMinor) || !authDateValid
      || !scalar(r.AuthCode) || !scalar(r.RetrefNum) || !['', '0'].includes(scalar(r.InstallmentCnt)))) {
      this.lastLiveReconciliationEvidence = { ...queryEvidence, reason: 'GARANTI_ORDERINQ_CAPTURE_MISMATCH' }
      throw new Error('Bank capture mismatch.')
    }
    this.verificationStage = 'orderinq_auth_code'
    if (captured && authCode !== undefined && scalar(r.AuthCode) !== authCode) {
      this.lastLiveReconciliationEvidence = { ...queryEvidence, reason: 'GARANTI_ORDERINQ_AUTH_CODE_MISMATCH' }
      throw new Error('Bank authorization mismatch.')
    }
    if (failed && !['0', '0.00'].includes(authAmount)) {
      this.lastLiveReconciliationEvidence = { ...queryEvidence,
        reason: authAmount === '' ? 'GARANTI_ORDERINQ_FAILURE_AMOUNT_MISSING' : 'GARANTI_ORDERINQ_FAILURE_AMOUNT_CONFLICT' }
      throw new GarantiPending(order.id)
    }
    if (failed && c.mode === 'PROD' && (!resultCode || !resultReasonCode || (resultCode === '00' && resultReasonCode === '00'))) {
      this.lastLiveReconciliationEvidence = { ...queryEvidence, reason: 'GARANTI_ORDERINQ_FAILURE_CODES_UNCONFIRMED' }
      throw new GarantiPending(order.id)
    }
    if (failed && c.mode === 'PROD' && (scalar(response?.Code) !== '00'
      || (response?.ReasonCode !== undefined && scalar(response.ReasonCode) !== '' && scalar(response.ReasonCode) !== '00'))) {
      this.lastLiveReconciliationEvidence = { ...queryEvidence, reason: 'GARANTI_ORDERINQ_RESPONSE_UNCONFIRMED' }
      throw new GarantiPending(order.id)
    }
    // Stable reference across pending/failure/paid avoids synthetic transaction
    // IDs changing between retries. Terminal + bank order uniquely identify it.
    const transactionId = `${c.terminalId}:${order.merchantReference}`
    if (captured && c.mode === 'PROD') {
      this.lastSuccessfulLiveQueryEvidence = { query_http: http, query_order_match: true,
        query_identity_match: true, query_amount_match: true, query_result_codes_match: true,
        query_status: 'APPROVED', query_charge_type: 'S', auth_date_format: authDateShape as 'missing' | 'yyyymmdd' | 'timestamp',
        auth_code_match: true, bank_reference_present: true }
    }
    if (c.mode === 'TEST' && c.singleFinalizeTest) this.lastTestQueryEvidence = testQueryEvidence(c, order, q, http, authCode)
    this.lastLiveReconciliationEvidence = { ...queryEvidence,
      decision: captured ? 'verified_success' : 'verified_failure',
      reason: captured ? 'GARANTI_ORDERINQ_APPROVED_S_00' : 'GARANTI_ORDERINQ_CONFIGURED_FAILURE_STATUS' }
    return { merchantId: c.merchantId, merchantReference: order.merchantReference, transactionId,
      eventId: `${transactionId}:${captured ? 'paid' : 'failed'}`, amountMinor: order.amountMinor,
      currency: 'TRY', status: captured ? 'paid' : 'failed', threeDS: 'failed' }
  }
  async reconcile(reference: string): Promise<VerifiedPayment> {
    const order = await this.loadOrder(reference)
    // Recover IP from the original server-signed handoff when still available.
    const stored = order as PaymentOrder & { redirectUrl?: string | null }
    const token = stored.redirectUrl ? new URL(stored.redirectUrl).searchParams.get('token') : null
    if (!token) throw new GarantiPending(reference)
    const ip = this.handoff(token, true).ip
    const result = await this.query(order, ip)
    // An orderinq response alone does not expose authenticated 3DS evidence.
    // Capture requires the signed bank return; never invent a successful 3DS result.
    if (result.status === 'paid') throw new GarantiPending(reference)
    return result
  }
  callbackResponse() { return new Response('OK', { headers: { 'Cache-Control': 'no-store' } }) }
}
