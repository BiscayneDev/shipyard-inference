import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign as edSign,
  verify as edVerify,
} from 'node:crypto'
import type { UsageAttestation } from './types.js'
import { TENDER_DEFAULTS } from './types.js'

// Proof-of-impression. The gateway signs, per completed request, that a real,
// billed inference request produced an impression — and that signed attestation
// is the unit settlement releases against (section 8). The key is DEDICATED to
// Tender (not a Solana payer key), an Ed25519 keypair via node:crypto.

// RFC 8410 DER envelopes so we can carry a bare 32-byte seed / raw public key
// through node:crypto (the same pattern as src/payment/keypair-signer.ts).
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

function toBuf(hex: string): Buffer {
  return Buffer.from(hex.trim().replace(/^0x/, ''), 'hex')
}

/** A loaded Tender attestation key: signs digests, publishes its public half. */
export interface TenderAttestationKey {
  /** Sign a message, returning the raw 64-byte Ed25519 signature. */
  sign(message: Uint8Array): Uint8Array
  /** 32-byte raw Ed25519 public key. */
  publicKeyRaw: Uint8Array
  /** Hex of the raw public key — distribute this so anyone can verify. */
  publicKeyHex: string
  /** True when the key was minted ephemerally (no seed configured). */
  ephemeral: boolean
}

function keyFromSeed(seed: Uint8Array, ephemeral: boolean): TenderAttestationKey {
  if (seed.length !== 32) {
    throw new Error('[tender] attestation seed must be 32 bytes')
  }
  const priv = createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(seed)]),
    format: 'der',
    type: 'pkcs8',
  })
  const jwk = createPublicKey(priv).export({ format: 'jwk' }) as { x: string }
  const publicKeyRaw = new Uint8Array(Buffer.from(jwk.x, 'base64url'))
  return {
    sign: (message) => new Uint8Array(edSign(null, Buffer.from(message), priv)),
    publicKeyRaw,
    publicKeyHex: Buffer.from(publicKeyRaw).toString('hex'),
    ephemeral,
  }
}

/** A fresh 32-byte seed, hex — store as `TENDER_SIGNING_KEY` for a stable key. */
export function generateAttestationSeedHex(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Load the Tender attestation key. Reads a 32-byte hex seed from `seedHex` or
 * `TENDER_SIGNING_KEY`; with neither, mints an EPHEMERAL key (fine for dev — but
 * attestations won't verify across restarts; set `TENDER_SIGNING_KEY` in prod).
 */
export function loadAttestationKey(opts: { seedHex?: string } = {}): TenderAttestationKey {
  const src = opts.seedHex ?? process.env.TENDER_SIGNING_KEY
  if (src) return keyFromSeed(new Uint8Array(toBuf(src)), false)
  return keyFromSeed(new Uint8Array(randomBytes(32)), true)
}

/**
 * Canonical digest of the signed fields (everything except `sig`), in a FIXED
 * field order so signer and verifier agree byte-for-byte.
 */
export function attestationDigest(att: Omit<UsageAttestation, 'sig'>): Uint8Array {
  const canonical = JSON.stringify({
    requestId: att.requestId,
    model: att.model,
    billedCostUsd: att.billedCostUsd,
    measuredWaitMs: att.measuredWaitMs,
    surfaceId: att.surfaceId,
    userWallet: att.userWallet,
    placementId: att.placementId,
    issuedAt: att.issuedAt,
  })
  return new TextEncoder().encode(canonical)
}

/** Sign an unsigned attestation, returning it with `sig` (hex) attached. */
export function signAttestation(
  unsigned: Omit<UsageAttestation, 'sig'>,
  key: TenderAttestationKey,
): UsageAttestation {
  const sig = Buffer.from(key.sign(attestationDigest(unsigned))).toString('hex')
  return { ...unsigned, sig }
}

/** Verify an attestation's signature against a public key (hex of raw 32 bytes). */
export function verifyAttestation(att: UsageAttestation, publicKeyHex: string): boolean {
  try {
    const pub = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, toBuf(publicKeyHex)]),
      format: 'der',
      type: 'spki',
    })
    const { sig, ...unsigned } = att
    return edVerify(null, Buffer.from(attestationDigest(unsigned)), pub, toBuf(sig))
  } catch {
    return false
  }
}

export interface AttestationGateOptions {
  /** Public key (hex) the signature must verify against. */
  publicKeyHex: string
  /** Minimum measured wait to qualify (default `MIN_WAIT_MS`). */
  minWaitMs?: number
  /** Cross-check the auction log: was THIS placement served for THIS request? */
  wasServed?: (requestId: string, placementId: string) => boolean
}

export interface GateResult {
  ok: boolean
  reason?: string
}

/**
 * The release gate. Settlement releases against an attestation ONLY when:
 *  - the signature verifies against the gateway key,
 *  - `billedCostUsd > 0` — no real inference, no payout (the single strongest
 *    anti-fraud bind: you can't farm impressions without paying for real
 *    inference, which costs more than the kickback),
 *  - `measuredWaitMs >= MIN_WAIT_MS`,
 *  - the placement was actually served for this request (auction-log cross-check).
 * Per-wallet rate/anomaly checks layer on at settlement time (step 4).
 */
export function assertValidAttestation(
  att: UsageAttestation,
  opts: AttestationGateOptions,
): GateResult {
  if (!verifyAttestation(att, opts.publicKeyHex)) return { ok: false, reason: 'bad signature' }
  if (!(att.billedCostUsd > 0)) {
    return { ok: false, reason: 'no real inference (billedCostUsd must be > 0)' }
  }
  const minWait = opts.minWaitMs ?? TENDER_DEFAULTS.MIN_WAIT_MS
  if (!(att.measuredWaitMs >= minWait)) {
    return { ok: false, reason: `wait ${att.measuredWaitMs}ms < MIN_WAIT_MS ${minWait}ms` }
  }
  if (opts.wasServed && !opts.wasServed(att.requestId, att.placementId)) {
    return { ok: false, reason: 'placement was not served for this request' }
  }
  return { ok: true }
}
