import 'server-only'
import { NextResponse } from 'next/server'
import { paymentAvailable, getPaymentProvider } from '@/lib/payment/provider'
import { boundedText, unavailable } from '@/lib/payment/http'
import { createPaymentRepository } from '@/lib/payment/repository'
import { validateVerifiedPayment } from '@/lib/payment/service'
import { GarantiProvider, GarantiPending } from './adapter'
import { diagnoseTestReturn, saveTestDiagnostic } from './diagnostics'
import { parseReturn } from './protocol'
import { loadGarantiOrder, isGarantiSingleFinalizeOrder } from './order'

export async function garantiReturn(request: Request) {
  if (!paymentAvailable()) return unavailable()
  const provider = getPaymentProvider()
  if (!(provider instanceof GarantiProvider)) return unavailable()
  const destination = (path: string) => NextResponse.redirect(new URL(path, provider.config.siteOrigin), 303)
  if (provider.config.observationOnly) {
    const source = new URL(request.url).pathname.endsWith('/failure') ? 'failure' : 'success'
    let raw: string
    try { raw = await boundedText(request) } catch { return destination('/checkout/failure') }
    // A single TEST order is explicitly claimed in the isolated DB during order
    // creation. Only its signed success callback may use normal verification and
    // the existing idempotent finalize RPC; all other attempts remain observed.
    if (provider.config.singleFinalizeTest && source === 'success') {
      let verifiedReference: string | null = null
      try {
        const fields = parseReturn(raw, request.headers, { allowIdenticalDuplicates: true })
        const order = await loadGarantiOrder(fields.oid)
        if (await isGarantiSingleFinalizeOrder(order)) {
          const settlementProvider = new GarantiProvider({ ...provider.config, observationOnly: false,
            capturedStatus: 'APPROVED', capturedResultCode: '00', saleChargeType: 'S', failedStatuses: [] })
          const verified = await settlementProvider.verifyReturn(raw, request.headers)
          validateVerifiedPayment(verified, settlementProvider)
          verifiedReference = verified.merchantReference
          const evidence = settlementProvider.takeSuccessfulTestReturnEvidence()
          if (evidence) {
            try {
              const diagnostic = await diagnoseTestReturn(provider, raw, request.headers, 'success', evidence)
              if (diagnostic.signature_verified && diagnostic.association === 'verified'
                && diagnostic.query_stage === 'matched') await saveTestDiagnostic(diagnostic)
              else console.warn('garanti_test_verified_return_diagnostic_incomplete')
            } catch { console.warn('garanti_test_verified_return_diagnostic_storage_unavailable') }
          }
          await createPaymentRepository().finalizeAtomic(verified, settlementProvider.name)
          return destination(`/checkout/verify?orderId=${encodeURIComponent(verified.merchantReference)}`)
        }
      } catch {
        // The signed return and independent orderinq were already verified, but
        // the idempotent DB finalize may be temporarily unavailable. Keep the
        // order reference so the result page can show the stored TEST proof.
        if (verifiedReference) return destination(`/checkout/verify?orderId=${encodeURIComponent(verifiedReference)}`)
        // Fall through to value-free observation diagnostics; never finalize a
        // callback that failed signature, association, query or match checks.
      }
    }
    // Diagnostic outcomes never finalize a payment or release reserved stock.
    let reference: string | undefined
    try {
      const diagnostic = await diagnoseTestReturn(provider, raw, request.headers, source)
      await saveTestDiagnostic(diagnostic)
      reference = diagnostic.order_id || undefined
    } catch {
      console.warn('garanti_test_diagnostic_storage_unavailable')
      return destination('/checkout/failure')
    }
    // An unassociated/rejected form is a technical return problem, not merely
    // observation policy. Never imply its missing reference is a missing DB row.
    return destination(reference ? `/checkout/verify?orderId=${encodeURIComponent(reference)}` : '/checkout/failure')
  }
  try {
    // No auth session or same-origin check: the bank submits cross-site POST.
    const verified = await provider.verifyReturn(await boundedText(request), request.headers)
    validateVerifiedPayment(verified, provider)
    await createPaymentRepository().finalizeAtomic(verified, provider.name)
    return destination(`/checkout/verify?orderId=${encodeURIComponent(verified.merchantReference)}`)
  } catch (error) {
    if (error instanceof GarantiPending) return destination(`/checkout/verify?orderId=${encodeURIComponent(error.reference)}`)
    // Neither bad signatures nor unsigned cancellations can change DB state.
    return destination('/checkout/failure')
  }
}
