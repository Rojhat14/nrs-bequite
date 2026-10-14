import 'server-only'
import { NextResponse } from 'next/server'
import { paymentAvailable, getPaymentProvider } from '@/lib/payment/provider'
import { boundedText, unavailable } from '@/lib/payment/http'
import { createPaymentRepository, finalizeGarantiLiveSinglePayment, saveGarantiLiveSingleFinalizeEvidence, saveGarantiLiveSingleFinalizeFailure,
  readGarantiSettlementEvidence, saveGarantiOrderinqReconciliation, saveGarantiPaymentReturnDiagnostic } from '@/lib/payment/repository'
import { validateVerifiedPayment } from '@/lib/payment/service'
import { GarantiProvider, GarantiPending } from './adapter'
import { diagnoseLiveReturn, diagnoseTestReturn, saveTestDiagnostic } from './diagnostics'
import { GarantiReturnParseError, parseReturn, ReturnSignatureError } from './protocol'
import { UUID } from '@/lib/payment/request'
import { loadGarantiOrder, isGarantiLiveSingleFinalizeOrder, isGarantiSingleFinalizeOrder } from './order'
import { controlledLiveAccountAllowed } from './config'

export async function garantiReturn(request: Request) {
  if (!paymentAvailable()) return unavailable()
  const provider = getPaymentProvider()
  if (!(provider instanceof GarantiProvider)) return unavailable()
  const destination = (path: string) => NextResponse.redirect(new URL(path, provider.config.siteOrigin), 303)
  const source = new URL(request.url).pathname.endsWith('/failure') ? 'failure' : 'success'
  const liveFailureCode = (error: unknown) => {
    const prefix = source === 'failure' ? 'GARANTI_FAILURE_RETURN' : 'GARANTI_SUCCESS_RETURN'
    if (error instanceof GarantiPending) return 'GARANTI_ORDERINQ_PENDING'
    if (error instanceof ReturnSignatureError) return `${prefix}_SIGNATURE_${error.result.toUpperCase()}`
    if (error instanceof GarantiReturnParseError) return `${prefix}_FIELD_${error.code.toUpperCase()}`
    if (error instanceof Error && error.message === 'Bank return order mismatch.') return `${prefix}_ASSOCIATION_MISMATCH`
    if (error instanceof Error && error.message === 'Bank query identity mismatch.') return `${prefix}_ORDERINQ_IDENTITY_MISMATCH`
    if (error instanceof Error && error.message === 'Bank capture mismatch.') return `${prefix}_ORDERINQ_CAPTURE_MISMATCH`
    if (error instanceof Error && error.message === 'Bank authorization mismatch.') return `${prefix}_ORDERINQ_AUTHORIZATION_MISMATCH`
    if (error instanceof Error && error.message === 'Bank query endpoint mismatch.') return `${prefix}_ORDERINQ_ENDPOINT_MISMATCH`
    if (error instanceof Error && error.message === 'Payment verification failed.') return `${prefix}_PAYMENT_DTO_INVALID`
    if (error instanceof Error && error.message === 'Verified live evidence missing.') return `${prefix}_VERIFIED_EVIDENCE_MISSING`
    if (error instanceof Error && error.message === 'Verified payment evidence could not be stored.') return `${prefix}_EVIDENCE_STORE_FAILED`
    if (error instanceof Error && error.message === 'Controlled payment result could not be committed.') return `${prefix}_FINALIZE_RPC_FAILED`
    return 'GARANTI_RETURN_VERIFICATION_FAILED'
  }
  if (provider.config.observationOnly) {
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
          await createPaymentRepository().finalizeAtomic(verified, settlementProvider.name, true)
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
  let raw = ''
  // Production normally remains observation-only. Exactly one new 3 TL order
  // can enter the automatic path, and only after its claim was atomically
  // attached by the order-creation RPC for the controlled account.
  if (provider.config.liveObservationOnly && source === 'success') {
    try { raw = await boundedText(request) } catch { return destination('/checkout/failure') }
    let orderId: string | null = null
    let failureStage: 'callback_parse' | 'order_lookup' | 'permission_lookup' | 'callback_signature' | 'callback_match'
      | 'orderinq_request' | 'orderinq_response' | 'orderinq_identity' | 'orderinq_status' | 'orderinq_result'
      | 'orderinq_capture' | 'orderinq_auth_code' | 'verified_payment' | 'verified_evidence' | 'evidence_store' | 'finalize_rpc' = 'callback_parse'
    let settlementProvider: GarantiProvider | null = null
    const persistFailure = async (target: string, stage: typeof failureStage, code: string, diagnostic: Record<string, unknown> = {}) => {
      try { await saveGarantiLiveSingleFinalizeFailure(target, source, stage, code, diagnostic) }
      catch { console.warn(JSON.stringify({ event: 'garanti_live_single_finalize_diagnostic_unavailable', order_id: target, stage, code: 'GARANTI_DIAGNOSTIC_STORE_FAILED' })) }
    }
    try {
      const fields = parseReturn(raw, request.headers, { allowIdenticalDuplicates: true })
      failureStage = 'order_lookup'
      const order = await loadGarantiOrder(fields.oid)
      orderId = order.id
      failureStage = 'permission_lookup'
      if (order.appStatus === 'payment_unverified' && order.state === 'pending') {
        settlementProvider = new GarantiProvider({ ...provider.config, liveObservationOnly: false, liveDiagnostics: true,
          capturedStatus: 'APPROVED', capturedResultCode: '00', saleChargeType: 'S', failedStatuses: [] })
        failureStage = 'callback_signature'
        const verified = await settlementProvider.verifyReturn(raw, request.headers)
        failureStage = 'verified_payment'
        validateVerifiedPayment(verified, settlementProvider)
        failureStage = 'verified_evidence'
        const evidence = settlementProvider.takeSuccessfulLiveReturnEvidence()
        if (!evidence || evidence.order_id !== order.id) throw new Error('Verified live evidence missing.')
        // The DB function writes a one-time admin review row for a late signed
        // approval; it leaves the closed app order, pending bank state and the
        // already-released reservation untouched.
        failureStage = 'finalize_rpc'
        await createPaymentRepository().finalizeAtomic(verified, settlementProvider.name, true)
        return destination(`/checkout/verify?orderId=${encodeURIComponent(order.id)}`)
      }
      if (await isGarantiLiveSingleFinalizeOrder(order)) {
        settlementProvider = new GarantiProvider({ ...provider.config, liveObservationOnly: false, liveDiagnostics: true,
          capturedStatus: 'APPROVED', capturedResultCode: '00', saleChargeType: 'S', failedStatuses: [] })
        failureStage = 'callback_signature'
        const verified = await settlementProvider.verifyReturn(raw, request.headers)
        failureStage = 'verified_payment'
        validateVerifiedPayment(verified, settlementProvider)
        failureStage = 'verified_evidence'
        const evidence = settlementProvider.takeSuccessfulLiveReturnEvidence()
        if (!evidence || evidence.order_id !== order.id) throw new Error('Verified live evidence missing.')
        failureStage = 'evidence_store'
        await saveGarantiLiveSingleFinalizeEvidence(order.id, evidence)
        failureStage = 'finalize_rpc'
        await finalizeGarantiLiveSinglePayment(verified)
        return destination(`/checkout/verify?orderId=${encodeURIComponent(order.id)}`)
      } else {
        // A duplicate callback for an already-finalized order is an ordinary
        // idempotent retry, not a failed permission lookup.
        if (order.state === 'pending') {
          const code = 'GARANTI_SINGLE_FINALIZE_PERMISSION_NOT_ACTIVE'
          await persistFailure(order.id, 'permission_lookup', code)
          console.warn(JSON.stringify({ event: 'garanti_live_single_finalize_rejected', order_id: order.id,
            stage: 'permission_lookup', code }))
        }
      }
    } catch (error) {
      const code = liveFailureCode(error)
      const stage = settlementProvider && failureStage === 'callback_signature'
        ? settlementProvider.lastVerificationStage : failureStage
      const returnVerification = settlementProvider?.takeLiveReturnVerification() || {}
      if (orderId) await persistFailure(orderId, stage, code, returnVerification)
      console.warn(JSON.stringify({ event: 'garanti_live_single_finalize_rejected', order_id: orderId, stage, code }))
      if (error instanceof GarantiPending && UUID.test(error.reference)) {
        return destination(`/checkout/verify?orderId=${encodeURIComponent(error.reference)}`)
      }
      if (orderId && error instanceof Error && error.message === 'Controlled payment result could not be committed.') {
        return destination(`/checkout/verify?orderId=${encodeURIComponent(orderId)}`)
      }
      if (orderId && error instanceof Error && error.message === 'Verified payment evidence could not be stored.') {
        return destination(`/checkout/failure?code=${encodeURIComponent(code)}`)
      }
      // An unclaimed order follows the normal live observation path below.
      if (!orderId) return destination(`/checkout/failure?code=${encodeURIComponent(code)}`)
      // The order is known but has no single-order claim. Preserve the regular
      // observation behavior; it cannot finalize or release its reservation.
      if (error instanceof Error && error.message === 'Payment order unavailable.') return destination('/checkout/failure')
    }
  }
  try {
    // No auth session or same-origin check: the bank submits cross-site POST.
    if (!raw) raw = await boundedText(request)
    const verified = await provider.verifyReturn(raw, request.headers)
    validateVerifiedPayment(verified, provider)
    await createPaymentRepository().finalizeAtomic(verified, provider.name, true)
    return destination(`/checkout/verify?orderId=${encodeURIComponent(verified.merchantReference)}`)
  } catch (error) {
    if (provider.config.liveObservationOnly) {
      const code = liveFailureCode(error)
      let diagnostic: ReturnType<typeof diagnoseLiveReturn> | null = null
      try {
        diagnostic = diagnoseLiveReturn(provider, raw, request.headers, code, source)
        console.info(JSON.stringify({ event: 'garanti_live_return_diagnostic', source, ...diagnostic }))
      } catch {
        console.warn(JSON.stringify({ event: 'garanti_live_return_diagnostic_unavailable', source, code }))
      }
      // Keep a safe, order-bound trace for a failure callback, then use an
      // independent authenticated bank query to decide whether it is final.
      // The callback itself never releases stock or overrides a pending query.
      let failureOrderId: string | null = null
      if (source === 'failure') {
        try {
          const fields = parseReturn(raw, request.headers, { allowIdenticalDuplicates: true })
          if (UUID.test(fields.oid)) failureOrderId = fields.oid
        } catch { /* Unparseable inputs cannot be attached to a payment order. */ }
      }
      if (failureOrderId && diagnostic) {
        let ownedOrder: Awaited<ReturnType<typeof loadGarantiOrder>> | null = null
        try {
          const candidate = await loadGarantiOrder(failureOrderId)
          if (controlledLiveAccountAllowed(candidate.userId)) ownedOrder = candidate
        } catch { /* Unassociated or unavailable order: do not write a diagnostic row. */ }
        if (ownedOrder) {
          const captured = provider.takeLiveReturnVerification() || {}
          const signatureResult = ['verified','hashparams_invalid','hash_format_invalid','encoding_rejected','hash_mismatch','field_duplicate_field','not_evaluated','parse_rejected']
            .includes(String(diagnostic.signature_result)) ? diagnostic.signature_result : 'not_evaluated'
          const verification = {
            signature_verified: captured.signature_verified === true || diagnostic.signature_verified === true,
            signature_result: signatureResult,
            order_match: typeof captured.order_match === 'boolean' ? captured.order_match : null,
            amount_match: typeof captured.amount_match === 'boolean' ? captured.amount_match : null,
            currency_match: typeof captured.currency_match === 'boolean' ? captured.currency_match : null,
            terminal_match: typeof captured.terminal_match === 'boolean' ? captured.terminal_match : null,
            request_match: typeof captured.request_match === 'boolean' ? captured.request_match : null,
            mdstatus: typeof captured.callback_mdstatus === 'string' ? captured.callback_mdstatus : diagnostic.reported_mdstatus,
            response: typeof captured.callback_response === 'string' ? captured.callback_response : diagnostic.reported_response,
            procreturncode: typeof captured.callback_procreturncode === 'string' ? captured.callback_procreturncode : diagnostic.reported_procreturncode,
            mderrormessage_present: diagnostic.mderrormessage_present,
            errmsg_present: diagnostic.errmsg_present,
            error_text_signed: diagnostic.error_text_signed,
            error_category: diagnostic.error_category,
            verification_basis: 'callback_runtime',
          }
          try {
            const stage = provider.lastVerificationStage || 'callback_signature'
            await saveGarantiPaymentReturnDiagnostic(ownedOrder.id, 'failure', stage, code, verification)
          } catch {
            console.warn(JSON.stringify({ event: 'garanti_live_return_diagnostic_unavailable',
              order_id: ownedOrder.id, stage: provider.lastVerificationStage, code: 'GARANTI_DIAGNOSTIC_STORE_FAILED' }))
            return destination(`/checkout/failure?code=GARANTI_FAILURE_DIAGNOSTIC_STORE_FAILED`)
          }
          if (ownedOrder.state === 'pending') {
            try {
              const proof = await readGarantiSettlementEvidence(ownedOrder.id)
              const reconciled = await provider.reconcileOwnedPendingOrder(ownedOrder.id, ownedOrder.userId, proof)
              const evidence = provider.takeLiveReconciliationEvidence()
              if (reconciled.status === 'failed' && evidence?.decision === 'verified_failure') {
                await saveGarantiOrderinqReconciliation(ownedOrder.id, 'verified_failure', evidence.reason, evidence)
                await createPaymentRepository().finalizeAtomic(reconciled, provider.name)
              } else if (evidence) {
                const reason = 'GARANTI_SIGNED_SUCCESS_RETURN_REQUIRED'
                await saveGarantiOrderinqReconciliation(ownedOrder.id, 'pending', reason, { ...evidence, decision: 'pending', reason })
              }
            } catch (reconciliationError) {
              const evidence = provider.takeLiveReconciliationEvidence()
              if (evidence) {
                const reason = reconciliationError instanceof GarantiPending ? evidence.reason : 'GARANTI_RECONCILIATION_UNAVAILABLE'
                try { await saveGarantiOrderinqReconciliation(ownedOrder.id, 'pending', reason, { ...evidence, decision: 'pending', reason }) }
                catch { console.warn(JSON.stringify({ event: 'garanti_reconciliation_evidence_store_failed', order_id: ownedOrder.id })) }
              }
            }
          }
          if (await isGarantiLiveSingleFinalizeOrder(ownedOrder)) {
            try { await saveGarantiLiveSingleFinalizeFailure(ownedOrder.id, 'failure', provider.lastVerificationStage, code, verification) }
            catch { /* The generic safe diagnostic above remains authoritative. */ }
          }
          return destination(`/checkout/verify?orderId=${encodeURIComponent(ownedOrder.id)}`)
        }
      }
    }
    if (error instanceof GarantiPending) return destination(`/checkout/verify?orderId=${encodeURIComponent(error.reference)}`)
    // Neither bad signatures nor unsigned cancellations can change DB state.
    if (provider.config.liveObservationOnly) {
      const code = liveFailureCode(error)
      console.warn(JSON.stringify({ event: 'garanti_live_return_rejected', code }))
      return destination(`/checkout/failure?code=${encodeURIComponent(code)}`)
    }
    return destination('/checkout/failure')
  }
}
