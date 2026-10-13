import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { garantiLiveObservationOnly, garantiObservationOnly } from './config'
import { GarantiProvider, type SuccessfulTestReturnEvidence } from './adapter'
import { parseReturn, inspectReturnSignature, inspectHashRepresentation, safeReturnFieldName, GarantiReturnParseError, type DuplicateReturnField, type ReturnSignatureEvidence } from './protocol'
import { loadGarantiOrder } from './order'
import { paymentDatabase } from '@/lib/payment/repository'
import type { TestQueryEvidence } from './query-evidence'
import { UUID } from '@/lib/payment/request'

// Do not retain arbitrary text from an unsigned/public input. Known explanations
// are mapped to fixed phrases; all other text (including echoed PII) is withheld.
const explanations: Record<string, string> = {
  'authentication failed': '3D doğrulaması başarısız.',
  '3d authentication failed': '3D doğrulaması başarısız.',
  'card expired': 'Kartın son kullanma tarihi hatası.',
  'expired card': 'Kartın son kullanma tarihi hatası.',
  'invalid card number': 'Kart bilgisi hatası.',
  'işleminizi gerçekleştiremiyoruz': 'Banka işlemi gerçekleştiremedi.',
  'işleminizi gerçekleştiremiyoruz. tekrar deneyiniz': 'Banka işlemi gerçekleştiremedi.',
  'user canceled': 'Kullanıcı iptali bildirildi.',
  'cancelled': 'İptal bildirildi.',
}
export function cleanBankExplanation(value?: string) {
  if (!value) return ''
  const normalized = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR')
  return (explanations[normalized] || 'Açıklama gizlilik nedeniyle saklanmadı.').slice(0, 160)
}

// Production callback diagnostics are log-only and available solely in the
// explicitly controlled, one-account observation deployment. They never query
// the bank, read an order, persist a body, or alter signature acceptance.
export function diagnoseLiveReturn(provider: GarantiProvider, raw: string, headers: Headers, rejectionCode: string | null) {
  if (!provider.config.liveObservationOnly || !garantiLiveObservationOnly()) throw new Error('Live diagnostics are not enabled.')
  let parsed: Readonly<Record<string, string>> | null = null
  let duplicates: DuplicateReturnField[] = []
  let parseStage = 'parsed'
  try {
    parseReturn(raw, headers, { allowIdenticalDuplicates: true,
      onDuplicates: summary => { duplicates = summary }, onFields: fields => { parsed = fields } })
  } catch (error) {
    parseStage = error instanceof GarantiReturnParseError ? error.code : 'parse_rejected'
  }

  const field = (name: string) => parsed?.[name]
  const different = duplicates.filter(item => item.values === 'different')
  const ambiguous = different.length > 0
  const ambiguousNames = new Set(different.map(item => item.name))
  const rawHashparams = (field('hashparams') || '').split(':').filter(Boolean)
  const signatureNames = new Set(rawHashparams.map(safeReturnFieldName))
  const hashAmbiguous = ambiguousNames.has('hash') || ambiguousNames.has('unrecognized')
  const paramsAmbiguous = ambiguousNames.has('hashparams') || ambiguousNames.has('unrecognized')
  const fieldsAmbiguous = paramsAmbiguous || Array.from(signatureNames).some(name => ambiguousNames.has(name))
  // Never calculate a digest from first/last values when any repeated value
  // conflicts. Shape/order metadata remains safe if those fields are unique.
  const signature = parsed && !ambiguous ? inspectReturnSignature(provider.config, parsed as Record<string, string>, headers) : null
  const hashShape = parsed && !hashAmbiguous ? inspectHashRepresentation(field('hash')) : null
  const hashFormat = !parsed ? null : hashAmbiguous ? 'ambiguous_duplicate'
    : !field('hash') ? 'missing' : hashShape?.strict_base64 && hashShape.base64_decoded_bytes === 20 ? 'base64-28' : 'other'
  const diagnostic = {
    rejection_code: rejectionCode,
    validation_stage: rejectionCode?.endsWith('_FIELD_DUPLICATE_FIELD') ? 'duplicate_field' : parseStage,
    signature_verified: !!signature && !duplicates.length && signature.result === 'verified',
    signature_result: ambiguous ? 'not_evaluated_ambiguous_duplicate' : signature?.result || 'not_evaluated',
    algorithm: signature?.algorithm || 'sha1',
    encoding: signature?.encoding || 'iso-8859-9',
    form_charset: signature?.form_charset || null,
    store_key_transform: 'none',
    hash_format: hashFormat,
    hash_character_length: hashShape?.character_length ?? null,
    hash_strict_hex: hashShape?.strict_hex ?? null,
    hash_strict_base64: hashShape?.strict_base64 ?? null,
    hash_decoded_bytes: hashShape ? (hashShape.strict_base64 ? hashShape.base64_decoded_bytes : hashShape.strict_hex ? hashShape.hex_decoded_bytes : null) : null,
    hashparams_order: parsed && !paramsAmbiguous ? rawHashparams.slice(0, 64).map(safeReturnFieldName) : null,
    documented_hashparams_order: parsed && !paramsAmbiguous ? rawHashparams.join(':') === 'clientid:oid:authcode:procreturncode:response:mdstatus:cavv:eci:md:rnd' : null,
    missing_fields: parsed && !fieldsAmbiguous ? rawHashparams.filter(name => !Object.hasOwn(parsed!, name)).slice(0, 64).map(safeReturnFieldName) : null,
    empty_fields: parsed && !fieldsAmbiguous ? rawHashparams.filter(name => parsed![name] === '').slice(0, 64).map(safeReturnFieldName) : null,
    duplicate_fields: duplicates,
    observation_only: true,
    finalize_called: false,
  }
  return diagnostic
}
export type TestDiagnostic = {
  order_id: string | null; payment_attempt_id: string | null; source: 'success' | 'failure'
  mdstatus: string | null; response: string | null; procreturncode: string | null
  mderrormessage: string; errmsg: string; error_text_signed: boolean
  signature_verified: boolean; association: 'verified' | 'claimed' | 'unassociated'
  order_match: boolean | null; amount_match: boolean | null; currency_match: boolean | null
  terminal_match: boolean | null; request_match: boolean | null
  validation_stage: string
  duplicate_fields: DuplicateReturnField[]
  return_signature_evidence: ReturnSignatureEvidence | null
  query_stage: 'not_queried' | 'matched' | 'mismatch' | 'unavailable'
  query_evidence: TestQueryEvidence | null
  outcome: 'verified_failure' | 'unverified_failure' | 'unverified' | 'verification_pending'
}
export async function diagnoseTestReturn(provider: GarantiProvider, raw: string, headers: Headers, source: 'success' | 'failure', verifiedEvidence?: SuccessfulTestReturnEvidence): Promise<TestDiagnostic> {
  if (!provider.config.observationOnly || !garantiObservationOnly()) throw new Error('TEST diagnostics only.')
  const d: TestDiagnostic = { order_id: null, payment_attempt_id: null, source,
    mdstatus: null, response: null, procreturncode: null, mderrormessage: '', errmsg: '', error_text_signed: false,
    signature_verified: false, association: 'unassociated', order_match: null, amount_match: null,
    currency_match: null, terminal_match: null, request_match: null,
    validation_stage: 'received', duplicate_fields: [], return_signature_evidence: null, query_stage: 'not_queried', query_evidence: null,
    outcome: source === 'failure' ? 'unverified_failure' : 'unverified' }
  // Fixed stage names and a safe projection only: never field names, raw errors,
  // hash inputs, card data, customer data or order identifiers in runtime logs.
  const trace = (stage: string) => { d.validation_stage = stage; console.info(JSON.stringify({ event: 'garanti_test_return_validation', source, stage,
    mdstatus: d.mdstatus, response: d.response, procreturncode: d.procreturncode,
    signature_verified: d.signature_verified, order_match: d.order_match,
    amount_match: d.amount_match, currency_match: d.currency_match,
    terminal_match: d.terminal_match, request_match: d.request_match })) }
  let f: Record<string, string>
  try { f = parseReturn(raw, headers, { allowIdenticalDuplicates: true, onDuplicates: summary => { d.duplicate_fields = summary } }) } catch (error) {
    trace(error instanceof GarantiReturnParseError ? error.code : 'parse_rejected'); return d
  }
  d.mdstatus = /^[0-9]$/.test(f.mdstatus || '') ? f.mdstatus : null
  d.response = ['approved', 'declined', 'error', 'failed'].includes((f.response || '').toLowerCase()) ? f.response.toLowerCase() : null
  d.procreturncode = /^\d{2}$/.test(f.procreturncode || '') ? f.procreturncode : null
  d.mderrormessage = cleanBankExplanation(f.mderrormessage); d.errmsg = cleanBankExplanation(f.errmsg)
  d.return_signature_evidence = inspectReturnSignature(provider.config, f, headers)
  d.signature_verified = d.return_signature_evidence.result === 'verified'
  const signedFields = (f.hashparams || '').split(':')
  d.error_text_signed = d.signature_verified && signedFields.includes('errmsg') && signedFields.includes('mderrormessage')
  if (!UUID.test(f.oid || '')) { trace('order_reference_invalid'); return d }
  try {
    const stored = await loadGarantiOrder(f.oid)
    const { data: payment, error } = await paymentDatabase().from('payment_orders').select('idempotency_key').eq('order_id', stored.id).single()
    if (error || !payment || !UUID.test(payment.idempotency_key)) { trace('payment_lookup_failed'); return d }
    d.order_id = stored.id; d.payment_attempt_id = payment.idempotency_key; d.association = 'claimed'
    Object.assign(d, provider.returnChecks(f, stored))
    if (d.signature_verified && d.order_match && d.amount_match && d.currency_match && d.terminal_match && d.request_match) {
      d.association = 'verified'
      const failure = d.procreturncode !== null && d.procreturncode !== '00'
        && ['declined', 'error', 'failed'].includes(d.response || '')
      const approved = d.mdstatus === '1' && d.response === 'approved' && d.procreturncode === '00'
      // Partial/contradictory 3DS evidence is not a confirmed failed capture.
      d.outcome = failure ? 'verified_failure' : approved ? 'verification_pending'
        : source === 'failure' ? 'unverified_failure' : 'unverified'
    }
    if (d.association === 'verified' && verifiedEvidence?.order_id === stored.id
      && verifiedEvidence.signature_verified && verifiedEvidence.order_match && verifiedEvidence.amount_match
      && verifiedEvidence.currency_match && verifiedEvidence.terminal_match && verifiedEvidence.request_match) {
      d.query_evidence = verifiedEvidence.query_evidence
      const q = d.query_evidence
      d.query_stage = q.identity_match && q.amount_match && q.auth_match === true
        && q.status === 'APPROVED' && q.charge_type === 'S' && q.result_code === '00'
        && q.auth_code_present && q.bank_reference_present ? 'matched' : 'mismatch'
    } else if (d.association === 'verified') {
      try {
        d.query_evidence = await provider.observeQuery(stored, f.customeripaddress, f.authcode)
        const q = d.query_evidence
        d.query_stage = q.identity_match && q.amount_match && q.auth_match === true
          && q.auth_code_present && q.bank_reference_present ? 'matched' : 'mismatch'
      } catch { d.query_stage = 'unavailable' }
    }
    trace(d.association === 'verified' ? 'return_verified' : !d.signature_verified ? 'signature_rejected' : 'return_mismatch')
  } catch { trace('order_lookup_failed') }
  return d
}
export async function saveTestDiagnostic(d: TestDiagnostic) {
  if (!garantiObservationOnly()) throw new Error('TEST diagnostics only.')
  // Associated duplicates may dedupe by safe evidence. An unassociated return
  // needs its own receipt timestamp: otherwise a real parse failure can collapse
  // into an earlier empty probe and disappear from the attempt's time window.
  // The random receipt is independent of all POST/card/customer data.
  const fingerprint = createHash('sha256').update(JSON.stringify(d) + (d.order_id ? '' : randomUUID())).digest('hex')
  const { error } = await paymentDatabase().from('garanti_test_return_diagnostics').upsert({ ...d, fingerprint }, { onConflict: 'fingerprint', ignoreDuplicates: true })
  if (error) throw new Error('Diagnostic storage unavailable.')
}
export async function readTestDiagnostic(authorizedOrderId: string) {
  if (!garantiObservationOnly() || !UUID.test(authorizedOrderId)) return null
  const { data, error } = await paymentDatabase().from('garanti_test_return_diagnostics')
    .select('outcome,association,signature_verified,mdstatus,response,procreturncode,mderrormessage,errmsg,error_text_signed,order_match,amount_match,currency_match,terminal_match,request_match,validation_stage,query_stage,query_evidence')
    .eq('order_id', authorizedOrderId).order('association', { ascending: false }).order('signature_verified', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return error ? null : data as TestDiagnostic | null
}
