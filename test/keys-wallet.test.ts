// Wallet-signed API key issuance (Task A1): an agent proves control of a
// Solana wallet with an Ed25519 signature over a challenge and receives a
// normal gateway API key bound to that wallet. No website, no checkout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto'
import bs58 from 'bs58'
import {
  challengeForWallet,
  WALLET_KEY_CHALLENGE_PREFIX,
  verifyWalletSignature,
  createWalletKeyIssuer,
  MemoryNonceRegistry,
} from '../src/gateway/keys-wallet.js'
import { MemoryApiKeyStore } from '../src/gateway/keys.js'

/** A Solana-style Ed25519 keypair: raw 32-byte pubkey + 32-byte seed. */
function generateWallet(): { pubkey: string; seed: Uint8Array } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const rawPub = publicKey.export({ format: 'jwk' }).x!
  const seed = privateKey.export({ format: 'jwk' }).d!
  const pubkey = bs58.encode(Buffer.from(rawPub, 'base64url'))
  return { pubkey, seed: new Uint8Array(Buffer.from(seed, 'base64url')) }
}

/** Sign a message with a 32-byte Ed25519 seed (PKCS#8-wrapped), base58 out. */
function signWallet(seed: Uint8Array, message: string): string {
  const pkcs8 = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    Buffer.from(seed),
  ])
  const key = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })
  return bs58.encode(sign(null, Buffer.from(message, 'utf8'), key))
}

// ── challenge ────────────────────────────────────────────────────────────────

test('challengeForWallet embeds pubkey, nonce and domain', () => {
  const challenge = challengeForWallet('WalleTpUbkey111', 'nonce-1')
  assert.ok(challenge.includes('WalleTpUbkey111'))
  assert.ok(challenge.includes('nonce-1'))
  assert.ok(challenge.includes('shipyard-inference'))
  assert.ok(challenge.startsWith(WALLET_KEY_CHALLENGE_PREFIX))
})

// ── verifyWalletSignature ────────────────────────────────────────────────────

test('verifyWalletSignature: happy path', () => {
  const { pubkey, seed } = generateWallet()
  const message = challengeForWallet(pubkey, 'n1')
  const sig = signWallet(seed, message)
  assert.equal(verifyWalletSignature({ pubkey, nonce: 'n1', signatureB58: sig }, message), true)
})

test('verifyWalletSignature: wrong signature rejected', () => {
  const { pubkey, seed } = generateWallet()
  const message = challengeForWallet(pubkey, 'n1')
  const sig = signWallet(seed, 'a different message')
  assert.equal(verifyWalletSignature({ pubkey, nonce: 'n1', signatureB58: sig }, message), false)
})

test('verifyWalletSignature: signed by a different key rejected', () => {
  const { pubkey } = generateWallet()
  const other = generateWallet()
  const message = challengeForWallet(pubkey, 'n1')
  const sig = signWallet(other.seed, message)
  assert.equal(verifyWalletSignature({ pubkey, nonce: 'n1', signatureB58: sig }, message), false)
})

test('verifyWalletSignature: malformed inputs rejected', () => {
  const message = 'whatever'
  // Not base58.
  assert.equal(verifyWalletSignature({ pubkey: 'AbC', nonce: 'n', signatureB58: '0OIl' }, message), false)
  // Signature not 64 bytes.
  const { pubkey, seed } = generateWallet()
  const short = signWallet(seed, message).slice(0, -2)
  assert.equal(verifyWalletSignature({ pubkey, nonce: 'n', signatureB58: short }, message), false)
  // Pubkey not 32 bytes.
  const badPub = bs58.encode(Buffer.alloc(16, 7))
  assert.equal(verifyWalletSignature({ pubkey: badPub, nonce: 'n', signatureB58: 'AAAA' }, message), false)
})

// ── issuer ───────────────────────────────────────────────────────────────────

function signedRequest(seed: Uint8Array, pubkey: string, nonce: string) {
  const message = challengeForWallet(pubkey, nonce)
  return { pubkey, nonce, signatureB58: signWallet(seed, message), expectedMessage: message }
}

test('createWalletKeyIssuer: happy path issues a wallet-bound key once', async () => {
  const store = new MemoryApiKeyStore()
  const issuer = createWalletKeyIssuer(store)
  const { pubkey, seed } = generateWallet()
  const req = signedRequest(seed, pubkey, 'nonce-abc')
  const issued = await issuer.issue(req)
  assert.ok(issued.key.startsWith('sk-shipyard-'))
  assert.equal(issued.account.wallet, pubkey)
  // The issued key resolves through the SAME store other issuers use.
  const resolved = await store.resolve(issued.key)
  assert.ok(resolved)
  assert.equal(resolved.wallet, pubkey)
  // Replay of the same nonce is rejected — one signature, one key.
  await assert.rejects(() => issuer.issue(req), /nonce/)
})

test('createWalletKeyIssuer: bad signature rejected, key not issued', async () => {
  const store = new MemoryApiKeyStore()
  const issuer = createWalletKeyIssuer(store)
  const { pubkey } = generateWallet()
  const forger = generateWallet()
  const message = challengeForWallet(pubkey, 'nonce-x')
  await assert.rejects(
    () => issuer.issue({ pubkey, nonce: 'nonce-x', signatureB58: signWallet(forger.seed, message) }),
    /signature/i,
  )
  assert.equal((await store.listAccounts()).length, 0)
})

test('createWalletKeyIssuer: malformed pubkey rejected', async () => {
  const issuer = createWalletKeyIssuer(new MemoryApiKeyStore())
  const message = challengeForWallet('not-a-wallet', 'nonce-y')
  await assert.rejects(
    () => issuer.issue({ pubkey: 'not-a-wallet', nonce: 'nonce-y', signatureB58: bs58.encode(Buffer.alloc(64, 1)) }),
    /pubkey|base58|signature/i,
  )
})

test('MemoryNonceRegistry: claim is one-shot with TTL prune', async () => {
  let now = 1000
  const reg = new MemoryNonceRegistry({ now: () => now, ttlMs: 60_000 })
  assert.equal(reg.claim('k1', 'a'), true)
  assert.equal(reg.claim('k1', 'a'), false)
  now += 61_000
  assert.equal(reg.claim('k1', 'a'), true) // expired → claimable again
})

// ── HTTP route: POST /v1/keys/wallet ─────────────────────────────────────────

test('POST /v1/keys/wallet issues a key; replays and bad signatures 401', async () => {
  const { createGatewayApp } = await import('../src/gateway/server.js')
  const { candidate, mockProvider, model } = await import('./helpers.js')
  const store = new MemoryApiKeyStore()
  const app = createGatewayApp({
    candidates: [candidate('c', mockProvider(async () => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' as const })), [model('m')])],
    keyStore: store,
  })
  const { pubkey, seed } = generateWallet()
  const nonce = 'route-nonce-1'
  const signature = signWallet(seed, challengeForWallet(pubkey, nonce))

  const ok = await app.request('/v1/keys/wallet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pubkey, nonce, signature }),
  })
  assert.equal(ok.status, 200)
  const body = (await ok.json()) as { key: string; wallet: string }
  assert.ok(body.key.startsWith('sk-shipyard-'))
  assert.equal(body.wallet, pubkey)

  // Replayed nonce → 401.
  const replay = await app.request('/v1/keys/wallet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pubkey, nonce, signature }),
  })
  assert.equal(replay.status, 401)

  // Bad signature → 401.
  const bad = await app.request('/v1/keys/wallet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pubkey, nonce: 'route-nonce-2', signature: bs58.encode(Buffer.alloc(64)) }),
  })
  assert.equal(bad.status, 401)

  // Deployment without a key store → 501.
  const bare = createGatewayApp({
    candidates: [candidate('c', mockProvider(async () => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' as const })), [model('m')])],
  })
  const unsupported = await bare.request('/v1/keys/wallet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pubkey, nonce, signature }),
  })
  assert.equal(unsupported.status, 501)
})
