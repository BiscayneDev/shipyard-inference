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
import type { PayoutLog } from './payout-log.js'

/** The on-chain transfer primitive — treasury → `destination`. Inject `payboxSettle`. */
export interface PayoutRail {
  transfer(args: { destination: string; amountUsd: number }): Promise<{ signature: string }>
}

export interface PayoutResult {
  account: string
  /** Resolved payout wallet, or null when none could be resolved. */
  destination: string | null
  amountUsd: number
  /** On-chain signature when paid; null when reported/skipped/failed. */
  signature: string | null
  /**
   * `paid` — transferred on-chain and marked swept.
   * `reported` — would pay, but no rail wired (report-only); NOT marked.
   * `skipped` — below the minimum, or no destination wallet; NOT marked.
   * `failed` — the transfer threw; the reservation was rolled back, retried next run.
   */
  status: 'paid' | 'reported' | 'skipped' | 'failed'
  reason?: string
}

export interface SweepOptions {
  /** Where the on-chain transfer happens. Omit for report-only (computes, sends nothing). */
  rail?: PayoutRail
  /** Resolve an account id to its payout wallet. Return undefined to skip the account. */
  resolveDestination: (account: string) => string | undefined | Promise<string | undefined>
  /** Append-only audit/reconciliation log — a successful payout is recorded here. Optional. */
  payoutLog?: PayoutLog
  /** Don't sweep dust — skip accounts below this unswept balance (USDC). Default 0. */
  minPayoutUsdc?: number
  /** Time source (ms). Injectable for tests. Defaults to `Date.now`. */
  now?: () => number
}

/**
 * Sweep every account with an unswept balance: resolve its destination, RESERVE
 * its credits (mark swept up front so a crash can never re-select and re-pay
 * them), transfer the reserved amount on-chain, then record the signature. If the
 * transfer throws, the reservation is rolled back by credit id so it retries next
 * run. With no rail wired the sweep is report-only (computes, reserves nothing,
 * sends nothing). Returns one {@link PayoutResult} per account considered.
 *
 * Guarantee: no double-pay. A crash between reserve and record leaves credits
 * swept-but-unlogged (an under-pay), which the payout log surfaces for reconcile.
 */
export async function sweepAll(store: CreditStore, opts: SweepOptions): Promise<PayoutResult[]> {
  const now = opts.now ?? Date.now
  const min = opts.minPayoutUsdc ?? 0
  // One cutoff for the whole sweep — credits accrued mid-sweep roll to next run.
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
      // Report-only: don't reserve, leave the credit payable for when a rail is live.
      results.push({ account, destination, amountUsd, status: 'reported', signature: null })
      continue
    }
    // Reserve BEFORE paying: these credits leave the work-list immediately, so no
    // run — this one or a later one after a crash — can pay them twice.
    const { ids, amountUsd: claimed } = await store.claimUnswept(account, before)
    if (ids.length === 0) {
      results.push({ account, destination, amountUsd: 0, signature: null, status: 'skipped', reason: 'already settled' })
      continue
    }
    try {
      const { signature } = await opts.rail.transfer({ destination, amountUsd: claimed })
      await opts.payoutLog?.record({ account, destination, amountUsd: claimed, signature, creditIds: ids, at: before })
      results.push({ account, destination, amountUsd: claimed, signature, status: 'paid' })
    } catch (err) {
      // The transfer failed — undo the reservation so the credits are retried.
      await store.release(ids)
      results.push({
        account,
        destination,
        amountUsd: claimed,
        signature: null,
        status: 'failed',
        reason: String(err instanceof Error ? err.message : err),
      })
    }
  }
  return results
}

/** Total USDC paid out in a sweep (sum of `paid` results). */
export const totalPaid = (results: PayoutResult[]): number =>
  results.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amountUsd, 0)

export interface ReconcileItem {
  id: number | string
  account: string
  amountUsd: number
  at: number
}

export interface ReconcileReport {
  /** True when every swept credit has a matching payout-log entry. */
  ok: boolean
  unreconciledCount: number
  /** Total USDC of swept-but-unlogged credits (potential under-pays). */
  unreconciledUsd: number
  /** The offending swept credits — settle/refund or confirm on-chain manually. */
  items: ReconcileItem[]
}

/**
 * Cross-check swept credits against the payout log: any credit marked swept whose
 * id was never recorded as paid is an under-pay (a reserve-then-crash gap from the
 * sweep) to investigate. This is the safe-failure side of reserve-then-pay — the
 * money is never double-sent, but a crash can strand a credit swept-but-unpaid;
 * this surfaces exactly those. Bound the scan with `since` (unix ms).
 */
export async function reconcile(
  store: CreditStore,
  payoutLog: PayoutLog,
  opts: { since?: number } = {},
): Promise<ReconcileReport> {
  const swept = await store.sweptCredits(opts.since)
  const logged = new Set<string>()
  for (const e of await payoutLog.list()) for (const id of e.creditIds) logged.add(String(id))
  const items = swept.filter((c) => !logged.has(String(c.id)))
  const unreconciledUsd = items.reduce((s, c) => s + c.amountUsd, 0)
  return { ok: items.length === 0, unreconciledCount: items.length, unreconciledUsd, items }
}
