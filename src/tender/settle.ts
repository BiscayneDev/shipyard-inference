import { assertValidAttestation } from './attestation.js'
import { TENDER_DEFAULTS } from './types.js'
import type { SettlementResult, UsageAttestation } from './types.js'
import type { CreditLedger } from './ledger.js'

export interface AccrueOptions {
  /** Public key the attestation must verify against (the release gate). */
  publicKeyHex: string
  /** Where the requester's credit accrues. */
  ledger: CreditLedger
  /** Impression price (USDC) — from the served auction-log record. */
  pricePerImpressionUsdc: number
  /** Fraction of the price that accrues to the requester (default 0.50). */
  requesterShare?: number
  minWaitMs?: number
  /** Auction-log cross-check for the gate. */
  wasServed?: (requestId: string, placementId: string) => boolean
  /** Unix ms (passed in — keeps this deterministic/testable). */
  at: number
}

/**
 * Settle one impression against its attestation. Runs the release gate first
 * (section 8), then accrues `REQUESTER_SHARE` of the impression price to the
 * request's wallet as an inference credit. Accrues only — the on-chain move is a
 * batched sweep (`sweepCredits`), never per-impression.
 */
export function accrueSettlement(att: UsageAttestation, opts: AccrueOptions): SettlementResult {
  const gross = opts.pricePerImpressionUsdc
  const base: Omit<SettlementResult, 'status' | 'requesterShareUsdc'> = {
    placementId: att.placementId,
    requestId: att.requestId,
    grossUsdc: gross,
    userWallet: att.userWallet,
  }

  const gate = assertValidAttestation(att, {
    publicKeyHex: opts.publicKeyHex,
    minWaitMs: opts.minWaitMs,
    wasServed: opts.wasServed,
  })
  if (!gate.ok) {
    return { ...base, requesterShareUsdc: 0, status: 'rejected', reason: gate.reason }
  }

  const share = gross * (opts.requesterShare ?? TENDER_DEFAULTS.REQUESTER_SHARE)
  opts.ledger.creditInference(
    att.userWallet,
    share,
    { requestId: att.requestId, placementId: att.placementId },
    opts.at,
  )
  return { ...base, requesterShareUsdc: share, status: 'accrued' }
}

export interface ClickOptions {
  ledger: CreditLedger
  /** Wallet the click credit accrues to. */
  wallet: string
  requestId: string
  placementId: string
  /** Impression price (USDC) of the served placement. */
  pricePerImpressionUsdc: number
  /** Click bills at this × the impression rate (default 50). */
  clickMultiplier?: number
  requesterShare?: number
  at: number
}

/**
 * Accrue a CLICK. In an agent context a "click" is the agent actually calling the
 * sponsored x402 endpoint — the ad and the transaction are the same call. It
 * bills at `CLICK_MULTIPLIER` × the impression rate; `REQUESTER_SHARE` of that
 * accrues to the request's wallet, same as an impression. Returns the credit.
 */
export function accrueClick(opts: ClickOptions): { creditedUsd: number; grossUsdc: number } {
  const grossUsdc = opts.pricePerImpressionUsdc * (opts.clickMultiplier ?? TENDER_DEFAULTS.CLICK_MULTIPLIER)
  const creditedUsd = grossUsdc * (opts.requesterShare ?? TENDER_DEFAULTS.REQUESTER_SHARE)
  opts.ledger.creditInference(
    opts.wallet,
    creditedUsd,
    { requestId: opts.requestId, placementId: opts.placementId },
    opts.at,
  )
  return { creditedUsd, grossUsdc }
}

/** USDC has 6 decimals — convert a dollar amount to atomic units (string). */
export const usdcToAtomic = (usd: number): string => String(Math.round(usd * 1_000_000))

export interface SweepDeps {
  /**
   * The settlement primitive — pass `payboxSettle` (Tender adds no money-movement
   * code; it sweeps over the existing rail). Returns a tx signature.
   */
  settle: (args: {
    amount: string
    treasury: string
    network?: 'mainnet' | 'devnet'
  }) => Promise<{ signature: string }>
  treasury: string
  network?: 'mainnet' | 'devnet'
  /** Don't sweep dust — skip when the balance is below this (USDC). */
  minSweepUsdc?: number
}

export interface SweepResult {
  wallet: string
  amountUsd: number
  signature: string
}

/**
 * Batch-sweep a wallet's accrued credits on-chain via the injected settle rail
 * (Paybox/MPP), then mark them swept. Returns `null` when there's nothing (or too
 * little) to sweep. This is the only path that touches chain — accrue-then-sweep,
 * on the MPP-session cadence, not per-impression.
 */
export async function sweepCredits(
  ledger: CreditLedger,
  wallet: string,
  deps: SweepDeps,
): Promise<SweepResult | null> {
  const amountUsd = ledger.balance(wallet)
  if (amountUsd <= 0 || amountUsd < (deps.minSweepUsdc ?? 0)) return null
  const { signature } = await deps.settle({
    amount: usdcToAtomic(amountUsd),
    treasury: deps.treasury,
    network: deps.network,
  })
  ledger.markSwept(wallet)
  return { wallet, amountUsd, signature }
}
