export interface RetryPolicy {
  /** Per-candidate retry attempts on retryable errors. Default 0 (off). */
  maxRetries?: number
  /** Base backoff delay in ms (doubles each attempt). Default 250. */
  baseDelayMs?: number
  /** Cap on the backoff and on any honored `Retry-After`. Default 20000. */
  maxDelayMs?: number
  /** Apply full jitter to the backoff (recommended). Default true. */
  jitter?: boolean
  /** Honor a `Retry-After` / `retry-after-ms` header on the error. Default true. */
  respectRetryAfter?: boolean
}

/** Exponential backoff (`base * 2^attempt`), capped, with optional full jitter. */
export function backoffDelayMs(attempt: number, policy: RetryPolicy = {}): number {
  const base = policy.baseDelayMs ?? 250
  const max = policy.maxDelayMs ?? 20_000
  const capped = Math.min(max, base * 2 ** attempt)
  return policy.jitter === false ? capped : Math.random() * capped
}

/** Extract a `Retry-After` delay (ms) from an error's headers, if present. */
export function retryAfterMs(error: unknown): number | undefined {
  if (error == null || typeof error !== 'object') return undefined
  const headers = (error as { headers?: unknown }).headers
  const read = (name: string): string | undefined => {
    if (!headers) return undefined
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name) ?? undefined
    }
    const rec = headers as Record<string, unknown>
    const value = rec[name] ?? rec[name.toLowerCase()]
    return typeof value === 'string' ? value : undefined
  }

  const ms = read('retry-after-ms')
  if (ms !== undefined && /^\d+$/.test(ms.trim())) return Number(ms)

  const ra = read('retry-after')
  if (ra === undefined) return undefined
  const trimmed = ra.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000 // delta-seconds
  const date = Date.parse(trimmed) // HTTP-date form
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
  return undefined
}

/** Delay before the next retry: a capped `Retry-After` when present, else jittered backoff. */
export function nextRetryDelayMs(
  attempt: number,
  policy: RetryPolicy,
  error: unknown,
): number {
  if (policy.respectRetryAfter !== false) {
    const ra = retryAfterMs(error)
    if (ra !== undefined) return Math.min(ra, policy.maxDelayMs ?? 20_000)
  }
  return backoffDelayMs(attempt, policy)
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))
