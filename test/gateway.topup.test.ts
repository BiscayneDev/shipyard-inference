// One-call x402 top-up (Task A2): a wallet-bound key pays USDC and its credit
// balance is minted in the same call — no human checkout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/server.js'
import { MemoryApiKeyStore } from '../src/gateway/keys.js'
import { MemoryCreditStore } from '../src/tender/credit-store.js'
import type { CreditStore } from '../src/tender/credit-store.js'
import { candidate, mockProvider, model } from './helpers.js'
import type { GatewayConfig } from '../src/gateway/config.js'

const TREASURY = 'TreasuryTest1111111111111111111111111111111'
const PAYER = 'PayerTest11111111111111111111111111111111111'
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

function mockRpc(handlers: Record<string, () => unknown>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string }
    const handler = handlers[body.method ?? '']
    if (!handler) throw new Error(`unexpected rpc method: ${body.method}`)
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: handler() }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

function paidTxMeta(deltaUsdc: number) {
  return {
    meta: {
      err: null,
      preTokenBalances: [{ owner: PAYER, mint: USDC_DEVNET, uiTokenAmount: { uiAmount: 5 } }],
      postTokenBalances: [
        { owner: PAYER, mint: USDC_DEVNET, uiTokenAmount: { uiAmount: 5 - deltaUsdc } },
        { owner: TREASURY, mint: USDC_DEVNET, uiTokenAmount: { uiAmount: deltaUsdc } },
      ],
    },
  }
}

let headerSeq = 0
function paymentHeader(): string {
  headerSeq += 1
  return Buffer.from(
    JSON.stringify({
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: { transaction: Buffer.from(`signed-topup-tx-${headerSeq}`).toString('base64') },
    }),
  ).toString('base64')
}

const happyRpc = (deltaUsdc: number) =>
  mockRpc({
    sendTransaction: () => 'testsig',
    getSignatureStatuses: () => ({
      context: { slot: 1 },
      value: [{ confirmationStatus: 'confirmed', err: null }],
    }),
    getTransaction: () => paidTxMeta(deltaUsdc),
  })

interface Harness {
  app: ReturnType<typeof createGatewayApp>
  config: GatewayConfig
  store: MemoryApiKeyStore
  credits: MemoryCreditStore
  issueKey: (wallet?: string) => Promise<{ key: string; userId: string }>
}

function harness(rpc: typeof fetch = happyRpc(0.5), credits?: CreditStore): Harness {
  const store = new MemoryApiKeyStore()
  const creditStore = credits ?? new MemoryCreditStore()
  const config: GatewayConfig = {
    candidates: [candidate('c', mockProvider(async () => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' as const })), [model('m')])],
    keyStore: store,
    x402: {
      treasury: TREASURY,
      network: 'devnet',
      scheme: 'exact',
      priceUsdc: 0.001,
      fetch: rpc,
    },
    // First-class: topup reads `config.creditStore` — the SAME store the
    // tender kickbacks accrue to. No tender is wired at all here.
    creditStore: creditStore,
  }
  const app = createGatewayApp(config)
  return {
    app,
    config,
    store,
    credits: creditStore,
    issueKey: async (wallet?: string) => {
      const { key, account } = await store.issue(wallet ? { wallet, label: 'agent' } : { label: 'plain' }, Date.now())
      return { key, userId: account.userId }
    },
  }
}

const post = (app: ReturnType<typeof createGatewayApp>, key: string | undefined, body: unknown, payment?: string) =>
  app.request('/v1/topup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(payment ? { 'x-payment': payment } : {}),
    },
    body: JSON.stringify(body),
  })

// ── challenge ────────────────────────────────────────────────────────────────

test('topup: keyed request without payment gets a 402 challenge priced at amountUsd', async () => {
  const h = await harness()
  const { key } = await h.issueKey('AgentWallet1111111111111111111111111111111')
  const res = await post(h.app, key, { amountUsd: 5 })
  assert.equal(res.status, 402)
  const body = (await res.json()) as { accepts: Array<Record<string, unknown>> }
  const accept = body.accepts[0]
  assert.equal(accept.scheme, 'exact')
  assert.equal(accept.amount, '5000000') // 5 USDC in atomic units
  assert.equal(accept.maxAmountRequired, '5000000')
  assert.equal(accept.payTo, TREASURY)
  assert.equal(accept.asset, USDC_DEVNET)
  assert.equal(accept.resource, '/v1/topup')
})

// ── settlement credits balance ───────────────────────────────────────────────

test('topup: verified payment credits the key balance via the credit store', async () => {
  const h = await harness(happyRpc(0.5))
  const wallet = 'AgentWallet1111111111111111111111111111111'
  const { key, userId } = await h.issueKey(wallet)
  const res = await post(h.app, key, { amountUsd: 0.5 }, paymentHeader())
  assert.equal(res.status, 200)
  const body = (await res.json()) as { balanceUsd: number; creditedUsd: number }
  assert.equal(body.creditedUsd, 0.5)
  assert.equal(body.balanceUsd, 0.5)
  // The SAME credit store used by the tender flows now holds the balance.
  assert.equal(await h.credits.balance(userId), 0.5)
})

test('topup: balance accumulates across top-ups (skips payment while keyed)', async () => {
  const h = await harness(happyRpc(0.25))
  const { key, userId } = await h.issueKey('AgentWallet1111111111111111111111111111111')
  await post(h.app, key, { amountUsd: 0.25 }, paymentHeader())
  const res2 = await post(h.app, key, { amountUsd: 0.25 }, paymentHeader())
  assert.equal(res2.status, 200)
  const body = (await res2.json()) as { balanceUsd: number }
  assert.equal(body.balanceUsd, 0.5)
  assert.equal(await h.credits.balance(userId), 0.5)
})

test('topup: works with a config that has creditStore and NO tender at all', async () => {
  const h = await harness(happyRpc(0.5))
  assert.equal(h.config.tender, undefined, 'harness wires no tender')
  const { key, userId } = await h.issueKey('AgentWallet1111111111111111111111111111111')
  const res = await post(h.app, key, { amountUsd: 0.5 }, paymentHeader())
  assert.equal(res.status, 200)
  const body = (await res.json()) as { balanceUsd: number }
  assert.equal(body.balanceUsd, 0.5)
  assert.equal(await h.credits.balance(userId), 0.5)
})

// ── limits ───────────────────────────────────────────────────────────────────

test('topup: under/over-limit amounts are rejected before any payment', async () => {
  const h = await harness()
  const { key } = await h.issueKey('AgentWallet1111111111111111111111111111111')
  for (const amountUsd of [0, 0.001, 1000.01, 99999]) {
    const res = await post(h.app, key, { amountUsd })
    assert.equal(res.status, 400, `amountUsd=${amountUsd}`)
    const body = (await res.json()) as { error: string }
    assert.ok(body.error.includes('amountUsd'))
  }
  // Missing/invalid amount too.
  assert.equal((await post(h.app, key, {})).status, 400)
  assert.equal((await post(h.app, key, { amountUsd: 'five' })).status, 400)
})

test('topup: amountUsd 0.01 (min) and 1000 (max) are accepted shapes', async () => {
  const min = await harness(happyRpc(0.01))
  const k1 = await min.issueKey('AgentWallet1111111111111111111111111111111')
  assert.equal((await post(min.app, k1.key, { amountUsd: 0.01 }, paymentHeader())).status, 200)
  const max = await harness(happyRpc(1000))
  const k2 = await max.issueKey('AgentWallet1111111111111111111111111111111')
  assert.equal((await post(max.app, k2.key, { amountUsd: 1000 }, paymentHeader())).status, 200)
})

// ── replay protection ────────────────────────────────────────────────────────

test('topup: the same signed payment cannot credit twice (replay gets 402)', async () => {
  // Regression guard for the consumed-payment registry: a replayed X-PAYMENT
  // must 402 with "already consumed", never credit the balance a second time.
  const h = await harness(happyRpc(0.25))
  const wallet = 'AgentWallet1111111111111111111111111111111'
  const { key, userId } = await h.issueKey(wallet)
  const header = paymentHeader()
  const first = await post(h.app, key, { amountUsd: 0.25 }, header)
  assert.equal(first.status, 200)
  const replay = await post(h.app, key, { amountUsd: 0.25 }, header)
  assert.equal(replay.status, 402)
  const body = (await replay.json()) as { error?: string }
  assert.match(String(body.error), /consumed/)
  assert.equal(await h.credits.balance(userId), 0.25, 'credited exactly once')
})

// ── key eligibility ──────────────────────────────────────────────────────────

test('topup: non-wallet key gets a clear error (403), nothing credited', async () => {
  const h = await harness()
  const { key } = await h.issueKey() // no wallet binding
  const res = await post(h.app, key, { amountUsd: 1 })
  assert.equal(res.status, 403)
  const body = (await res.json()) as { error: string }
  assert.ok(body.error.toLowerCase().includes('wallet'))
  assert.equal(await h.credits.balance('anyone'), 0)
})

test('topup: keyless request is 401 (auth is required; payment alone does not identify a balance)', async () => {
  const h = await harness()
  const res = await post(h.app, undefined, { amountUsd: 1 })
  assert.equal(res.status, 401)
})

test('topup: failed on-chain verification returns 402 with the error, no credit', async () => {
  const failingRpc = mockRpc({
    sendTransaction: () => 'testsig',
    getSignatureStatuses: () => ({ context: { slot: 1 }, value: [{ confirmationStatus: 'confirmed', err: { InstructionError: [0, 'custom'] } }] }),
  })
  const h = await harness(failingRpc)
  const { key } = await h.issueKey('AgentWallet1111111111111111111111111111111')
  const res = await post(h.app, key, { amountUsd: 0.5 }, paymentHeader())
  assert.equal(res.status, 402)
  const body = (await res.json()) as { error?: string }
  assert.ok(body.error)
  assert.equal(await h.credits.balance('nobody'), 0)
})

// ── one-ledger reconciliation (Round 2 drawdown) ────────────────────────────

test('topup and drawdown reconcile to ONE ledger: same account identity', async () => {
  const { balanceAccountOf, debitRequest, ConsumedDrawdowns } = await import('../src/gateway/drawdown.js')
  const h = harness()
  const { key, userId } = await h.issueKey('AgentWalletOneLedger1111111111111111111111')
  const { account } = await h.store.resolve(key).then((a) => ({ account: a! }))
  // Balance identity derivation must match topup's (account.userId).
  assert.equal(balanceAccountOf(account), userId)
  assert.equal(account.wallet, 'AgentWalletOneLedger1111111111111111111111')
  // A top-up credit and a usage debit under that identity net out in one store.
  await h.credits.accrue({
    account: balanceAccountOf(account),
    amountUsd: 1.0,
    placementId: 'topup',
    line: 'top-up 1 USDC (test)',
    requestId: 'fund_1',
    at: Date.now(),
  })
  await debitRequest(
    { credits: h.credits, consumed: new ConsumedDrawdowns() },
    balanceAccountOf(account),
    'req_1',
    0.4,
  )
  assert.ok(Math.abs((await h.credits.balance(userId)) - 0.6) < 1e-9)
})
