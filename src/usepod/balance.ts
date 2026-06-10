const DEFAULT_API = 'https://api.usepod.ai'

export interface UsePodBalance {
  /** Balance in USDC microunits (1 USDC = 1,000,000). */
  usdcMicros: number
  /** Balance in USDC. */
  usdc: number
}

/**
 * Read a UsePod token's remaining USDC balance via `GET /proxy/<token>/balance`.
 * (Every proxied inference response also carries an `X-Balance-Remaining` header.)
 */
export async function usePodBalance(
  token: string,
  options: { baseURL?: string; fetch?: typeof fetch } = {},
): Promise<UsePodBalance> {
  const base = (options.baseURL ?? DEFAULT_API).replace(/\/+$/, '')
  const f = options.fetch ?? globalThis.fetch
  const res = await f(`${base}/proxy/${token}/balance`)
  if (!res.ok) {
    throw new Error(`[shipyard-inference] UsePod balance failed: ${res.status}`)
  }
  const body = (await res.json()) as { usdc_balance?: number | string }
  const usdcMicros = Number(body.usdc_balance ?? 0)
  return { usdcMicros, usdc: usdcMicros / 1_000_000 }
}
