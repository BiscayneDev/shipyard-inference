/**
 * Per-provider circuit breaker for the routing failover loop.
 *
 * Tracks consecutive failures per candidate id. After `failureThreshold`
 * consecutive failures the circuit is OPEN — `isAvailable` returns false so
 * the Router skips that candidate without wasting a request. After
 * `cooldownMs` the circuit goes HALF-OPEN: one probe request is allowed; a
 * success closes the circuit, a failure re-opens it.
 */

export interface ProviderHealthOptions {
  /** Consecutive failures before the circuit opens. Default 3. */
  failureThreshold?: number
  /** How long an open circuit stays open before allowing a probe. Default 30s. */
  cooldownMs?: number
  /** Injectable clock for tests. */
  now?: () => number
}

interface CircuitState {
  consecutiveFailures: number
  openedAt: number | null
}

export class ProviderHealthTracker {
  private readonly threshold: number
  private readonly cooldownMs: number
  private readonly now: () => number
  private readonly states = new Map<string, CircuitState>()

  constructor(opts: ProviderHealthOptions = {}) {
    this.threshold = opts.failureThreshold ?? 3
    this.cooldownMs = opts.cooldownMs ?? 30_000
    this.now = opts.now ?? (() => Date.now())
  }

  recordSuccess(id: string): void {
    const s = this.states.get(id)
    if (!s) return
    // Success on an open circuit is ignored (only a probe after cooldown may
    // close it); success on a closed circuit resets the failure counter.
    if (s.openedAt === null || this.isAvailable(id)) {
      s.consecutiveFailures = 0
      s.openedAt = null
    }
  }

  recordFailure(id: string): void {
    let s = this.states.get(id)
    if (!s) {
      s = { consecutiveFailures: 0, openedAt: null }
      this.states.set(id, s)
    }
    s.consecutiveFailures++
    if (s.consecutiveFailures >= this.threshold) {
      s.openedAt = this.now()
    }
  }

  /** True when the circuit is closed or half-open (probe allowed). */
  isAvailable(id: string): boolean {
    const s = this.states.get(id)
    if (!s) return true
    if (s.openedAt === null) return true
    return this.now() - s.openedAt >= this.cooldownMs
  }
}
