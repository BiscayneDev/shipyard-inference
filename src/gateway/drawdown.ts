/**
 * Balance drawdown (Round 2, Task R1): keyed requests DEBIT the shared credit
 * ledger. Until now a topped-up balance was decorative — spend was recorded
 * against the breaker tracker only. Drawdown closes the loop:
 *
 *  - Pre-flight: a wallet-bound key (account.wallet set) with a known-PAID
 *    request model must hold balance > 0 before serving. Exhausted → 402
 *    `insufficient_balance` with a top-up hint (the x402 challenge when the
 *    gateway charges x402, else a message). Free ($0-priced / unpriced)
 *    traffic always passes; non-wallet keys (dev/owner/bootstrap) unchanged.
 *  - Post-completion: debit the ACTUAL costUsd from the SAME CreditStore the
 *    topup credited, under the SAME balance identity (`account.userId` — see
 *    topup.ts), so top-up credits and usage debits reconcile to one ledger.
 *    BYO routes (`billed === false`) never debit; $0 cost never debits; the
 *    debit is idempotent per request id (replay-safe, mirroring topup's
 *    consumed-payment map).
 */
import type { Account } from './keys.js'
import type { GatewayConfig } from './config.js'
import { buildChallenge } from './x402.js'
import { DEFAULT_PRICING } from '../router/pricing.js'
import type { CreditStore } from '../tender/credit-store.js'

/** Ledger placement id for usage debits (topup uses 'topup'). */
export const DRAWDOWN_PLACEMENT = 'drawdown'

/**
 * Balance identity for a keyed request: the SAME derivation topup uses —
 * the key's stable `userId`. Wallet-bound keys therefore credit and debit
 * one ledger entry stream per agent.
 */
export function balanceAccountOf(account: Account): string {
  return account.userId
}

/** True when the key is bound to a wallet (the self-funding identity). */
export function isWalletBound(account: Account | undefined | null): boolean {
  return Boolean(account?.wallet)
}

/**
 * Replay-safe debit registry: a request id may debit at most once. Mirrors
 * the consumed-payment map in the x402 verifier — a retried settle (crash
 * after accrue, transport retry) cannot double-debit.
 */
export class ConsumedDrawdowns {
  private readonly seen = new Set<string>()

  /** Atomically claim `requestId`. False when already consumed. */
  claim(requestId: string): boolean {
    if (this.seen.has(requestId)) return false
    this.seen.add(requestId)
    return true
  }

  get size(): number {
    return this.seen.size
  }
}

/**
 * Pre-flight paid-ness: true only when the requested model is KNOWN to cost
 * money — declared on a candidate with positive per-MTok pricing, or present
 * in the default pricing table. Unknown/unpriced ids are treated as free
 * traffic for the gate (the actual debit still happens post-completion if a
 * real cost was metered), so unpriced/free traffic always passes.
 */
export function knownPaidModel(config: GatewayConfig, model: string | undefined): boolean {
  if (!model) return false
  const requested = model.trim().toLowerCase()
  if (!requested) return false
  for (const candidate of config.candidates) {
    for (const declared of candidate.models ?? []) {
      if (declared.model.toLowerCase() === requested) {
        return (declared.inputCostPerMTok ?? 0) > 0 || (declared.outputCostPerMTok ?? 0) > 0
      }
    }
  }
  const base = DEFAULT_PRICING[requested]
  if (base) return (base.inputCostPerMTok ?? 0) > 0 || (base.outputCostPerMTok ?? 0) > 0
  return false
}

/**
 * 402 body for an exhausted wallet-bound key. When the gateway charges x402
 * the top-up challenge rides along (standard `accepts` shape the agent can
 * settle immediately); otherwise a plain message directs to POST /v1/topup.
 */
export function insufficientBalanceBody(
  x402: GatewayConfig['x402'],
  balanceUsd: number,
): { error: Record<string, unknown> } {
  return {
    error: {
      message:
        'Credit balance exhausted. Top up with USDC via POST /v1/topup to continue serving.',
      type: 'insufficient_balance',
      code: null,
      param: null,
      balanceUsd,
      ...(x402 ? { topup: buildChallenge(x402, '/v1/topup') } : {}),
    },
  }
}

/**
 * Debit actual cost from the credit ledger. Idempotent per `requestId`:
 * the first claim wins, replays are no-ops. `costUsd <= 0` (free/unpriced
 * traffic) never debits.
 */
export async function debitRequest(
  opts: { credits: CreditStore; consumed: ConsumedDrawdowns },
  balanceAccount: string,
  requestId: string,
  costUsd: number | undefined,
): Promise<void> {
  if (!costUsd || !Number.isFinite(costUsd) || costUsd <= 0) return
  if (!opts.consumed.claim(requestId)) return
  await opts.credits.accrue({
    account: balanceAccount,
    amountUsd: -costUsd,
    placementId: DRAWDOWN_PLACEMENT,
    line: `usage drawdown -${costUsd.toFixed(6)} USDC (request ${requestId})`,
    requestId,
    at: Date.now(),
  })
}
