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
  /**
   * Optional project-level aggregate cap: `checkProject` blocks a request when
   * the AGGREGATE recorded spend across all keys in `projectId` crosses the
   * project ceiling within its window. A drained project blocks even zero-cost
   * keyed requests until the window resets. The cap config is passed per call
   * (the gateway forwards `spend.project`), so no state duplication.
   */
  checkProject?(
    projectId: string,
    cap: { ceilingUsd: number; windowMs: number },
    estimatedCostUsd: number,
  ): 'allow' | 'block'
  /** Record actual spend against `projectId`'s aggregate after completion. */
  recordProject?(
    projectId: string,
    cap: { ceilingUsd: number; windowMs: number },
    actualCostUsd: number,
  ): void
  /** Aggregate USD spent across all keys in `projectId` within the window. */
  projectSpent?(projectId: string, cap: { ceilingUsd: number; windowMs: number }): number
  /** Reset `projectId`'s aggregate (post-top-up / new budget period). */
  resetProject?(projectId: string): void
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

  // --- Project-level aggregate cap ---

  private readonly projectBuckets = new Map<
    string,
    { amount: number; windowStart: number }
  >()

  private projectBucket(
    projectId: string,
    cap: { ceilingUsd: number; windowMs: number },
  ): { amount: number; windowStart: number } {
    const b = this.projectBuckets.get(projectId)
    if (b && Date.now() - b.windowStart >= cap.windowMs) {
      this.projectBuckets.delete(projectId)
      return { amount: 0, windowStart: Date.now() }
    }
    return b ?? { amount: 0, windowStart: Date.now() }
  }

  checkProject(
    projectId: string,
    cap: { ceilingUsd: number; windowMs: number },
    estimatedCostUsd: number,
  ): 'allow' | 'block' {
    // DECISION: a drained project stays drained even for zero-cost requests.
    // Unlike the per-key breaker (which allows zero-cost traffic), a project
    // cap is an operator budget — once aggregate recorded spend crosses the
    // ceiling, ALL keyed traffic 402s until the window resets.
    // TOCTOU (in-flight overshoot): check happens at request start, spend is
    // recorded only at completion, so N concurrent in-flight requests each
    // pass checkProject and the aggregate can overshoot the ceiling by up to
    // the sum of their un-recorded costs — bounded by N-1 × per-request
    // estimate. This is accepted for the in-memory reference implementation;
    // a reservation/hold system is deliberately out of scope (YAGNI) until a
    // distributed tracker replaces this one.
    const b = this.projectBucket(projectId, cap)
    if (b.amount >= cap.ceilingUsd) return 'block'
    return b.amount + estimatedCostUsd > cap.ceilingUsd ? 'block' : 'allow'
  }

  recordProject(
    projectId: string,
    cap: { ceilingUsd: number; windowMs: number },
    actualCostUsd: number,
  ): void {
    if (actualCostUsd <= 0) return
    const b = this.projectBuckets.get(projectId)
    if (b && Date.now() - b.windowStart < cap.windowMs) b.amount += actualCostUsd
    else this.projectBuckets.set(projectId, { amount: actualCostUsd, windowStart: Date.now() })
  }

  projectSpent(
    projectId: string,
    cap: { ceilingUsd: number; windowMs: number },
  ): number {
    return this.projectBucket(projectId, cap).amount
  }

  resetProject(projectId: string): void {
    this.projectBuckets.delete(projectId)
  }
}
