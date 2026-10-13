import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { GarantiConfig } from './config'
import type { PaymentOrder } from '@/lib/payment/types'

// ISO-8859-9 differs from Latin-1 at six positions. Reject unrepresentable
// characters rather than silently replacing them and producing a different hash.
const turkish: Record<string, number> = { 'Ğ': 0xd0, 'İ': 0xdd, 'Ş': 0xde, 'ğ': 0xf0, 'ı': 0xfd, 'ş': 0xfe }
export function isoBytes(value: string) {
  return Buffer.from(Array.from(value, ch => {
    if (turkish[ch] !== undefined) return turkish[ch]
    const n = ch.codePointAt(0)!
    if (n > 255 || [0xd0, 0xdd, 0xde, 0xf0, 0xfd, 0xfe].includes(n)) throw new Error('Unsupported bank encoding.')
    return n
  }))
}
export const bankHash = (algorithm: 'sha1' | 'sha512', value: string) => createHash(algorithm).update(isoBytes(value)).digest('hex').toUpperCase()
export function equalHex(actual: string, expected: string) {
  return /^[A-Fa-f0-9]{128}$/.test(actual) && timingSafeEqual(Buffer.from(actual.toUpperCase()), Buffer.from(expected))
}
export const escapeMarkup = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export class GarantiReturnParseError extends Error {
  constructor(readonly code: 'content_type' | 'size' | 'charset' | 'percent_encoding' | 'text_encoding' | 'field_name' | 'duplicate_field' | 'field_size') {
    super('Bank return parsing rejected.')
  }
}
export function initiationHash(c: GarantiConfig, order: PaymentOrder) {
  const password = bankHash('sha1', c.provisionPassword + c.terminalId.padStart(9, '0'))
  return bankHash('sha512', c.terminalId + order.merchantReference + order.amountMinor + '949' + c.successUrl + c.errorUrl + 'sales' + c.installment + c.storeKey + password)
}
export function bankFields(c: GarantiConfig, order: PaymentOrder, ip: string) {
  return { mode: c.mode, apiversion: '512', secure3dsecuritylevel: '3D_OOS_PAY',
    terminalprovuserid: c.provisionUser, terminaluserid: c.userId, terminalmerchantid: c.merchantId,
    terminalid: c.terminalId, orderid: order.merchantReference, successurl: c.successUrl, errorurl: c.errorUrl,
    customeremailaddress: order.legal.order_summary.buyer.email, customeripaddress: ip,
    companyname: 'NRS Bequite Luminous', lang: 'tr', txntimestamp: new Date().toISOString(), refreshtime: '0',
    secure3dhash: initiationHash(c, order), txnamount: String(order.amountMinor), txntype: 'sales',
    txncurrencycode: '949', txninstallmentcount: c.installment }
}
export type DuplicateReturnField = { name: string; count: number; values: 'same' | 'different' }
// Only published/known bank field names are retained. Arbitrary public-input
// names can themselves contain secrets, so unknown names are redacted.
const diagnosticNames = new Set(('mdstatus mderrormessage errmsg clientid oid response procreturncode successurl txninstallmentcount refreshtime orderid txntype terminalmerchantid txnamount txntimestamp terminaluserid mode txncurrencycode secure3dhash apiversion companyname errorurl secure3dsecuritylevel customeremailaddress customeripaddress terminalid terminalprovuserid lang authcode cavv eci md rnd hash hashparams hashparamsval cardholdername cardnumber cardexpiredatemonth cardexpiredateyear cardcvv2').split(' '))
export const safeReturnFieldName = (name: string) => diagnosticNames.has(name) ? name : 'unrecognized'
export function parseReturn(raw: string, headers: Headers, options: {
  allowIdenticalDuplicates?: boolean
  onDuplicates?: (summary: DuplicateReturnField[]) => void
  // Diagnostic-only observer: receives parsed scalars transiently before the
  // strict duplicate rejection below; callers must never persist these values.
  onFields?: (fields: Readonly<Record<string, string>>) => void
} = {}) {
  if (!headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) throw new GarantiReturnParseError('content_type')
  if (raw.length > 65536) throw new GarantiReturnParseError('size')
  // Decode percent bytes with the advertised bank charset; URLSearchParams alone
  // replaces ISO-8859-9 Turkish bytes and invalidates signatures.
  const charset = /charset\s*=\s*["']?([^;"' ]+)/i.exec(headers.get('content-type') || '')?.[1]?.toLowerCase()
  if (charset && !['utf-8', 'iso-8859-9', 'windows-1254'].includes(charset)) throw new GarantiReturnParseError('charset')
  const decode = (s: string) => {
    if (/%(?![0-9a-f]{2})/i.test(s)) throw new GarantiReturnParseError('percent_encoding')
    const bytes: number[] = []
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '%') { bytes.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2 }
      else if (s[i] === '+') bytes.push(32)
      else bytes.push(...Array.from(Buffer.from(s[i])))
    }
    try {
      return new TextDecoder(charset === 'iso-8859-9' || charset === 'windows-1254' ? 'windows-1254' : 'utf-8', { fatal: true }).decode(Uint8Array.from(bytes))
    } catch { throw new GarantiReturnParseError('text_encoding') }
  }
  const fields: Record<string, string> = Object.create(null)
  const repeats = new Map<string, { count: number; same: boolean }>()
  for (const part of raw.split('&')) {
    const at = part.indexOf('='); const name = decode(at < 0 ? part : part.slice(0, at)), value = decode(at < 0 ? '' : part.slice(at + 1))
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(name)) throw new GarantiReturnParseError('field_name')
    if (value.length > 8192) throw new GarantiReturnParseError('field_size')
    if (Object.hasOwn(fields, name)) {
      const repeat = repeats.get(name) || { count: 1, same: true }
      repeat.count++; repeat.same = repeat.same && fields[name] === value
      repeats.set(name, repeat)
      continue
    }
    fields[name] = value
  }
  const summary: DuplicateReturnField[] = Array.from(repeats, ([name, r]): DuplicateReturnField => ({
    name: safeReturnFieldName(name), count: r.count, values: r.same ? 'same' : 'different',
  })).slice(0, 64)
  options.onFields?.(fields)
  options.onDuplicates?.(summary)
  // No first/last selection: accepting repetitions requires equality of EVERY
  // decoded value. Hash verification and order checks use the same scalar map.
  // Default/Production remain strict; only TEST observation opts in.
  if (repeats.size && (!options.allowIdenticalDuplicates || Array.from(repeats.values()).some(r => !r.same))) throw new GarantiReturnParseError('duplicate_field')
  return fields
}
export type ReturnSignatureEvidence = {
  result: 'verified' | 'hashparams_invalid' | 'hash_format_invalid' | 'encoding_rejected' | 'hash_mismatch'
  algorithm: 'sha1'; encoding: 'iso-8859-9'; store_key_transform: 'none'
  hash_format: 'base64-28' | 'missing' | 'other'
  form_charset: 'unspecified' | 'utf-8' | 'iso-8859-9' | 'windows-1254' | 'unsupported'
  hashparams_order: string[]; documented_order: boolean
  missing_fields: string[]; empty_fields: string[]
  hashparamsval_matches_rebuilt: boolean | null
  hash_shape: ReturnType<typeof inspectHashRepresentation>
}
export class ReturnSignatureError extends Error {
  constructor(readonly result: ReturnSignatureEvidence['result']) { super('Bank return signature could not be verified.') }
}
export function inspectHashRepresentation(value = '') {
  const strictHex = value.length > 0 && value.length % 2 === 0 && /^[A-Fa-f0-9]+$/.test(value)
  // RFC 4648 standard alphabet, required padding and canonical unused bits.
  // Buffer.from(...,'base64') alone is permissive and must not classify input.
  const base64Syntax = value.length > 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  const decoded = base64Syntax ? Buffer.from(value, 'base64') : null
  const strictBase64 = decoded !== null && decoded.toString('base64') === value
  return { character_length: value.length, strict_hex: strictHex, strict_base64: strictBase64,
    hex_decoded_bytes: strictHex ? value.length / 2 : null,
    base64_decoded_bytes: strictBase64 ? decoded!.length : null,
    whitespace_present: /\s/.test(value) }
}
export function inspectReturnSignature(c: GarantiConfig, f: Record<string, string>, headers?: Headers): ReturnSignatureEvidence {
  const names = (f.hashparams || '').split(':').filter(Boolean)
  const required = ['clientid', 'oid', 'authcode', 'procreturncode', 'response', 'mdstatus', 'cavv', 'eci', 'md', 'rnd']
  const charset = /charset\s*=\s*["']?([^;"' ]+)/i.exec(headers?.get('content-type') || '')?.[1]?.toLowerCase()
  const formCharset = !charset ? 'unspecified' : charset === 'utf-8' || charset === 'iso-8859-9' || charset === 'windows-1254' ? charset : 'unsupported'
  const d: ReturnSignatureEvidence = { result: 'hashparams_invalid', algorithm: 'sha1', encoding: 'iso-8859-9', store_key_transform: 'none',
    form_charset: formCharset, hash_format: !f.hash ? 'missing' : inspectHashRepresentation(f.hash).strict_base64 && inspectHashRepresentation(f.hash).base64_decoded_bytes === 20 ? 'base64-28' : 'other',
    hashparams_order: names.slice(0, 64).map(safeReturnFieldName), documented_order: names.join(':') === required.join(':'),
    missing_fields: names.filter(n => !Object.hasOwn(f, n)).slice(0, 64).map(safeReturnFieldName),
    empty_fields: names.filter(n => f[n] === '').slice(0, 64).map(safeReturnFieldName), hashparamsval_matches_rebuilt: null,
    hash_shape: inspectHashRepresentation(f.hash) }
  if (names.length < required.length || new Set(names).size !== names.length || !required.every(n => names.includes(n))
    || !names.every(n => /^[a-zA-Z0-9_]{1,64}$/.test(n) && (f[n] === undefined || typeof f[n] === 'string'))) return d
  // Official return example: Request.Form.Get(param)==null contributes "".
  // Keep missing and present-empty equivalent for the HASH only. Identity,
  // amount, request binding, 3DS and authorization checks remain separate.
  const rebuilt = names.map(n => f[n] ?? '').join('')
  if (Object.hasOwn(f, 'hashparamsval')) d.hashparamsval_matches_rebuilt = f.hashparamsval === rebuilt
  if (d.hash_format !== 'base64-28') { d.result = 'hash_format_invalid'; return d }
  let expected: Buffer
  let actual: Buffer
  try {
    expected = createHash('sha1').update(isoBytes(rebuilt + c.storeKey)).digest()
    actual = Buffer.from(f.hash, 'base64')
  }
  catch { d.result = 'encoding_rejected'; return d }
  d.result = actual.length === expected.length && actual.toString('base64') === f.hash && timingSafeEqual(actual, expected) ? 'verified' : 'hash_mismatch'
  return d
}
export function verifyReturnHash(c: GarantiConfig, f: Record<string, string>) {
  const result = inspectReturnSignature(c, f).result
  if (result !== 'verified') throw new ReturnSignatureError(result)
  // Never verify from hashparamsval or the initiation secure3dhash.
}
export function queryXml(c: GarantiConfig, order: PaymentOrder, ip: string) {
  const password = bankHash('sha1', c.queryPassword + c.terminalId.padStart(9, '0'))
  const hash = bankHash('sha512', order.merchantReference + c.terminalId + order.amountMinor + '949' + password)
  const e = escapeMarkup
  return `<?xml version="1.0" encoding="iso-8859-9"?><GVPSRequest><Mode>${c.mode}</Mode><Version>512</Version><Terminal><ProvUserID>${e(c.queryUser)}</ProvUserID><HashData>${hash}</HashData><UserID>${e(c.queryAgentUserId || c.userId)}</UserID><ID>${c.terminalId}</ID><MerchantID>${c.merchantId}</MerchantID></Terminal><Customer><IPAddress>${e(ip)}</IPAddress><EmailAddress>${e(order.legal.order_summary.buyer.email)}</EmailAddress></Customer><Order><OrderID>${order.merchantReference}</OrderID><GroupID/></Order><Transaction><Type>orderinq</Type><ListPageNum>0</ListPageNum><Amount>${order.amountMinor}</Amount><CurrencyCode>949</CurrencyCode><CardholderPresentCode>13</CardholderPresentCode><MotoInd>N</MotoInd></Transaction></GVPSRequest>`
}
export function parseQuery(xml: string) {
  if (xml.length > 65536 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid bank XML.')
  const parsed = new XMLParser({ parseTagValue: false, trimValues: false, ignoreAttributes: false }).parse(xml)
  if (!parsed.GVPSResponse || Array.isArray(parsed.GVPSResponse)) throw new Error('Invalid bank response.')
  return parsed.GVPSResponse
}
export function scalar(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Ambiguous bank value.')
  return value
}
