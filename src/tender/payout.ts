// Automatic payout — the batched on-chain settlement of accrued credits. Tender
// accrues per impression into the durable CreditStore (off-chain bookkeeping over
// USDC the advertiser already funded into the treasury); this module sweeps those
// unswept balances to their destination wallets and marks them settled.
//
// Money-movement is INJECTED as a `PayoutRail` (treasury → destination transfer),
// so this layer adds no chain code — it composes over the existing `payboxSettle`
// rail. Destinations are resolved by an injected `resolveDestination` (user payout
// wallet from the key store; the provider's own payout wallet for its cut). With
// no rail wired, the sweep runs REPORT-ONLY: it computes what's owed and touches
// nothing — safe to run on a cron before a real signer is configured.
//
// Idempotency: a single `before` cutoff is captured per sweep and used for BOTH
// the work-list read and `markSwept`, so a credit accrued mid-sweep is neither
// paid nor marked until the next run. Each account is paid THEN marked; if the
// process dies between, the credit stays unswept and is retried next run (a
// bounded re-pay window — production should record the signature against an
// idempotency key; see TODO).

import type { CreditStore } from './credit-store.js'

/** The on-chain transfer primitive — treasury → `destination`. Inject `payboxSettle`. */
export interface PayoutRail {
  transfer(args: { destination: string; amountUsd: number }): Promise<{ signature: string }>
}

export interface PayoutResult {
  account: string
  /** Resolved payout wallet, or null when none could be resolved. */
  destination: string | null
  amountUsd: number
  /** On-chain signature when paid; null when reported/skipped. */
  signature: string | null
  /**
   * `paid` — transferred on-chain and marked swept.
   * `reported` — would pay, but no rail wired (report-only); NOT marked.
   * `skipped` — below the minimum, or no destination wallet; NOT marked.
   */
  status: 'paid' | 'reported' | 'skipped'
  reason?: string
}

export interface SweepOptions {
  /** Where the on-chain transfer happens. Omit for report-only (computes, sends nothing). */
  rail?: PayoutRail
  /** Resolve an account id to its payout wallet. Return undefined to skip the account. */
  resolveDestination: (account: string) => string | undefined | Promise<string | undefined>
  /** Don't sweep dust — skip accounts below this unswept balance (USDC). Default 0. */
  minPayoutUsdc?: number
  /** Time source (ms). Injectable for tests. Defaults to `Date.now`. */
  now?: () => number
}

/**
 * Sweep every account with an unswept balance: resolve its destination, transfer
 * the balance on-chain (or report it when no rail is wired), then mark it settled.
 * Returns one {@link PayoutResult} per account considered.
 */
export async function sweepAll(store: CreditStore, opts: SweepOptions): Promise<PayoutResult[]> {
  const now = opts.now ?? Date.now
  const min = opts.minPayoutUsdc ?? 0
  // One cutoff for the whole sweep — see the idempotency note above.
  const before = now()
  const work = await store.unsweptByAccount(before)
  const results: PayoutResult[] = []

  for (const { account, amountUsd } of work) {
    if (amountUsd < min) {
      results.push({ account, destination: null, amountUsd, signature: null, status: 'skipped', reason: 'below minimum' })
      continue
    }
    const destination = (await opts.resolveDestination(account)) || null
    if (!destination) {
      results.push({ account, destination: null, amountUsd, signature: null, status: 'skipped', reason: 'no payout wallet' })
      continue
    }
    if (!opts.rail) {
      // Report-only: leave the credit unswept so it pays out once a rail is live.
      results.push({ account, destination, amountUsd, signature: null, status: 'reported' })
      continue
    }
    const { signature } = await opts.rail.transfer({ destination, amountUsd })
    // Mark only the rows we read (<= before) — concurrent accruals roll to next run.
    await store.markSwept(account, before)
    results.push({ account, destination, amountUsd, signature, status: 'paid' })
  }
  return results
}

/** Total USDC paid out in a sweep (sum of `paid` results). */
export const totalPaid = (results: PayoutResult[]): number =>
  results.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amountUsd, 0)
