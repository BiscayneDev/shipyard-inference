/**
 * One-call x402 top-up (agent self-funding).
 *
 * A wallet-bound key posts `{ amountUsd }`; the gateway answers with a
 * standard x402 `exact`-scheme 402 challenge priced at exactly `amountUsd`.
 * The client settles by signing a USDC transfer (any x402 client — Paybox,
 * `createPayingFetch`); on verified + confirmed settlement the gateway credits
 * the key's balance `amountUsd` through the SAME CreditStore the tender
 * kickbacks accrue to, and returns `{ balanceUsd }`.
 *
 * Money safety reuses the existing machinery unchanged: `verifyX402Payment`
 * submits the signed transaction itself, confirms it, checks the treasury's
 * balance delta, and marks the payment consumed — one payment credits once.
 *
 * Eligibility: only keys issued against a wallet (`account.wallet` set) may
 * top up — the balance must bind to a stable identity, not to a throwaway
 * static bearer. Keyless requests are 401: a payment proves control of USDC
 * but does not identify which balance to credit.
 */
import type { Context } from 'hono'
import type { GatewayConfig } from './config.js'
import type { Account } from './keys.js'
import { buildChallenge, verifyX402Payment, type X402Config } from './x402.js'
import { MemoryCreditStore, type CreditStore } from '../tender/credit-store.js'

export const MIN_TOPUP_USD = 0.01
export const MAX_TOPUP_USD = 1000

/** Clear error for keys with no wallet binding. */
export const WALLET_KEY_REQUIRED =
  'top-up requires a wallet-issued key (prove wallet control via POST /v1/keys/wallet)'

export interface TopupResult {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

/**
 * Resolve the credit store backing top-up balances: the first-class
 * `config.creditStore` (the same instance the tender kickbacks accrue into),
 * else a fresh in-memory store.
 */
export function creditsOf(config: GatewayConfig): CreditStore {
  return config.creditStore ?? new MemoryCreditStore()
}

/** x402 config priced for THIS top-up: the challenge amount is the request's `amountUsd`. */
function priced(x402: X402Config, amountUsd: number): X402Config {
  return { ...x402, priceUsdc: amountUsd }
}

function parseAmount(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  return raw
}

/**
 * Handle a `POST /v1/topup` request. Framework-free (`{ status, body }` like
 * the dev-keys handlers) so the route wiring in server.ts stays thin.
 *
 * `account` is the authenticated caller's account (undefined when the bearer
 * did not resolve). `paymentHeader` is `X-PAYMENT` / `PAYMENT-SIGNATURE` when
 * the client settled the challenge.
 */
export async function handleTopup(
  opts: { x402: X402Config; credits: CreditStore },
  account: Account | undefined,
  rawBody: unknown,
  paymentHeader: string | undefined,
  requestId = `topup_${Date.now()}`,
): Promise<TopupResult> {
  if (!account) {
    return {
      status: 401,
      body: { error: 'Invalid API key', code: 'authentication_error' },
    }
  }
  if (!account.wallet) {
    return {
      status: 403,
      body: { error: WALLET_KEY_REQUIRED, code: 'wallet_key_required' },
    }
  }

  const body = (rawBody ?? {}) as { amountUsd?: unknown }
  const amountUsd = parseAmount(body.amountUsd)
  if (
    amountUsd === undefined ||
    amountUsd < MIN_TOPUP_USD ||
    amountUsd > MAX_TOPUP_USD
  ) {
    return {
      status: 400,
      body: {
        error: `\`amountUsd\` must be a number between ${MIN_TOPUP_USD} and ${MAX_TOPUP_USD}`,
        code: 'invalid_amount',
        minUsd: MIN_TOPUP_USD,
        maxUsd: MAX_TOPUP_USD,
      },
    }
  }

  // Balance identity: the key's stable userId (the same identity the tender
  // kickback ledger credits), wallet recorded for the audit trail.
  const balanceAccount = account.userId

  if (!paymentHeader) {
    const challenge = buildChallenge(priced(opts.x402, amountUsd), '/v1/topup')
    return {
      status: 402,
      body: { ...challenge, amountUsd, balanceAccount },
      headers: { 'x-402-challenge': 'solana-usdc' },
    }
  }

  const verified = await verifyX402Payment(priced(opts.x402, amountUsd), paymentHeader)
  if (!verified.ok) {
    const challenge = buildChallenge(priced(opts.x402, amountUsd), '/v1/topup')
    return {
      status: 402,
      body: { ...challenge, error: verified.error },
      headers: { 'x-402-error': String(verified.error) },
    }
  }

  // Verified + settled: credit the balance through the shared credit store.
  // A failed accrue after a settled payment surfaces as a 500 — the payment
  // is real, the caller should retry (the consumed-payment guard will reject
  // the replay and the operator can reconcile from the payment hook).
  await opts.credits.accrue({
    account: balanceAccount,
    amountUsd: amountUsd,
    placementId: 'topup',
    line: `top-up ${amountUsd} USDC (tx ${verified.signature ?? 'unknown'}, payer ${verified.payer ?? 'unknown'})`,
    requestId,
    at: Date.now(),
  })
  const balanceUsd = await opts.credits.balance(balanceAccount)
  return {
    status: 200,
    body: { balanceUsd, creditedUsd: amountUsd, wallet: account.wallet },
  }
}

/** Hono handler for `POST /v1/topup` (route wiring in server.ts). */
export function topupRoute(config: GatewayConfig) {
  const credits = creditsOf(config)
  return async (c: Context): Promise<Response> => {
    const auth = await resolveAuthForTopup(config, c)
    const payment = c.req.header('payment-signature') ?? c.req.header('x-payment')
    let rawBody: unknown
    try {
      rawBody = await c.req.json()
    } catch {
      rawBody = {}
    }
    const result = await handleTopup(
      { x402: config.x402!, credits },
      auth,
      rawBody,
      payment,
    )
    return Response.json(result.body, { status: result.status, headers: result.headers })
  }
}

async function resolveAuthForTopup(config: GatewayConfig, c: Context): Promise<Account | undefined> {
  const header = c.req.header('authorization')
  if (!config.keyStore || !header) return undefined
  try {
    return await config.keyStore.resolve(header.replace(/^Bearer\s+/i, ''))
  } catch {
    return undefined
  }
}
