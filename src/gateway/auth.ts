import { timingSafeEqual } from 'node:crypto'

/** Constant-time string compare (returns false on length mismatch). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Validate a bearer token against the configured keys. Empty key list disables
 * auth (dev convenience) — the server logs a warning at startup in that case.
 */
export function checkBearer(apiKeys: string[] | undefined, authHeader: string | undefined): boolean {
  const keys = apiKeys ?? []
  if (keys.length === 0) return true
  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  return keys.some((key) => safeEqual(key, token))
}
