/**
 * Wallet-signed API key issuance.
 *
 * An agent proves control of a Solana wallet by signing a deterministic
 * challenge (pubkey + nonce + domain) with its Ed25519 key; the gateway
 * verifies the signature and mints a NORMAL gateway API key through the same
 * key store every other issuer uses, bound to the wallet via `account.wallet`.
 * No website, no checkout — the signature IS the auth.
 *
 * Challenge/response design notes:
 *  - The domain string (SHIPYARD_WALLET_KEY_DOMAIN, default
 *    'shipyard-inference') is embedded so a signature produced for another
 *    service can't be replayed here.
 *  - Nonces are one-shot per pubkey via {@link MemoryNonceRegistry}: a stolen
 *    challenge+signature pair can't mint a second key.
 *  - The key itself is still a regular `sk-shipyard-…` key — nothing about the
 *    downstream auth path changes.
 */
import { createPublicKey, verify } from 'node:crypto'
import bs58 from 'bs58'
import type { Account, ApiKeyIssueInput, ApiKeyStore, IssuedKey } from './keys.js'
import { newKeyUserId } from './keys.js'

/** Domain separator embedded in every challenge. Env-overridable for tests/staging. */
export const WALLET_KEY_DOMAIN =
  (process.env.SHIPYARD_WALLET_KEY_DOMAIN ?? '').trim() || 'shipyard-inference'

/** Stable prefix so clients can recognize the message they must sign. */
export const WALLET_KEY_CHALLENGE_PREFIX = 'shipyard-wallet-key-challenge:v1'

/**
 * The message an agent must sign: domain + pubkey + nonce, newline-joined.
 * Deterministic — the same (pubkey, nonce) always produces the same message,
 * so the gateway can rebuild it from the request body alone.
 */
export function challengeForWallet(pubkey: string, nonce: string, domain: string = WALLET_KEY_DOMAIN): string {
  return [WALLET_KEY_CHALLENGE_PREFIX, domain, pubkey, nonce].join('\n')
}

// ── Nonce replay protection ──────────────────────────────────────────────────

export interface NonceRegistry {
  /** Atomically record `nonce` for `owner`. False when already claimed+fresh. */
  claim(owner: string, nonce: string): boolean
}

/** In-memory one-shot nonce registry with TTL prune (per process instance). */
export class MemoryNonceRegistry implements NonceRegistry {
  private readonly seen = new Map<string, number>()
  private readonly ttlMs: number
  private readonly now: () => number

  constructor(opts: { ttlMs?: number; now?: () => number } = {}) {
    this.ttlMs = opts.ttlMs ?? 10 * 60_000
    this.now = opts.now ?? Date.now
  }

  claim(owner: string, nonce: string): boolean {
    const now = this.now()
    for (const [k, at] of this.seen) if (now - at > this.ttlMs) this.seen.delete(k)
    const key = `${owner}#${nonce}`
    if (this.seen.has(key)) return false
    this.seen.set(key, now)
    return true
  }
}

// ── Signature verification ───────────────────────────────────────────────────

export interface WalletSignatureInput {
  /** Base58 Solana pubkey (32 bytes when decoded). */
  pubkey: string
  nonce: string
  /** Base58 Ed25519 signature over the challenge (64 bytes when decoded). */
  signatureB58: string
}

/**
 * Verify a wallet's Ed25519 signature over `expectedMessage`.
 * Base58-decodes the 64-byte signature, builds the public key from the raw
 * 32-byte pubkey by prefixing the SPKI header
 * `302a300506032b6570032100`, and verifies with node:crypto.
 * Never throws — every malformed input is `false`.
 */
export function verifyWalletSignature(input: WalletSignatureInput, expectedMessage: string): boolean {
  let sig: Buffer
  let pub: Buffer
  try {
    sig = Buffer.from(bs58.decode(input.signatureB58))
    pub = Buffer.from(bs58.decode(input.pubkey))
  } catch {
    return false
  }
  if (sig.length !== 64) return false
  if (pub.length !== 32) return false
  try {
    // Ed25519 keys are raw 32 bytes inside a fixed SPKI wrapper.
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub])
    const key = createPublicKey({ key: spki, format: 'der', type: 'spki' })
    return verify(null, Buffer.from(expectedMessage, 'utf8'), key, sig)
  } catch {
    return false
  }
}

// ── Issuer ───────────────────────────────────────────────────────────────────

export interface WalletKeyIssuer {
  /**
   * Verify the wallet signature over the rebuilt challenge and mint a key
   * bound to the wallet. Rejects with a descriptive Error on a bad signature,
   * a malformed pubkey, or a replayed nonce.
   */
  issue(input: WalletSignatureInput, at?: number): Promise<IssuedKey>
  /** The exact message the client must sign for a fresh nonce. */
  challenge(pubkey: string, nonce: string): string
}

/**
 * Build a wallet-key issuer over the SAME `ApiKeyStore` the other issuers
 * (dev keys, operator keys, self-serve) use. The issued account carries
 * `wallet: pubkey` (plus `label: 'wallet'`) so billing and audit trails bind
 * to the wallet.
 */
export function createWalletKeyIssuer(
  store: ApiKeyStore,
  opts: { nonces?: NonceRegistry; domain?: string; now?: () => number } = {},
): WalletKeyIssuer {
  const nonces = opts.nonces ?? new MemoryNonceRegistry()
  const now = opts.now ?? Date.now
  const issue = async (input: WalletSignatureInput, at: number = now()): Promise<IssuedKey> => {
    const pubkey = typeof input.pubkey === 'string' ? input.pubkey.trim() : ''
    if (!pubkey) throw new Error('wallet pubkey is required')
    let message: string
    try {
      message = challengeForWallet(pubkey, input.nonce, opts.domain)
    } catch {
      throw new Error('invalid wallet challenge')
    }
    if (!nonces.claim(pubkey, input.nonce)) {
      throw new Error('nonce already used — request a fresh challenge nonce')
    }
    if (!verifyWalletSignature(input, message)) {
      throw new Error('wallet signature verification failed')
    }
    const issueInput: ApiKeyIssueInput = {
      userId: newKeyUserId(),
      wallet: pubkey,
      label: 'wallet',
    }
    return store.issue(issueInput, at)
  }
  return {
    issue,
    challenge: (pubkey: string, nonce: string) => challengeForWallet(pubkey, nonce, opts.domain),
  }
}

/** Narrow an Account to its wallet binding (for audit / top-up attribution). */
export function walletOf(account: Account): string | undefined {
  return account.wallet
}
