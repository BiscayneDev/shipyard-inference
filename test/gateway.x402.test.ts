import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  x402Config,
  buildChallenge,
  verifyX402Payment,
  type X402Config,
} from '../src/gateway/x402.js'
import { createGatewayApp } from '../src/gateway/server.js'
import { candidate, mockProvider, model } from './helpers.js'

const TREASURY = 'TreasuryTest1111111111111111111111111111111'
const PAYER = 'PayerTest11111111111111111111111111111111111'
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

function testConfig(overrides: Partial<X402Config> = {}): X402Config {
  return {
    treasury: TREASURY,
    network: 'devnet',
    priceUsdc: 0.001,
    ...overrides,
  }
}

// ── config ────────────────────────────────────────────────────────────────────

test('x402Config is undefined without treasury or price', () => {
  assert.equal(x402Config({}), undefined)
  assert.equal(x402Config({ TENDER_TREASURY_WALLET: TREASURY }), undefined)
  assert.equal(x402Config({ SHIPYARD_X402_PRICE_USDC: '0.01' }), undefined)
})

test('x402Config reads treasury (dedicated or tender) and price', () => {
  const cfg = x402Config({
    TENDER_TREASURY_WALLET: TREASURY,
    SHIPYARD_X402_PRICE_USDC: '0.01',
    SHIPYARD_SETTLE_NETWORK: 'devnet',
  })
  assert.ok(cfg)
  assert.equal(cfg.treasury, TREASURY)
  assert.equal(cfg.priceUsdc, 0.01)
  assert.equal(cfg.network, 'devnet')

  const dedicated = x402Config({
    SHIPYARD_X402_TREASURY_WALLET: 'Other1111111111111111111111111111111111111',
    SHIPYARD_X402_PRICE_USDC: '0.02',
  })
  assert.ok(dedicated)
  assert.equal(dedicated.treasury, 'Other1111111111111111111111111111111111111')
})

// ── challenge wire shape ──────────────────────────────────────────────────────

test('challenge matches what createPayingFetch parses', async () => {
  const challenge = buildChallenge(testConfig(), '/v1/chat/completions')
  const accept = challenge.accepts[0]
  assert.ok(accept, 'accepts[0] present')
  assert.equal(accept.payTo, TREASURY)
  assert.equal(accept.amount, '1000') // 0.001 USDC = 1000 atomic
  assert.equal(accept.maxAmountRequired, '1000')
  assert.equal(accept.asset, USDC_DEVNET)
  assert.ok(String(accept.network).includes('solana'))
  assert.equal(accept.resource, '/v1/chat/completions')
  assert.ok(typeof accept.nonce === 'string' && accept.nonce.length > 0)
  assert.ok(typeof accept.expiresAt === 'number')
})

test('challenge nonces are unique', () => {
  const cfg = testConfig()
  const a = buildChallenge(cfg, '/r').accepts[0].nonce
  const b = buildChallenge(cfg, '/r').accepts[0].nonce
  assert.notEqual(a, b)
})

// ── verifyX402Payment (mocked RPC) ────────────────────────────────────────────

/** A JSON-RPC mock that routes by method. */
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
      payload: { transaction: Buffer.from(`signed-tx-bytes-${headerSeq}`).toString('base64') },
    }),
  ).toString('base64')
}

function happyPathRpc(deltaUsdc = 0.001): typeof fetch {
  return mockRpc({
    sendTransaction: () => 'testsig',
    // Real getSignatureStatuses returns {context, value} — mirror that shape.
    getSignatureStatuses: () => ({ context: { slot: 1 }, value: [{ confirmationStatus: 'confirmed', err: null }] }),
    getTransaction: () => paidTxMeta(deltaUsdc),
  })
}

test('valid payment verifies, returns payer + signature', async () => {
  const result = await verifyX402Payment(testConfig({ fetch: happyPathRpc() }), paymentHeader())
  assert.equal(result.ok, true, result.error)
  assert.equal(result.payer, PAYER)
  assert.equal(result.signature, 'testsig')
  assert.ok((result.amountUsdc ?? 0) >= 0.001)
})

test('underpaid transaction is rejected', async () => {
  const result = await verifyX402Payment(testConfig({ fetch: happyPathRpc(0.0005) }), paymentHeader())
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /credited/)
})

test('same payment cannot be consumed twice', async () => {
  const cfg = testConfig({ fetch: happyPathRpc() })
  const header = paymentHeader()
  const first = await verifyX402Payment(cfg, header)
  assert.equal(first.ok, true)
  const second = await verifyX402Payment(cfg, header)
  assert.equal(second.ok, false)
  assert.match(second.error ?? '', /consumed/)
})

test('malformed header is rejected without RPC calls', async () => {
  let rpcCalled = false
  const cfg = testConfig({
    fetch: (() => {
      rpcCalled = true
      return Promise.resolve(new Response('{}'))
    }) as unknown as typeof fetch,
  })
  assert.equal((await verifyX402Payment(cfg, 'not-base64-json!!')).ok, false)
  assert.equal(rpcCalled, false)
})

test('failed on-chain transaction is rejected', async () => {
  const rpc = mockRpc({
    sendTransaction: () => 'testsig',
    getSignatureStatuses: () => ({ context: { slot: 1 }, value: [{ confirmationStatus: 'confirmed', err: { some: 'error' } }] }),
  })
  assert.equal((await verifyX402Payment(testConfig({ fetch: rpc }), paymentHeader())).ok, false)
})

// ── gateway integration ──────────────────────────────────────────────────────

function x402App() {
  const provider = mockProvider(async () => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' as const }))
  const payments: Array<{ payer?: string; amountUsdc: number }> = []
  const app = createGatewayApp({
    candidates: [candidate('c', provider, [model('m')])],
    apiKeys: ['static-key'],
    x402: testConfig({ fetch: happyPathRpc() }),
    onX402Payment: (p) => payments.push({ payer: p.payer, amountUsdc: p.amountUsdc }),
  })
  return { app, provider, payments }
}

test('unauthenticated request gets a 402 challenge when x402 is configured', async () => {
  const { app } = x402App()
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 402)
  assert.equal(res.headers.get('x-402-challenge'), 'solana-usdc')
  const body = (await res.json()) as { accepts: Array<{ payTo: string }> }
  assert.equal(body.accepts[0].payTo, TREASURY)
})

test('paid request is served and attributed to the payer wallet', async () => {
  const { app, provider, payments } = x402App()
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-payment': paymentHeader() },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200, JSON.stringify(await res.json().catch(() => null)))
  assert.equal(provider.calls.length, 1)
  assert.equal(provider.calls[0]?.metadata?.userId, PAYER)
  assert.equal(payments.length, 1)
  assert.equal(payments[0].payer, PAYER)
  assert.ok(payments[0].amountUsdc >= 0.001)
})

test('valid api key still bypasses payment', async () => {
  const { app } = x402App()
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer static-key', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200)
})

test('without x402 config, unauthenticated requests still 401', async () => {
  const provider = mockProvider(async () => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' as const }))
  const app = createGatewayApp({
    candidates: [candidate('c', provider, [model('m')])],
    apiKeys: ['static-key'],
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 401)
})
