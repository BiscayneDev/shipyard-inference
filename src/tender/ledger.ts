// The credit ledger Tender writes into. The gateway's savings engine is
// read-only (baseline−actual, computed per request — no credit-write API), so
// Tender keeps its own per-wallet credit store and the surface shows BOTH: the
// routing savings the gateway computes AND the idle-attention credit accrued
// here, netted into one number. Flat and boring, in-memory; no new token.

/** One accrued credit — the requester's share of an impression price. */
export interface CreditEntry {
  /** Wallet the credit accrues to (the request's attributed wallet). */
  wallet: string
  amountUsd: number
  requestId: string
  placementId: string
  /** Unix ms. */
  at: number
  /** True once swept on-chain (or netted against a settlement). */
  swept: boolean
}

/**
 * Per-wallet inference credits. Credits accrue here against valid attestations
 * and are netted against the wallet's inference bill / swept in batches — never
 * settled per-impression on-chain.
 */
export class CreditLedger {
  private readonly ledger: CreditEntry[] = []

  /** Accrue `amountUsd` to `wallet`, tied to the request/placement that earned it. */
  creditInference(
    wallet: string,
    amountUsd: number,
    ref: { requestId: string; placementId: string },
    at: number,
  ): CreditEntry {
    const entry: CreditEntry = {
      wallet,
      amountUsd,
      requestId: ref.requestId,
      placementId: ref.placementId,
      at,
      swept: false,
    }
    this.ledger.push(entry)
    return entry
  }

  /** Unswept credit balance for a wallet. */
  balance(wallet: string): number {
    return this.ledger
      .filter((e) => e.wallet === wallet && !e.swept)
      .reduce((sum, e) => sum + e.amountUsd, 0)
  }

  /** Total unswept credit across all wallets. */
  total(): number {
    return this.ledger.filter((e) => !e.swept).reduce((sum, e) => sum + e.amountUsd, 0)
  }

  entries(wallet: string): CreditEntry[] {
    return this.ledger.filter((e) => e.wallet === wallet)
  }

  /** Mark a wallet's unswept credits as swept; returns the amount swept. */
  markSwept(wallet: string): number {
    let swept = 0
    for (const e of this.ledger) {
      if (e.wallet === wallet && !e.swept) {
        swept += e.amountUsd
        e.swept = true
      }
    }
    return swept
  }

  /**
   * Consume up to `amountUsd` of a wallet's unswept credit (FIFO) — used when the
   * credit is netted against an inference settlement. Partially consumes the last
   * entry if needed. Returns the amount actually consumed.
   */
  consume(wallet: string, amountUsd: number): number {
    let remaining = amountUsd
    let consumed = 0
    for (const e of this.ledger) {
      if (remaining <= 1e-12) break
      if (e.wallet !== wallet || e.swept) continue
      if (e.amountUsd <= remaining + 1e-12) {
        e.swept = true
        consumed += e.amountUsd
        remaining -= e.amountUsd
      } else {
        e.amountUsd -= remaining
        consumed += remaining
        remaining = 0
      }
    }
    return consumed
  }
}
