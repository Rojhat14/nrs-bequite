import { LEGAL_DOCUMENT_VERSIONS } from './documents'

export const LEGAL_ACCEPTANCE_ERROR = "Lütfen Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu'nu kabul edin."
export interface LegalAcceptance { contractAccepted: true; contractVersion: string; preInformationVersion: string }

export function validateLegalAcceptance(value: unknown): string | null {
  if (!value || typeof value !== 'object') return LEGAL_ACCEPTANCE_ERROR
  const acceptance = value as Partial<LegalAcceptance>
  if (acceptance.contractAccepted !== true) return LEGAL_ACCEPTANCE_ERROR
  if (acceptance.contractVersion !== LEGAL_DOCUMENT_VERSIONS.contract
    || acceptance.preInformationVersion !== LEGAL_DOCUMENT_VERSIONS.preInformation) {
    return 'Sözleşme sürümü güncel değil. Lütfen sayfayı yenileyip belgeleri tekrar inceleyin.'
  }
  return null
}

export function createLegalAcceptance(accepted: boolean): LegalAcceptance {
  const acceptance = { contractAccepted: accepted, contractVersion: LEGAL_DOCUMENT_VERSIONS.contract,
    preInformationVersion: LEGAL_DOCUMENT_VERSIONS.preInformation }
  const error = validateLegalAcceptance(acceptance)
  if (error) throw new Error(error)
  return acceptance as LegalAcceptance
}

// Both frontend and the future server payment implementation use this boundary.
// This builder has no network or database side effects and does not enable payments.
export function withLegalAcceptance<T extends object>(payload: T, accepted: boolean): T & LegalAcceptance {
  return { ...payload, ...createLegalAcceptance(accepted) }
}
