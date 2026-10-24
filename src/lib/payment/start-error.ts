// Only these application codes/stages may reach responses or server logs.
export type StartStage = 'request' | 'lookup' | 'quote' | 'create_rpc' | 'handoff' | 'store_redirect'
export type RpcFailureReason = 'price' | 'stock' | 'owner' | 'cart'
// The order RPCs raise fixed English messages. Only these known messages are
// classified (never echoed), so support can tell a price/summary mismatch from
// a stock or ownership refusal without exposing database text.
const RPC_REASONS: Record<string, RpcFailureReason> = {
  'quote changed': 'price', 'total mismatch': 'price', 'opening campaign disabled': 'price',
  'invalid campaign snapshot': 'price', 'invalid campaign rate': 'price', 'buyer summary mismatch': 'price', 'invalid summary': 'price',
  'stock unavailable': 'stock', 'variant unavailable': 'stock', 'product unavailable': 'stock',
  'Authenticated checkout required': 'owner', 'Invalid order owner': 'owner', 'idempotency ownership/content mismatch': 'owner',
  'invalid legal acceptance': 'cart', 'invalid items': 'cart', 'duplicate variant': 'cart', 'invalid quantity': 'cart',
  'measurement kind missing': 'cart', 'invalid measurements': 'cart', 'invalid measurement range': 'cart', 'invalid payment request': 'cart',
}
export function rpcFailureReason(message: unknown): RpcFailureReason | undefined {
  return typeof message === 'string' && Object.hasOwn(RPC_REASONS, message) ? RPC_REASONS[message] : undefined
}
export class PaymentStartError extends Error {
  readonly databaseCode?: string
  constructor(readonly code: 'UNRESOLVED_PAYMENT' | 'TEST_HANDOFF_SUBMITTED' | 'CONTROLLED_ITEM_REQUIRED' | 'START_FAILED',
    readonly stage: StartStage, message: string, databaseCode?: string, readonly resumeOrderId?: string, readonly rpcReason?: RpcFailureReason) {
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
