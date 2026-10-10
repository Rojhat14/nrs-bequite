import 'server-only'
import { createHash } from 'node:crypto'
import type { LegalAcceptance } from './acceptance'
import { validateLegalAcceptance } from './acceptance'
import { LEGAL_DOCUMENT_ARCHIVE } from './documents'
import { assertFinalLegalOrderSummary, type LegalOrderSummary, type OrderLegalRecord } from './order-summary'

export function assertPaymentLegalAcceptance(requestBody: unknown): asserts requestBody is LegalAcceptance {
  const error = validateLegalAcceptance(requestBody)
  if (error) throw new Error(error)
}

// Future payment/create integration must call this before provider/DB operations.
// Pass only a server-verified order snapshot; NEVER trust client prices/user IDs.
// No provider request, client construction, DB write or IP/user-agent collection here.
export function prepareOrderLegalRecord(orderId: string, requestBody: unknown, trustedSummary: LegalOrderSummary): OrderLegalRecord {
  assertPaymentLegalAcceptance(requestBody)
  assertFinalLegalOrderSummary(trustedSummary)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) throw new Error('Geçersiz sipariş kimliği.')
  const contractArchive = LEGAL_DOCUMENT_ARCHIVE[requestBody.contractVersion as keyof typeof LEGAL_DOCUMENT_ARCHIVE]
  const preArchive = LEGAL_DOCUMENT_ARCHIVE[requestBody.preInformationVersion as keyof typeof LEGAL_DOCUMENT_ARCHIVE]
  const documents = { seller: contractArchive.seller,
    contract: contractArchive.documents['mesafeli-satis-sozlesmesi'],
    preInformation: preArchive.documents['on-bilgilendirme-formu'] }
  // Whitelist fields: extra client metadata (including IP/UA) is not persisted.
  const summary: LegalOrderSummary = {
    items: trustedSummary.items.map(item => ({ productId: item.productId, name: item.name,
      description: item.description, ...(item.measurementKind ? { measurementKind: item.measurementKind } : {}), ...(item.image ? { image: item.image } : {}), ...(item.variantId ? { variantId: item.variantId } : {}), ...(item.measurements ? { measurements: item.measurements } : {}), ...(item.size ? { size: item.size } : {}), quantity: item.quantity, unitPrice: item.unitPrice })),
    ...(trustedSummary.orderNote ? { orderNote: trustedSummary.orderNote } : {}),
    buyer: { name: trustedSummary.buyer.name, email: trustedSummary.buyer.email,
      phone: trustedSummary.buyer.phone, address: trustedSummary.buyer.address },
    subtotal: trustedSummary.subtotal, discount: trustedSummary.discount, shipping: trustedSummary.shipping,
    total: trustedSummary.total, currency: trustedSummary.currency, paymentMethod: trustedSummary.paymentMethod,
    deliveryTerms: trustedSummary.deliveryTerms, orderedAt: trustedSummary.orderedAt,
  }
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  return { order_id: orderId, contract_accepted: true, contract_version: requestBody.contractVersion,
    pre_information_version: requestBody.preInformationVersion, accepted_at: new Date().toISOString(),
    document_hash: hash(documents), summary_hash: hash(summary), order_summary: summary }
}
