// x402 charging for the gateway: pay-per-call inference in USDC on Solana.
//
// When a request arrives without valid auth and x402 is configured, the
// gateway answers 402 with a payment requirement (the standard `accepts` shape
// `createPayingFetch` parses). The client — any wallet, Paybox included —
// settles by signing a USDC transfer to the treasury and retrying with the
// `X-PAYMENT` header (base64 `{x402Version, network, payload: {transaction}}`,
// the wire shape `createSolanaPayProvider` emits). The gateway then:
//
//   1. submits the signed transaction on-chain via plain RPC (no web3.js),
//   2. waits for confirmation,
//   3. checks the treasury's USDC balance delta actually covers the price
//      (the same robustness rule as `verifyDeposit`: balance deltas, not
//      instruction parsing), and
//   4. marks the transaction consumed so one payment serves one request.
//
// Money safety: every served request requires a freshly signed transfer that
// the gateway itself submits — the signed bytes are the money. Consumed
// signatures are tracked in-memory per instance (serverless cold starts and
// multi-instance replays are a documented v1 limitation; the upgrade path is a
// Supabase receipts table).

import { randomBytes, createHash } from 'node:crypto'
import bs58 from 'bs58'

// ── Config ───────────────────────────────────────────────────────────────────

const USDC_MINT = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const

const DEFAULT_RPC = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
} as const

export interface X402Config {
  /** Treasury address that receives the payer's USDC. */
  treasury: string
  /** Solana cluster the payment settles on. */
  network: 'mainnet' | 'devnet'
  /** Price per request, whole USDC (e.g. 0.001). */
  priceUsdc: number
  rpcUrl?: string
  usdcMint?: string
  /** Underlying RPC transport override (tests). */
  fetch?: typeof fetch
  /** How long to poll for confirmation before giving up. Default 45s. */
  confirmTimeoutMs?: number
}

/**
 * Build an {@link X402Config} from the environment, or undefined when charging
 * is off. Requires a treasury (`SHIPYARD_X402_TREASURY_WALLET`, falling back to
 * `TENDER_TREASURY_WALLET` so one treasury serves both surfaces) and a positive
 * `SHIPYARD_X402_PRICE_USDC`. Network follows `SHIPYARD_SETTLE_NETWORK`.
 */
export function x402Config(env: Record<string, string | undefined> = process.env): X402Config | undefined {
  const treasury = (env.SHIPYARD_X402_TREASURY_WALLET ?? env.TENDER_TREASURY_WALLET)?.trim()
  const price = Number(env.SHIPYARD_X402_PRICE_USDC)
  if (!treasury || !Number.isFinite(price) || price <= 0) return undefined
  return {
    treasury,
    network: env.SHIPYARD_SETTLE_NETWORK === 'mainnet' ? 'mainnet' : 'devnet',
    priceUsdc: price,
    rpcUrl: env.SHIPYARD_SETTLE_RPC_URL?.trim() || undefined,
    usdcMint: env.SHIPYARD_SETTLE_USDC_MINT?.trim() || undefined,
  }
}

const usdcMintFor = (cfg: X402Config): string => cfg.usdcMint ?? USDC_MINT[cfg.network]
const rpcFor = (cfg: X402Config): string => cfg.rpcUrl ?? DEFAULT_RPC[cfg.network]
/** Atomic USDC (6 decimals) for a whole-USDC price. */
const atomicFor = (cfg: X402Config): string => String(Math.round(cfg.priceUsdc * 1_000_000))

// ── Challenge ────────────────────────────────────────────────────────────────

export interface X402Challenge {
  accepts: Array<Record<string, unknown>>
}

/** One-time requirement JSON for a 402 response body. */
export function buildChallenge(cfg: X402Config, resource: string): X402Challenge {
  const amount = atomicFor(cfg)
  return {
    accepts: [
      {
        scheme: 'exact',
        network: `solana-${cfg.network === 'mainnet' ? 'mainnet' : 'devnet'}`,
        asset: usdcMintFor(cfg),
        amount,
        maxAmountRequired: amount,
        payTo: cfg.treasury,
        resource,
        nonce: bs58.encode(randomBytes(16)),
        expiresAt: Date.now() + 10 * 60_000,
        description: 'Shipyard inference — per-request USDC',
      },
    ],
  }
}

// ── Settlement verification ──────────────────────────────────────────────────

export interface X402VerifyResult {
  ok: boolean
  error?: string
  /** Payer wallet (owner of the funding token account), for attribution. */
  payer?: string
  /** Confirmed on-chain signature. */
  signature?: string
  /** Whole USDC actually collected. */
  amountUsdc?: number
}

interface RpcTokenBalance {
  owner?: string
  mint: string
  uiTokenAmount: { uiAmount: number | null }
}

async function rpc<T>(cfg: X402Config, method: string, params: unknown[]): Promise<T> {
  const fetchImpl = cfg.fetch ?? fetch
  const res = await fetchImpl(rpcFor(cfg), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`solana rpc ${method}: ${res.status}`)
  const body = (await res.json()) as { result?: T; error?: { message?: string } }
  if (body.error) throw new Error(`solana rpc ${method}: ${body.error.message ?? 'error'}`)
  return body.result as T
}

// Consumed payments: tx-hash -> verified at (ms). Instance-local, TTL-pruned.
const consumed = new Map<string, number>()
const CONSUMED_TTL_MS = 60 * 60_000

function pruneConsumed(): void {
  const now = Date.now()
  for (const [k, at] of consumed) {
    if (now - at > CONSUMED_TTL_MS) consumed.delete(k)
  }
}

/** Decode + submit + confirm + credit-check an `X-PAYMENT` proof header. */
export async function verifyX402Payment(cfg: X402Config, paymentHeader: string): Promise<X402VerifyResult> {
  // Decode the wire payload `createSolanaPayProvider`'s default encoder emits.
  let payload: { payload?: { transaction?: string }; network?: string }
  try {
    payload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8')) as typeof payload
  } catch {
    return { ok: false, error: 'X-PAYMENT is not valid base64 JSON' }
  }
  const txBase64 = payload.payload?.transaction
  if (typeof txBase64 !== 'string' || !txBase64) {
    return { ok: false, error: 'X-PAYMENT contained no signed transaction' }
  }

  const txHash = createHash('sha256').update(txBase64).digest('hex')
  pruneConsumed()
  if (consumed.has(txHash)) {
    return { ok: false, error: 'payment already consumed for a previous request' }
  }

  // Submit on-chain. A client-retry of a header we already submitted fails
  // here — that's the natural replay guard — and is handled below by checking
  // whether the on-chain credit exists for THIS tx hash before rejecting.
  // skipPreflight: the transaction is already signed and fee-prefunded by the
  // client; simulation only adds latency and false negatives (e.g. a blockhash
  // aging out during simulation on fast local chains).
  let signature: string
  try {
    signature = await rpc<string>(cfg, 'sendTransaction', [
      txBase64,
      { encoding: 'base64', skipPreflight: true },
    ])
  } catch (err) {
    // A re-delivery of a proof we already submitted lands here — the client
    // can't resubmit the same bytes either (idempotent at the node). Surface
    // the real cause; the 402 retry loop's fresh nonce handles recovery.
    return {
      ok: false,
      error: `submitting payment transaction failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Wait for confirmation. getSignatureStatuses' result is `{context, value}` —
  // the statuses array lives under `value`.
  const deadline = Date.now() + (cfg.confirmTimeoutMs ?? 45_000)
  let confirmed = false
  while (Date.now() < deadline) {
    const result = await rpc<{ value?: Array<{ confirmationStatus?: string; err: unknown } | null> }>(
      cfg,
      'getSignatureStatuses',
      [[signature], { searchTransactionHistory: true }],
    ).catch(() => ({ value: [] as Array<{ confirmationStatus?: string; err: unknown } | null> }))
    const status = result?.value?.[0]
    if (status?.err) return { ok: false, error: 'payment transaction failed on-chain' }
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      confirmed = true
      break
    }
    await new Promise((r) => setTimeout(r, 1_500))
  }
  if (!confirmed) return { ok: false, error: 'payment transaction not confirmed in time' }

  // Credit check: treasury's USDC balance delta covers the price. Balance
  // deltas (not instruction parsing) so transfer/transferChecked both pass.
  const mint = usdcMintFor(cfg)
  const tx = await rpc<{ meta?: { err?: unknown; preTokenBalances?: RpcTokenBalance[]; postTokenBalances?: RpcTokenBalance[] } | null } | null>(
    cfg,
    'getTransaction',
    [signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' }],
  ).catch(() => null)
  if (!tx || tx.meta?.err) return { ok: false, error: 'payment transaction not found on-chain' }

  const owned = (b: RpcTokenBalance): boolean => b.owner === cfg.treasury && b.mint === mint
  const sum = (balances: RpcTokenBalance[] | undefined): number =>
    (balances ?? []).filter(owned).reduce((acc, b) => acc + (b.uiTokenAmount.uiAmount ?? 0), 0)
  const delta = sum(tx.meta?.postTokenBalances) - sum(tx.meta?.preTokenBalances)

  const price = cfg.priceUsdc
  if (!(delta + 1e-6 >= price)) {
    return { ok: false, error: `payment credited ${delta} USDC to treasury, expected >= ${price}` }
  }

  // Payer = owner of the funding (pre) token account that isn't the treasury.
  const payer =
    tx.meta?.preTokenBalances?.find((b) => b.owner && b.owner !== cfg.treasury && b.mint === mint)?.owner ??
    undefined

  consumed.set(txHash, Date.now())
  return { ok: true, payer, signature, amountUsdc: delta }
}
