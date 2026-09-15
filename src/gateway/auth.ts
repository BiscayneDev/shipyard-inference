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
 * used. Auth is disabled only when NEITHER is configured (dev convenience), or
 * when `bootstrapAuth` is explicitly enabled for a local shared-memory setup.
 */
export async function resolveAuth(
  opts: { apiKeys?: string[]; keyStore?: ApiKeyStore; bootstrapAuth?: boolean },
  authHeader: string | undefined,
): Promise<AuthResult> {
  const keys = opts.apiKeys ?? []
  const token = bearerToken(authHeader)

  // A keyStore outage (or a schema that was never applied) must never brick
  // authentication for static `apiKeys` bearers: resolve failures degrade to
  // `undefined` and the static-key check below still runs.
  const resolveSafe = async (): Promise<Account | undefined> => {
    if (!opts.keyStore) return undefined
    try {
      return await opts.keyStore.resolve(token)
    } catch (err) {
      console.warn(
        `[shipyard-gateway] key store resolve failed; ${
          keys.length > 0 ? 'falling back to static api keys' : 'rejecting request'
        }: ${err instanceof Error ? err.message : String(err)}`,
      )
      return undefined
    }
  }

  if (opts.bootstrapAuth && keys.length === 0) {
    if (token) {
      const account = await resolveSafe()
      if (account) return { ok: true, account }
    }
    return { ok: true }
  }

  if (keys.length === 0 && !opts.keyStore) return { ok: true } // auth disabled (dev)
  if (!token) return { ok: false }
  const account = await resolveSafe()
  if (account) return { ok: true, account }
  if (keys.some((key) => safeEqual(key, token))) return { ok: true }
  return { ok: false }
}
