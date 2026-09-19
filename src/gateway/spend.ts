/**
 * Per-key spend circuit breaker. The wallet balance is the hard limit (x402
 * handles that); this is the *soft* guardrail on top: a runaway agentic
 * session failing over local→cloud repeatedly could otherwise drain a
 * wallet silently. Keys each get a cumulative USD ceiling; requests that
 * would push past it are blocked with a recoverable 402 (top-up link),
 * never a dead session — `reset` (or a higher ceiling) resumes instantly.
 */

export interface SpendTrackerOptions {
  /** Default cumulative USD ceiling per key. */
  defaultCeilingUsd: number
  /** Per-key ceiling overrides (e.g. a trusted agent gets a higher budget). */
  ceilings?: Record<string, number>
}

export interface SpendTracker {
  /** Decision for a request from `key` with `estimatedCostUsd`. */
  check(key: string, estimatedCostUsd: number): 'allow' | 'block'
  /** Record actual spend for `key` after a completed request. */
  record(key: string, actualCostUsd: number): void
  /** Cumulative USD spent by `key` since the last reset. */
  spent(key: string): number
  /** Reset `key`'s accumulated spend (post-top-up / new budget period). */
  reset(key: string): void
}

export class MemorySpendTracker implements SpendTracker {
  private readonly opts: SpendTrackerOptions
  private readonly spentByKey = new Map<string, number>()

  constructor(opts: SpendTrackerOptions) {
    this.opts = opts
  }

  private ceiling(key: string): number {
    return this.opts.ceilings?.[key] ?? this.opts.defaultCeilingUsd
  }

  check(key: string, estimatedCostUsd: number): 'allow' | 'block' {
    // An already-blown key stays blocked until reset/top-up, even for a
    // zero-cost request — otherwise a drained session keeps paying burst
    // costs on the first priced request after each free one.
    if (this.spent(key) > 0 && this.spent(key) >= this.ceiling(key)) return 'block'
    // Free traffic is always allowed — the breaker guards paid bursts only.
    if (estimatedCostUsd <= 0) return 'allow'
    return this.spent(key) + estimatedCostUsd > this.ceiling(key) ? 'block' : 'allow'
  }

  record(key: string, actualCostUsd: number): void {
    this.spentByKey.set(key, (this.spentByKey.get(key) ?? 0) + actualCostUsd)
  }

  spent(key: string): number {
    return this.spentByKey.get(key) ?? 0
  }

  reset(key: string): void {
    this.spentByKey.delete(key)
  }
}
