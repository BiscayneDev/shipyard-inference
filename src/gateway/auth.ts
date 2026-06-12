import { timingSafeEqual } from 'node:crypto'
import type { Account, ApiKeyStore } from './keys.js'

/** Constant-time string compare (returns false on length mismatch). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

function bearerToken(authHeader: string | undefined): string {
  return (authHeader ?? '').replace(/^Bearer\s+/i, '')
}

/**
 * Validate a bearer token against the configured keys. Empty key list disables
 * auth (dev convenience) — the server logs a warning at startup in that case.
 */
export function checkBearer(apiKeys: string[] | undefined, authHeader: string | undefined): boolean {
  const keys = apiKeys ?? []
  if (keys.length === 0) return true
  const token = bearerToken(authHeader)
  if (!token) return false
  return keys.some((key) => safeEqual(key, token))
}

export interface AuthResult {
  ok: boolean
  /** The resolved account when a per-user key matched (drives attribution). */
  account?: Account
}

/**
 * Resolve a request's bearer token. A per-user `ApiKeyStore` is checked first
 * (and yields the attributed `account`); otherwise the static `apiKeys` list is
 * used. Auth is disabled only when NEITHER is configured (dev convenience).
 */
export async function resolveAuth(
  opts: { apiKeys?: string[]; keyStore?: ApiKeyStore },
  authHeader: string | undefined,
): Promise<AuthResult> {
  const keys = opts.apiKeys ?? []
  if (keys.length === 0 && !opts.keyStore) return { ok: true } // auth disabled (dev)
  const token = bearerToken(authHeader)
  if (!token) return { ok: false }
  if (opts.keyStore) {
    const account = await opts.keyStore.resolve(token)
    if (account) return { ok: true, account }
  }
  if (keys.some((key) => safeEqual(key, token))) return { ok: true }
  return { ok: false }
}
