import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import type { PaymentProvider, PaymentOrder, VerifiedPayment } from '@/lib/payment/types'
import { UUID } from '@/lib/payment/request'
import { garantiConfig, type GarantiConfig } from './config'
import { loadGarantiOrder } from './order'
import { testQueryEvidence, type TestQueryEvidence } from './query-evidence'
import { bankFields, initiationHash, equalHex, isoBytes, parseReturn, verifyReturnHash, queryXml, parseQuery, scalar } from './protocol'

export class GarantiPending extends Error {
  constructor(readonly reference: string) { super('Payment awaits bank reconciliation.') }
}
export type SuccessfulTestReturnEvidence = {
  order_id: string
  signature_verified: true
  order_match: true; amount_match: true; currency_match: true; terminal_match: true; request_match: true
  query_evidence: TestQueryEvidence
}
export class GarantiProvider implements PaymentProvider {
  get settlementDisabled() { return this.config.observationOnly === true }
  readonly name = 'garanti-oos'
  readonly merchantId: string
  readonly allowedRedirectOrigins: readonly string[]
  private lastTestQueryEvidence: TestQueryEvidence | null = null
  private successfulTestReturnEvidence: SuccessfulTestReturnEvidence | null = null
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
    this.lastTestQueryEvidence = null
    this.successfulTestReturnEvidence = null
    const f = parseReturn(raw, headers, { allowIdenticalDuplicates: c.mode === 'TEST'
      && (c.observationOnly === true || c.singleFinalizeTest === true) })
    // The bank documents hash checking for successful (00) returns only. Failed
    // unsigned returns may not cancel a DB order or release reserved stock.
    verifyReturnHash(c, f)
    const order = await this.loadOrder(f.oid)
    if (!Object.values(this.returnChecks(f, order)).every(Boolean)) throw new Error('Bank return order mismatch.')
    const result = await this.query(order, f.customeripaddress, f.authcode)
    if (result.status === 'paid' && (f.procreturncode !== '00' || f.response.toLowerCase() !== 'approved' || f.mdstatus !== '1')) throw new GarantiPending(order.id)
    if (result.status === 'paid' && c.mode === 'TEST' && c.singleFinalizeTest && this.lastTestQueryEvidence) {
      this.successfulTestReturnEvidence = { order_id: order.id, signature_verified: true,
        order_match: true, amount_match: true, currency_match: true, terminal_match: true, request_match: true,
        query_evidence: this.lastTestQueryEvidence }
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
  private async inquire(order: PaymentOrder, ip: string) {
    if (isIP(ip) !== 4) throw new GarantiPending(order.id)
    const c = this.config
    const endpoint = c.mode === 'TEST' ? 'https://sanalposprovtest.garantibbva.com.tr/VPServlet' : 'https://sanalposprov.garanti.com.tr/VPServlet'
    if (c.queryUrl !== endpoint) throw new Error('Bank query endpoint mismatch.')
    let response: Response
    try {
      response = await this.transport(c.queryUrl, { method: 'POST', redirect: 'error', cache: 'no-store',
        headers: { 'Content-Type': 'text/xml; charset=iso-8859-9' },
        body: new Uint8Array(isoBytes(queryXml(c, order, ip))), signal: AbortSignal.timeout(10000) })
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
  async query(order: PaymentOrder, ip: string, authCode?: string): Promise<VerifiedPayment> {
    const c = this.config
    if (c.observationOnly) {
      await this.observeQuery(order, ip, authCode)
      throw new GarantiPending(order.id)
    }
    const { http, q } = await this.inquire(order, ip)
    const echoedMode = q.Mode === undefined ? '' : scalar(q.Mode)
    const modeMatches = echoedMode === c.mode || (c.mode === 'TEST' && echoedMode === ''
      && c.queryUrl === 'https://sanalposprovtest.garantibbva.com.tr/VPServlet')
    if (!modeMatches || scalar(q.Terminal?.ID) !== c.terminalId
      || scalar(q.Terminal?.MerchantID) !== c.merchantId || scalar(q.Order?.OrderID) !== order.merchantReference) throw new Error('Bank query identity mismatch.')
    // A display-only TEST journey never returns a settlement DTO, even if
    // mappings are later populated or the bank reports a successful capture.
    if (c.observationOnly) throw new GarantiPending(order.id)
    const r = q.Order?.OrderInqResult
    // Query response does not document a currency field. Fixed TRY is bound in
    // the original bank hash and authenticated query; do not invent a response tag.
    // Independent order result fields establish capture. Only TEST may omit
    // these three echoes; missing values never count as success evidence.
    // Contradictory mode echoes and explicit non-00 bank response codes remain
    // fail-closed, and PROD retains the original strict requirements.
    const response = q.Transaction?.Response
    for (const code of [response?.Code, response?.ReasonCode]) {
      if (code !== undefined && scalar(code) !== '' && scalar(code) !== '00') throw new GarantiPending(order.id)
    }
    if (c.mode !== 'TEST' && scalar(response?.ReasonCode) !== '00') throw new GarantiPending(order.id)
    const status = scalar(r.Status)
    const captured = status === c.capturedStatus && scalar(r.ChargeType) === c.saleChargeType
    const failed = c.failedStatuses.includes(status)
    if (!captured && !failed) throw new GarantiPending(order.id)
    const authDate = r.AuthDate === undefined ? '' : scalar(r.AuthDate)
    const authDateValid = c.mode === 'TEST' || (/^\d{8}$/.test(authDate)
      && Number.isFinite(Date.UTC(Number(authDate.slice(0, 4)), Number(authDate.slice(4, 6)) - 1, Number(authDate.slice(6, 8))))
      && new Date(Date.UTC(Number(authDate.slice(0, 4)), Number(authDate.slice(4, 6)) - 1, Number(authDate.slice(6, 8)))).toISOString().slice(0, 10)
        === `${authDate.slice(0, 4)}-${authDate.slice(4, 6)}-${authDate.slice(6, 8)}`)
    if (captured && (scalar(r.Code) !== c.capturedResultCode || scalar(r.AuthAmount) !== String(order.amountMinor) || !authDateValid
      || !scalar(r.AuthCode) || !scalar(r.RetrefNum) || !['', '0'].includes(scalar(r.InstallmentCnt)))) throw new Error('Bank capture mismatch.')
    if (captured && authCode !== undefined && scalar(r.AuthCode) !== authCode) throw new Error('Bank authorization mismatch.')
    if (failed && !['', '0'].includes(scalar(r.AuthAmount))) throw new GarantiPending(order.id)
    // Stable reference across pending/failure/paid avoids synthetic transaction
    // IDs changing between retries. Terminal + bank order uniquely identify it.
    const transactionId = `${c.terminalId}:${order.merchantReference}`
    if (c.mode === 'TEST' && c.singleFinalizeTest) this.lastTestQueryEvidence = testQueryEvidence(c, order, q, http, authCode)
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
