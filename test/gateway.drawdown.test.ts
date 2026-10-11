// Balance drawdown (Round 2 Task R1): usage debits the credit ledger under
// the SAME identity topup credited; exhaustion blocks paid traffic with a
// top-up hint; free/BYO traffic never debits; debits are replay-safe.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/server.js'
import { MemoryApiKeyStore } from '../src/gateway/keys.js'
import { MemoryCreditStore } from '../src/tender/credit-store.js'
import { ConsumedDrawdowns, debitRequest } from '../src/gateway/drawdown.js'
import { MemorySpendTracker } from '../src/gateway/spend.js'
import { candidate, mockProvider, model } from './helpers.js'
import type { GatewayConfig } from '../src/gateway/config.js'

const TREASURY = 'TreasuryTest1111111111111111111111111111111'

const paidProvider = () =>
  mockProvider(() => ({
    content: 'ok',
    toolCalls: [],
    stopReason: 'end_turn' as const,
    // 1k + 1k tokens at $1/MTok = $0.002 per request.
    usage: { inputTokens: 1_000, outputTokens: 1_000 },
  }))

interface Harness {
  app: ReturnType<typeof createGatewayApp>
  config: GatewayConfig
  store: MemoryApiKeyStore
  credits: MemoryCreditStore
  issueKey: (wallet?: string) => Promise<{ key: string; userId: string }>
}

function harness(overrides: Partial<GatewayConfig> = {}): Harness {
  const store = new MemoryApiKeyStore()
  const credits = new MemoryCreditStore()
  const config: GatewayConfig = {
    candidates: [
      candidate('c', paidProvider(), [model('m')]),
      candidate('f', mockProvider(() => ({ content: 'free', toolCalls: [], stopReason: 'end_turn' as const })), [
        model('free', { inputCostPerMTok: 0, outputCostPerMTok: 0 }),
      ]),
    ],
    keyStore: store,
    creditStore: credits,
    x402: {
      treasury: TREASURY,
      network: 'devnet',
      scheme: 'exact',
      priceUsdc: 0.001,
      fetch: (async () => {
        throw new Error('no rpc in drawdown tests')
      }) as typeof fetch,
    },
    ...overrides,
  }
  const app = createGatewayApp(config)
  return {
    app,
    config,
    store,
    credits,
    issueKey: async (wallet?: string) => {
      const { key, account } = await store.issue(wallet ? { wallet, label: 'agent' } : { label: 'plain' }, Date.now())
      return { key, userId: account.userId }
    },
  }
}

const chat = (h: Harness, key: string | undefined, modelId: string) =>
  h.app.request('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: 'hi' }] }),
  })

const fund = (h: Harness, userId: string, amountUsd: number) =>
  h.credits.accrue({
    account: userId,
    amountUsd,
    placementId: 'topup',
    line: `top-up ${amountUsd} USDC (test)`,
    requestId: `fund_${userId}`,
    at: Date.now(),
  })

// ── funded key serves, balance declines by actual cost ──────────────────────

test('drawdown: funded wallet key serves and balance declines by actual cost', async () => {
  const h = await harness()
  const { key, userId } = await h.issueKey('AgentWallet1111111111111111111111111111111')
  await fund(h, userId, 1.0)
  const res = await chat(h, key, 'm')
  assert.equal(res.status, 200)
  const cost = Number(res.headers.get('x-shipyard-cost-usd'))
  assert.ok(cost > 0, 'expected a metered cost header')
  const balance = await h.credits.balance(userId)
  assert.ok(Math.abs(balance - (1.0 - cost)) < 1e-9, `balance ${balance} should be 1.0 - ${cost}`)
})

// ── exhausted key blocked pre-flight with a top-up hint ─────────────────────

test('drawdown: exhausted wallet key blocked pre-flight with 402 + x402 top-up hint', async () => {
  const h = await harness()
  const { key, userId } = await h.issueKey('AgentWallet2222222222222222222222222222222')
  await fund(h, userId, 0.002)
  // Drain the balance with one paid request…
  assert.equal((await chat(h, key, 'm')).status, 200)
  assert.ok((await h.credits.balance(userId)) <= 0)
  // …then the next PAID request is blocked before serving.
  const res = await chat(h, key, 'm')
  assert.equal(res.status, 402)
  const body = (await res.json()) as {
    error: { type: string; balanceUsd: number; topup?: { accepts?: unknown[] } }
  }
  assert.equal(body.error.type, 'insufficient_balance')
  assert.equal(body.error.balanceUsd, (await h.credits.balance(userId)))
  assert.ok(Array.isArray(body.error.topup?.accepts), 'x402 challenge rides the 402')
  const accepts = body.error.topup?.accepts?.[0] as { payTo?: string } | undefined
  assert.equal(accepts?.payTo, TREASURY)
})

test('drawdown: exhausted wallet key without x402 still gets a message hint', async () => {
  const h = await harness({ x402: undefined })
  const { key } = await h.issueKey('AgentWallet3333333333333333333333333333333')
  const res = await chat(h, key, 'm')
  assert.equal(res.status, 402)
  const body = (await res.json()) as { error: { type: string; message: string } }
  assert.equal(body.error.type, 'insufficient_balance')
  assert.match(body.error.message, /topup/i)
})

// ── free traffic always passes and never debits ─────────────────────────────

test('drawdown: free model passes on an exhausted wallet key and never debits', async () => {
  const h = await harness()
  const { key, userId } = await h.issueKey('AgentWallet4444444444444444444444444444444')
  const res = await chat(h, key, 'free')
  assert.equal(res.status, 200)
  assert.equal(await h.credits.balance(userId), 0)
})

test('drawdown: unpriced model (no declared pricing) passes and does not debit', async () => {
  const h = await harness()
  const { key, userId } = await h.issueKey('AgentWallet5555555555555555555555555555555')
  // 'unknown-model' is neither declared on a candidate nor in DEFAULT_PRICING.
  const res = await chat(h, key, 'unknown-model')
  assert.equal(res.status, 200)
  assert.equal(await h.credits.balance(userId), 0)
})

// ── BYO never debits ────────────────────────────────────────────────────────

test('drawdown: BYO-key route never debits the credit ledger', async () => {
  const BYO_ENV = 'DRAWDOWN_TEST_BYO_KEY'
  process.env[BYO_ENV] = 'byo-key'
  try {
    const h = await harness({
      candidates: [candidate('byo-c', paidProvider(), [model('m')])],
      byok: [{ provider: 'byo-c', apiKeyEnv: BYO_ENV }],
    })
    const { key, userId } = await h.issueKey('AgentWallet6666666666666666666666666666666')
    await fund(h, userId, 1.0)
    const res = await chat(h, key, 'auto')
    assert.equal(res.status, 200)
    assert.equal(await h.credits.balance(userId), 1.0, 'BYO traffic must not debit')
  } finally {
    delete process.env[BYO_ENV]
  }
})

// ── double-settle cannot double-debit ───────────────────────────────────────

test('drawdown: replaying the same request id cannot double-debit', async () => {
  const h = await harness()
  const { userId } = await h.issueKey('AgentWallet7777777777777777777777777777777')
  await fund(h, userId, 1.0)
  const consumed = new ConsumedDrawdowns()
  const opts = { credits: h.credits, consumed }
  await debitRequest(opts, userId, 'req_1', 0.25)
  await debitRequest(opts, userId, 'req_1', 0.25) // replay
  await debitRequest(opts, userId, 'req_1', 0.25) // replay again
  assert.equal(await h.credits.balance(userId), 0.75)
  assert.equal(consumed.size, 1)
})

test('drawdown: zero and negative costs never debit', async () => {
  const h = await harness()
  const { userId } = await h.issueKey('AgentWallet8888888888888888888888888888888')
  await fund(h, userId, 1.0)
  const consumed = new ConsumedDrawdowns()
  const opts = { credits: h.credits, consumed }
  await debitRequest(opts, userId, 'req_free', 0)
  await debitRequest(opts, userId, 'req_undef', undefined)
  assert.equal(await h.credits.balance(userId), 1.0)
  assert.equal(consumed.size, 0)
})

// ── non-wallet keys unchanged ───────────────────────────────────────────────

test('drawdown: non-wallet keys are unaffected by the balance gate', async () => {
  const h = await harness()
  const { key, userId } = await h.issueKey() // plain key, no wallet, no balance
  const res = await chat(h, key, 'm')
  assert.equal(res.status, 200, 'paid model serves with zero balance')
  assert.equal(await h.credits.balance(userId), 0, 'and never debits the ledger')
})

// ── per-key ceiling at issuance ─────────────────────────────────────────────

test('drawdown: SHIPYARD_WALLET_KEY_CEILING_USD applies a per-key spend ceiling at issuance', async () => {
  const tracker = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  const h = await harness({ spend: { tracker } })
  const ceilingEnv = 'SHIPYARD_WALLET_KEY_CEILING_USD'
  const prev = process.env[ceilingEnv]
  process.env[ceilingEnv] = '0.004'
  try {
    // Issue through the real wallet path (POST /v1/keys/wallet) so the
    // gateway's issue-time ceiling wiring runs.
    const { generateKeyPairSync, createPrivateKey, sign } = await import('node:crypto')
    const bs58 = (await import('bs58')).default
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const pubkey = bs58.encode(Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url'))
    const seed = new Uint8Array(Buffer.from(privateKey.export({ format: 'jwk' }).d!, 'base64url'))
    // The challenge is deterministic — rebuild the exact message and sign it.
    const { challengeForWallet } = await import('../src/gateway/keys-wallet.js')
    const message = challengeForWallet(pubkey, 'ceiling-n1')
    const pkcs8 = Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      Buffer.from(seed),
    ])
    const sig = bs58.encode(
      sign(null, Buffer.from(message, 'utf8'), createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })),
    )
    const issueRes = await h.app.request('/v1/keys/wallet', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pubkey, nonce: 'ceiling-n1', signature: sig }),
    })
    assert.equal(issueRes.status, 200)
    const issued = (await issueRes.json()) as { key: string }
    assert.ok(issued.key)
    const key = issued.key
    // Resolve the account to fund the right balance identity.
    const account = await h.store.resolve(key)
    assert.ok(account)
    await fund(h, account.userId, 0.01) // balance gate passes; the breaker ceiling is what blocks
    // $0.002 per paid request → 3 requests = $0.006 > $0.004 ceiling.
    assert.equal((await chat(h, key, 'm')).status, 200)
    assert.equal((await chat(h, key, 'm')).status, 200)
    const blocked = await chat(h, key, 'm')
    assert.equal(blocked.status, 402)
    const body = (await blocked.json()) as { error: { type: string; cap?: string } }
    assert.equal(body.error.type, 'spend_ceiling_exceeded')
    assert.equal(body.error.cap, 'key')
    assert.equal(tracker.spent(account.userId) >= 0.004, true)
  } finally {
    if (prev === undefined) delete process.env[ceilingEnv]
    else process.env[ceilingEnv] = prev
  }
})
