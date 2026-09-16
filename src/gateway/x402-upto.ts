// x402 `upto` billing for the gateway: metered pay-per-token inference in USDC
// on Solana, backed by the payment-channels program.
//
// Where `exact` (x402.ts) charges a flat price per request, `upto` authorizes a
// ceiling and settles the metered actual — the OpenRouter-style unit economics
// the gateway wants:
//
//   1. A keyless request gets a 402 whose requirement carries `scheme: 'upto'`,
//      the ceiling as `amount`, and a fresh `recentBlockhash`/`recentSlot` so
//      the client can build + sign the channel open without its own RPC hop.
//   2. The client retries with `X-PAYMENT`: a payload whose open transaction
//      escrows the ceiling on-chain (payment-channels PDA). The gateway
//      completes the fee-payer signature, broadcasts, and confirms — money is
//      escrowed BEFORE the model runs.
//   3. The gateway serves the request and meters tokens (upstream `usage`, or
//      an estimate when the proxy strips it).
//   4. The gateway voucher-signs the actual (never above the ceiling) and
//      settles on-chain: settle_and_seal + distribute — the payee is paid the
//      actual, the payer is refunded the rest. The settlement lands in the
//      `x-payment-response` header (non-streaming) or the final SSE trailer
//      (streaming).
//
// The on-chain channel lifecycle is delegated to `@x402/svm`'s `UptoSvmScheme`
// facilitator — the same engine pay.sh/pay-kit use — so the gateway stays a
// thin policy layer (pricing, metering, accounting) over a shared settlement
// core. The operator key configured for x402 holds all three server seats:
// fee payer (channel rent + settle tx fees), receiver authorizer (voucher
// signer), and payee (with `treasury` as the payTo recipient).

import { createHash, createPrivateKey, sign } from 'node:crypto'
import bs58 from 'bs58'
import { x402Facilitator } from '@x402/core/facilitator'
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from '@x402/core/http'
import type { Network, PaymentPayload, PaymentRequirements } from '@x402/core/types'
import { toFacilitatorSvmSigner } from '@x402/svm'
import { UptoSvmScheme } from '@x402/svm/upto/facilitator'
import { createKeyPairSignerFromBytes } from '@solana/kit'

import type { X402Config } from './x402.js'
import { usdcMintFor, rpcFor } from './x402.js'

// ── Constants (mirroring pay-kit's x402-upto engine) ────────────────────────

const X402_VERSION = 2
const MAX_TIMEOUT_SECONDS = 300
const DEFAULT_WITHDRAW_DELAY_SECONDS = 900
/** The payment-channels program's OPEN_SLOT_WINDOW: ~10 min at 400ms slots. */
const OPEN_SLOT_WINDOW = 1_500n
const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

/** CAIP-2 identifiers. Local test chains clone the mainnet genesis, so they
 *  advertise the mainnet id (the same mapping pay-kit uses). */
export function caip2For(network: 'mainnet' | 'devnet'): string {
  return network === 'devnet'
    ? 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
    : 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
}

// ── Voucher wire format ──────────────────────────────────────────────────────

/**
 * The Ed25519-signed voucher message: exactly 50 bytes —
 * `magic [0x56, 0x01] || channel_id (32) || cumulative_amount u64 LE ||
 * expires_at i64 LE` — the payment-channels program's canonical format.
 */
export function encodeVoucherMessageBytes(channelId: string, cumulativeAmount: bigint, expiresAt: bigint): Uint8Array {
  const message = new Uint8Array(50)
  message[0] = 0x56
  message[1] = 0x01
  const channel = bs58.decode(channelId)
  if (channel.length !== 32) throw new Error(`voucher: channelId must decode to 32 bytes, got ${channel.length}`)
  message.set(channel, 2)
  let c = cumulativeAmount
  for (let i = 0; i < 8; i++) {
    message[34 + i] = Number(c & 0xffn)
    c >>= 8n
  }
  let e = BigInt.asIntN(64, expiresAt)
  for (let i = 0; i < 8; i++) {
    message[42 + i] = Number(e & 0xffn)
    e >>= 8n
  }
  return message
}

// ── Engine ───────────────────────────────────────────────────────────────────

export interface UptoVerified {
  /** The authorized ceiling, atomic USDC. */
  readonly maxBaseUnits: bigint
  /** Payer wallet, for attribution. */
  readonly payer: string
  readonly payload: PaymentPayload
  readonly requirements: PaymentRequirements
}

export interface UptoSettlement {
  /** Settled amount, atomic USDC. */
  readonly amountBaseUnits: bigint
  /** On-chain settle signature. */
  readonly transaction: string
  /** The base64 `x-payment-response` value (settlement receipt). */
  readonly responseHeader: string
}

/**
 * Per-configuration engine: a facilitator wired to the operator signer.
 * Constructed lazily and cached per X402Config instance, so per-request calls
 * are cheap (the facilitator is stateless apart from its signer + RPC client).
 */
class UptoEngine {
  readonly facilitator: x402Facilitator
  readonly operatorAddress: string
  private readonly cfg: X402Config
  private readonly operatorSecret: Uint8Array

  private constructor(
    cfg: X402Config,
    operatorSecret: Uint8Array,
    operatorAddress: string,
    facilitator: x402Facilitator,
  ) {
    this.cfg = cfg
    this.operatorSecret = operatorSecret
    this.operatorAddress = operatorAddress
    this.facilitator = facilitator
  }

  static async create(cfg: X402Config, operatorSecret: Uint8Array): Promise<UptoEngine> {
    const kitSigner = await createKeyPairSignerFromBytes(operatorSecret)
    const rpcConfig = { defaultRpcUrl: rpcFor(cfg) }
    const scheme = new UptoSvmScheme(toFacilitatorSvmSigner(kitSigner, rpcConfig), { rpcUrl: rpcFor(cfg) } as never)
    const facilitator = new x402Facilitator().register(caip2For(cfg.network) as Network, scheme)
    return new UptoEngine(cfg, operatorSecret, kitSigner.address, facilitator)
  }

  // RPC over plain fetch (same transport as x402.ts — no web3.js).
  async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const fetchImpl = this.cfg.fetch ?? fetch
    const res = await fetchImpl(rpcFor(this.cfg), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (!res.ok) throw new Error(`solana rpc ${method}: ${res.status}`)
    const body = (await res.json()) as { result?: T; error?: { message?: string } }
    if (body.error) throw new Error(`solana rpc ${method}: ${body.error.message ?? 'error'}`)
    return body.result as T
  }

  /** One `getLatestBlockhash`: returns the blockhash + the context slot. */
  async recentBlockhash(): Promise<{ blockhash: string; slot: string; lastValidBlockHeight: string }> {
    const r = await this.rpc<{ context: { slot: number }; value: { blockhash: string; lastValidBlockHeight: number } }>(
      'getLatestBlockhash',
      [],
    )
    return {
      blockhash: r.value.blockhash,
      slot: String(r.context.slot),
      lastValidBlockHeight: String(r.value.lastValidBlockHeight),
    }
  }

  /** The route's pinned requirements; `recent*` binds the client's channel open. */
  requirements(maxBaseUnits: string, recent?: { blockhash: string; slot: string; lastValidBlockHeight: string }): PaymentRequirements {
    const base: PaymentRequirements = {
      scheme: 'upto',
      network: caip2For(this.cfg.network) as Network,
      asset: usdcMintFor(this.cfg),
      amount: maxBaseUnits,
      payTo: this.cfg.treasury,
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      extra: {
        feePayer: this.operatorAddress,
        receiverAuthorizer: this.operatorAddress,
        tokenProgram: SPL_TOKEN_PROGRAM,
        withdrawDelay: DEFAULT_WITHDRAW_DELAY_SECONDS,
        ...(recent
          ? { recentBlockhash: recent.blockhash, recentSlot: recent.slot, lastValidBlockHeight: recent.lastValidBlockHeight }
          : {}),
      },
    }
    return base
  }

  /** Sign a voucher (Ed25519 over the 50-byte canonical message) — node:crypto
   *  over the operator secret (seed = first 32 bytes of the 64-byte keypair). */
  async signVoucher(channelId: string, cumulativeAmount: bigint, expiresAt: bigint): Promise<string> {
    const message = encodeVoucherMessageBytes(channelId, cumulativeAmount, expiresAt)
    const signature = ed25519Sign(this.operatorSecret, message)
    return bs58.encode(signature)
  }
}

const engines = new WeakMap<X402Config, Promise<UptoEngine>>()

/**
 * Ed25519-sign `message` with a Solana keypair's 64-byte secret (seed ‖ public)
 * using node:crypto — no nacl/kit signer dependency. PKCS#8-wraps the seed.
 */
function ed25519Sign(secret64: Uint8Array, message: Uint8Array): Uint8Array {
  if (secret64.length !== 64) throw new Error(`ed25519Sign: expected 64-byte secret, got ${secret64.length}`)
  // PKCS#8 Ed25519 prefix + the 32-byte seed
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(secret64.subarray(0, 32))])
  const keyObject = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
  return new Uint8Array(sign(null, Buffer.from(message), keyObject))
}

function engineFor(cfg: X402Config): Promise<UptoEngine> {
  let engine = engines.get(cfg)
  if (!engine) {
    if (!cfg.operatorSecret) return Promise.reject(new Error('x402 upto: operatorSecret not configured'))
    engine = UptoEngine.create(cfg, cfg.operatorSecret)
    engines.set(cfg, engine)
  }
  return engine
}

// ── Challenge ────────────────────────────────────────────────────────────────

export interface UptoChallengeResult {
  /** The 402 JSON body (`accepts[]`) — same shape as the exact scheme. */
  readonly body: { accepts: PaymentRequirements[] }
  /** The `payment-required` response header x402 v2 clients read. */
  readonly paymentRequiredHeader: string
}

/** Build the metered 402: ceiling in `amount`, fresh blockhash for the open. */
export async function buildUptoChallenge(
  cfg: X402Config,
  resource: string,
  ceilingBaseUnits: bigint,
): Promise<UptoChallengeResult> {
  const engine = await engineFor(cfg)
  const recent = await engine.recentBlockhash()
  const requirements = engine.requirements(ceilingBaseUnits.toString(), recent)
  const paymentRequired = {
    accepts: [requirements],
    // x402 v2 requires an exact match with the response's absolute URL.
    resource: { url: resource },
    x402Version: X402_VERSION,
  }
  return {
    body: { accepts: [requirements] },
    paymentRequiredHeader: encodePaymentRequiredHeader(paymentRequired),
  }
}

// ── Verify (escrow the ceiling before serving) ───────────────────────────────

/**
 * Verify an `X-PAYMENT` upto payload and broadcast the channel open — the
 * ceiling is escrowed on-chain before the caller serves anything. Mirrors
 * pay-kit's `X402Upto.verifyOpen`, including the openSlot freshness window.
 */
export async function verifyUptoOpen(cfg: X402Config, paymentHeader: string, ceilingBaseUnits: bigint): Promise<UptoVerified> {
  const engine = await engineFor(cfg)
  let payload: PaymentPayload
  try {
    payload = decodePaymentSignatureHeader(paymentHeader)
  } catch (err) {
    throw new Error(`X-PAYMENT is not a valid x402 signature header: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Bind the open's openSlot to a freshly observed slot (same window rule the
  // program enforces): reject opens minted against stale challenges.
  const recent = await engine.recentBlockhash().catch(() => undefined)
  if (recent) {
    const raw = payload.payload as { openSlot?: unknown } | undefined
    const openSlot = typeof raw?.openSlot === 'string' && /^\d+$/.test(raw.openSlot) ? BigInt(raw.openSlot) : undefined
    if (openSlot === undefined) throw new Error('upto payload.openSlot must be a u64 decimal string')
    const recentSlot = BigInt(recent.slot)
    if (openSlot > recentSlot) throw new Error('upto openSlot is ahead of the current slot')
    if (recentSlot - openSlot > OPEN_SLOT_WINDOW) throw new Error('upto openSlot is outside the freshness window')
  }

  const requirements = engine.requirements(ceilingBaseUnits.toString(), recent)
  // Deposit path: no voucherSignature + amount === payload.maxAmount → the
  // facilitator completes the fee-payer signature, broadcasts + confirms the
  // channel open (escrowing the ceiling) before this resolves.
  const settled = await engine.facilitator.settle(payload, requirements)
  if (!settled.success) {
    throw new Error(`upto open failed: ${settled.errorReason ?? 'invalid'} ${settled.errorMessage ?? ''}`.trim())
  }
  return {
    maxBaseUnits: ceilingBaseUnits,
    payer: settled.payer ?? '',
    payload,
    requirements,
  }
}

// ── Settle (metered actual, refund the rest) ─────────────────────────────────

/** Settle the metered amount against a verified open; refund the remainder. */
export async function settleUpto(cfg: X402Config, verified: UptoVerified, actualBaseUnits: bigint): Promise<UptoSettlement> {
  const engine = await engineFor(cfg)
  const actual = actualBaseUnits < 0n ? 0n : actualBaseUnits > verified.maxBaseUnits ? verified.maxBaseUnits : actualBaseUnits

  const raw = verified.payload.payload as { channelId?: unknown; from?: unknown; expiresAt?: unknown } | undefined
  if (!raw || typeof raw.channelId !== 'string' || typeof raw.from !== 'string' || typeof raw.expiresAt !== 'number') {
    throw new Error('upto payload missing channelId/from/expiresAt')
  }

  // The voucher signature routes the facilitator to the claim path — always
  // signed, even for a zero-amount refund.
  const voucherSignature = await engine.signVoucher(raw.channelId, actual, BigInt(raw.expiresAt))
  const claimPayload: PaymentPayload = {
    ...verified.payload,
    payload: { ...verified.payload.payload, voucherSignature },
  }
  const claimRequirements: PaymentRequirements = { ...verified.requirements, amount: actual.toString() }

  const settled = await engine.facilitator.settle(claimPayload, claimRequirements)
  if (!settled.success) {
    throw new Error(`upto settle failed: ${settled.errorReason ?? 'failed'} ${settled.errorMessage ?? ''}`.trim())
  }
  const settlement = {
    amount: actual.toString(),
    network: verified.requirements.network,
    payer: settled.payer ?? raw.from,
    success: true,
    transaction: settled.transaction ?? '',
  }
  return {
    amountBaseUnits: actual,
    transaction: settlement.transaction,
    responseHeader: encodePaymentResponseHeader(settlement),
  }
}

/** Atomic USDC per token for a per-token price; whole-USDC → 6-decimal atomic. */
export function perTokenAtomic(perTokenUsdc: number): bigint {
  return BigInt(Math.round(perTokenUsdc * 1_000_000))
}

/** Whole-USDC ceiling → atomic. */
export function ceilingAtomic(ceilingUsdc: number): bigint {
  return BigInt(Math.round(ceilingUsdc * 1_000_000))
}
