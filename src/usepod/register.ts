const DEFAULT_API = 'https://api.usepod.ai'

export interface UsePodAccount {
  /** The per-account token (UUID) used in the proxy URL and balance calls. */
  token: string
  /** 16-hex / 8-byte code that binds an on-chain USDC deposit to this token. */
  depositCode: string
}

/**
 * Register a fresh UsePod account: `POST /v1/register` (no auth) returns a token
 * and a deposit code. Fund the token's balance with `depositUsdc()` (on-chain)
 * or the dashboard, then call inference via `createUsePodProvider({ token })`.
 */
export async function registerUsePod(
  options: { baseURL?: string; fetch?: typeof fetch } = {},
): Promise<UsePodAccount> {
  const base = (options.baseURL ?? DEFAULT_API).replace(/\/+$/, '')
  const f = options.fetch ?? globalThis.fetch
  const res = await f(`${base}/v1/register`, { method: 'POST' })
  if (!res.ok) {
    throw new Error(`[shipyard-inference] UsePod register failed: ${res.status}`)
  }
  // The live API returns the token as `api_token`; accept `token` too in case the
  // surface ever shortens it. Same for the deposit code (`deposit_code`).
  const body = (await res.json()) as {
    api_token?: string
    token?: string
    deposit_code?: string
  }
  const token = body.api_token ?? body.token
  if (!token || !body.deposit_code) {
    throw new Error('[shipyard-inference] UsePod register returned no token/deposit_code')
  }
  return { token, depositCode: body.deposit_code }
}
