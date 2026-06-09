/** Thrown when no configured candidate/model satisfies the routing hints. */
export class NoCapableModelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoCapableModelError'
  }
}

/**
 * Classify an error thrown by a provider's `chat()` as retryable, i.e. worth
 * failing over to the next candidate. Covers rate limits (429), upstream
 * outages (5xx), and model-deprecation signals. Non-retryable errors (auth,
 * bad request) propagate immediately so they aren't masked by failover.
 */
export function isRetryable(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false

  const status = (err as { status?: unknown }).status
  if (typeof status === 'number') {
    if (status === 429) return true
    if (status >= 500 && status <= 599) return true
    // 4xx other than 429 are caller errors — don't fail over.
    if (status >= 400 && status < 500) return false
  }

  const code = (err as { code?: unknown }).code
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNREFUSED') {
    return true
  }

  const message = (err as { message?: unknown }).message
  if (typeof message === 'string') {
    const m = message.toLowerCase()
    if (m.includes('deprecat')) return true
    if (m.includes('overloaded')) return true
    // Network-ish failures with no status attached.
    if (status === undefined && (m.includes('timeout') || m.includes('fetch failed'))) {
      return true
    }
  }

  return false
}
