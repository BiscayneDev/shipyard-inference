import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import { MemorySpendTracker } from '../src/gateway/spend.js'
import { candidate, mockProvider, model, throwingProvider } from './helpers.js'

const auth = {
  authorization: 'Bearer k',
  'content-type': 'application/json',
}

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

/** Parse an SSE body into parsed JSON chunks. */
function parseSSE(body: string): Array<Record<string, unknown>> {
  return body
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => l.slice(6).trim())
    .filter((d) => d !== '[DONE]')
    .map((d) => JSON.parse(d) as Record<string, unknown>)
}

const BYO_ENV = 'SHIPYARD_TEST_BYOK_ANTHROPIC'

/** Providers that report usage so real (non-zero) cost is computed. */
const sharedProvider = () =>
  mockProvider(() => ({
    content: 'from-shared',
    toolCalls: [],
    stopReason: 'end_turn',
    usage: { inputTokens: 1000, outputTokens: 500 },
  }))
const byoSuccessProvider = () =>
  mockProvider(() => ({
    content: 'from-byo',
    toolCalls: [],
    stopReason: 'end_turn',
    usage: { inputTokens: 1000, outputTokens: 500 },
  }))

function anthropicPair() {
  const byo = candidate('byo-anthropic', byoSuccessProvider(), [
    model('byo-claude', { inputCostPerMTok: 9, outputCostPerMTok: 9 }),
  ])
  const shared = candidate('shared-anthropic', sharedProvider(), [
    model('shared-claude', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
  ])
  return { byo, shared }
}

test('BYO key serves first and the receipt shows billed:false, cost 0, spend untouched', async () => {
  process.env[BYO_ENV] = 'sk-own'
  try {
    const { byo, shared } = anthropicPair()
    const spend = new MemorySpendTracker({ defaultCeilingUsd: 100 })
    const app = createGatewayApp({
      candidates: [byo, shared],
      apiKeys: ['k'],
      byok: [{ provider: 'byo-anthropic', apiKeyEnv: BYO_ENV }],
      spend: { tracker: spend },
    })
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: 'auto',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    })
    assert.equal(res.status, 200)
    const chunks = parseSSE(await res.text())
    const trailer = chunks.find((c) => c.x_shipyard !== undefined)
    assert.ok(trailer, 'expected an x_shipyard trailer chunk')
    assert.equal(trailer.object, 'chat.completion.chunk')
    assert.ok(Array.isArray(trailer.choices))
    const receipt = trailer.x_shipyard as {
      provider?: string
      costUsd?: number
      billed?: boolean
    }
    assert.equal(receipt.provider, 'byo-anthropic', 'BYO candidate must serve first')
    assert.equal(receipt.billed, false)
    assert.equal(receipt.costUsd, 0)
    // The user's own bill: the spend breaker must never see this request.
    assert.equal(spend.spent('k'), 0)
  } finally {
    delete process.env[BYO_ENV]
  }
})

test('BYO key unset in env → falls back to the shared candidate and bills normally', async () => {
  delete process.env[BYO_ENV]
  const { byo, shared } = anthropicPair()
  const spend = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  const app = createGatewayApp({
    candidates: [byo, shared],
    apiKeys: ['k'],
    byok: [{ provider: 'byo-anthropic', apiKeyEnv: BYO_ENV }],
    spend: { tracker: spend },
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      model: 'auto',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    }),
  })
  assert.equal(res.status, 200)
  const chunks = parseSSE(await res.text())
  const trailer = chunks.find((c) => c.x_shipyard !== undefined)
  assert.ok(trailer, 'expected an x_shipyard trailer chunk')
  const receipt = trailer.x_shipyard as {
    provider?: string
    costUsd?: number
    billed?: boolean
  }
  assert.equal(receipt.provider, 'shared-anthropic')
  assert.notEqual(receipt.billed, false)
  assert.ok((receipt.costUsd ?? 0) > 0)
  assert.ok(spend.spent('k') > 0)
})

test('BYO attempt fails → failover to shared, and THAT request bills normally', async () => {
  process.env[BYO_ENV] = 'sk-own'
  try {
    const flakyByo = candidate('byo-anthropic', throwingProvider(httpError(429)), [
      model('byo-claude', { inputCostPerMTok: 9, outputCostPerMTok: 9 }),
    ])
    const shared = candidate('shared-anthropic', sharedProvider(), [
      model('shared-claude', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
    ])
    const spend = new MemorySpendTracker({ defaultCeilingUsd: 100 })
    const app = createGatewayApp({
      candidates: [flakyByo, shared],
      apiKeys: ['k'],
      byok: [{ provider: 'byo-anthropic', apiKeyEnv: BYO_ENV }],
      spend: { tracker: spend },
    })
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: 'auto',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    })
    assert.equal(res.status, 200)
    const chunks = parseSSE(await res.text())
    const trailer = chunks.find((c) => c.x_shipyard !== undefined)
    assert.ok(trailer, 'expected an x_shipyard trailer chunk')
    const receipt = trailer.x_shipyard as {
      provider?: string
      costUsd?: number
      billed?: boolean
      failover?: { from?: string; to?: string }
    }
    assert.equal(receipt.provider, 'shared-anthropic')
    assert.equal(receipt.failover?.from, 'byo-anthropic')
    assert.equal(receipt.failover?.to, 'shared-anthropic')
    // The rung that actually served is billed — the failed BYO attempt is not.
    assert.notEqual(receipt.billed, false)
    assert.ok((receipt.costUsd ?? 0) > 0)
    assert.ok(spend.spent('k') > 0)
  } finally {
    delete process.env[BYO_ENV]
  }
})

test('explicit pin bypasses BYO promotion — pinned model serves even with BYO key set', async () => {
  process.env[BYO_ENV] = 'sk-own'
  try {
    const { byo, shared } = anthropicPair()
    const app = createGatewayApp({
      candidates: [byo, shared],
      apiKeys: ['k'],
      byok: [{ provider: 'byo-anthropic', apiKeyEnv: BYO_ENV }],
    })
    // Pin the SHARED model: pin semantics must win over BYO promotion.
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: 'shared-claude',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    })
    assert.equal(res.status, 200)
    const chunks = parseSSE(await res.text())
    const trailer = chunks.find((c) => c.x_shipyard !== undefined)
    assert.ok(trailer, 'expected an x_shipyard trailer chunk')
    const receipt = trailer.x_shipyard as { provider?: string; billed?: boolean }
    assert.equal(receipt.provider, 'shared-anthropic', 'pin wins over BYO ordering')
    // Pinned onto a shared (non-BYO) rung → billed normally.
    assert.notEqual(receipt.billed, false)
  } finally {
    delete process.env[BYO_ENV]
  }
})

test('BYO-served spend never counts toward the project aggregate cap', async () => {
  process.env[BYO_ENV] = 'sk-own'
  try {
    const { byo, shared } = anthropicPair()
    const spend = new MemorySpendTracker({ defaultCeilingUsd: 100 })
    const cap = { ceilingUsd: 0.001, windowMs: 60_000 }
    const app = createGatewayApp({
      candidates: [byo, shared],
      apiKeys: ['k'],
      byok: [{ provider: 'byo-anthropic', apiKeyEnv: BYO_ENV }],
      spend: { tracker: spend, project: cap },
    })
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: 'auto',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    })
    // BYO rung serves (shared would blow the tiny cap) and records nothing.
    assert.equal(res.status, 200)
    const chunks = parseSSE(await res.text())
    const trailer = chunks.find((c) => c.x_shipyard !== undefined)
    const receipt = trailer?.x_shipyard as { provider?: string }
    assert.equal(receipt?.provider, 'byo-anthropic')
    assert.equal(spend.projectSpent?.('default', cap), 0)
    // A shared-pool request afterwards still works — the project is NOT drained
    // by BYO traffic (contrast: a billed request of the same size would 402).
    // Fresh app: the original captured the BYO key at plan time, so build one
    // without byok to force the shared rung.
    delete process.env[BYO_ENV]
    const sharedApp = createGatewayApp({
      candidates: [byo, shared],
      apiKeys: ['k'],
      spend: { tracker: spend, project: cap },
    })
    const res2 = await sharedApp.request('/v1/chat/completions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: 'auto',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    })
    assert.equal(res2.status, 200, 'BYO traffic must not consume the project budget')
    // Consume the stream: recordSpend fires at end-of-stream, so the body must
    // be fully read before the aggregate is asserted on.
    parseSSE(await res2.text())
    assert.ok((spend.projectSpent?.('default', cap) ?? 0) > 0, 'the shared request DID bill against the project')
  } finally {
    delete process.env[BYO_ENV]
  }
})
