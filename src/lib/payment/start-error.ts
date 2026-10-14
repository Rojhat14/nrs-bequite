// Only these application codes/stages may reach responses or server logs.
export type StartStage = 'request' | 'lookup' | 'quote' | 'create_rpc' | 'handoff' | 'store_redirect'
export class PaymentStartError extends Error {
  readonly databaseCode?: string
  constructor(readonly code: 'UNRESOLVED_PAYMENT' | 'TEST_HANDOFF_SUBMITTED' | 'CONTROLLED_ITEM_REQUIRED' | 'START_FAILED',
    readonly stage: StartStage, message: string, databaseCode?: string, readonly resumeOrderId?: string) {
    super(message)
    if (databaseCode && /^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(databaseCode)) this.databaseCode = databaseCode
  }
}
export async function startStage<T>(stage: StartStage, action: () => Promise<T>): Promise<T> {
  try { return await action() } catch (error) {
    if (error instanceof PaymentStartError) throw error
    throw new PaymentStartError('START_FAILED', stage, error instanceof Error ? error.message : 'Ödeme başlatılamadı.')
  }
}
