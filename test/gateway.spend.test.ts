import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemorySpendTracker } from '../src/gateway/spend.js'
import { candidate, mockProvider, model, staticProvider } from './helpers.js'

test('breaker trips at ceiling and resets', () => {
  const s = new MemorySpendTracker({ defaultCeilingUsd: 1 })
  assert.equal(s.check('key-a', 0.5), 'allow')
  s.record('key-a', 0.6)
  assert.equal(s.check('key-a', 0.5), 'block') // 0.6 spent, would exceed 1.0
  s.reset('key-a')
  assert.equal(s.check('key-a', 0.5), 'allow')
})

test('per-key ceilings override the default', () => {
  const s = new MemorySpendTracker({ defaultCeilingUsd: 1, ceilings: { vip: 10 } })
  s.record('vip', 5)
  assert.equal(s.check('vip', 3), 'allow')
  assert.equal(s.check('norm', 0.9), 'allow')
  s.record('norm', 0.9)
  assert.equal(s.check('norm', 0.2), 'block')
})

test('free requests never block (zero estimated cost)', () => {
  const s = new MemorySpendTracker({ defaultCeilingUsd: 0 })
  // Ceiling 0 with cost 0 must still allow — local/free traffic must live.
  assert.equal(s.check('key', 0), 'allow')
})

test('spent totals are reported per key', () => {
  const s = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  s.record('a', 0.25)
  s.record('a', 0.75)
  assert.equal(s.spent('a'), 1)
  assert.equal(s.spent('b'), 0)
})

// --- Project-level aggregate cap ---

// DECISION: a drained project stays drained even for zero-cost requests —
// unlike the per-key breaker, which only blocks zero-cost requests once that
// *key* has recorded spend. A project cap is an operator budget: once the
// aggregate recorded spend crosses the ceiling within the window, ALL keyed
// traffic through the project 402s (with topUpUrl) until the window resets.
// Free/zero-cost traffic still passes when the project is NOT drained.

function usageProvider() {
  return mockProvider(() => ({
    content: 'hello',
    toolCalls: [],
    stopReason: 'end_turn',
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 }, // $1 in + $1 out = $2 per call
  }))
}

test('project cap blocks any keyed request once aggregate spend crosses the ceiling', async () => {
  const { MemorySpendTracker } = await import('../src/gateway/spend.js')
  const tracker = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  const app = createGatewayApp({
    candidates: [candidate('c', usageProvider(), [model('m')])],
    apiKeys: ['sk-a', 'sk-b'],
    spend: {
      tracker,
      topUpUrl: 'https://buy.moonpay.com',
      project: { ceilingUsd: 3, windowMs: 60_000 },
    },
  })
  const post = (key: string) =>
    app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    })
  // Two keys spend $2 each → aggregate $4 > $3 ceiling.
  const r1 = await post('sk-a')
  assert.equal(r1.status, 200)
  const r2 = await post('sk-b')
  assert.equal(r2.status, 200)
  // Neither key is individually drained, but the project is.
  const r3 = await post('sk-a')
  assert.equal(r3.status, 402)
  const body = (await r3.json()) as { error: { cap?: string; topUpUrl?: string } }
  assert.equal(body.error.cap, 'project')
  assert.equal(body.error.topUpUrl, 'https://buy.moonpay.com')
})

test('project cap window resets after windowMs', async () => {
  const { MemorySpendTracker } = await import('../src/gateway/spend.js')
  const tracker = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  const app = createGatewayApp({
    candidates: [candidate('c', usageProvider(), [model('m')])],
    apiKeys: ['sk-a'],
    spend: { tracker, project: { ceilingUsd: 1, windowMs: 10 } },
  })
  const post = () =>
    app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer sk-a', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    })
  assert.equal((await post()).status, 200) // $2 > $1 ceiling → project drained
  assert.equal((await post()).status, 402)
  await new Promise((r) => setTimeout(r, 20)) // window elapsed
  assert.equal((await post()).status, 200)
})

test('zero-cost request inside a drained project still returns 402', async () => {
  const { MemorySpendTracker } = await import('../src/gateway/spend.js')
  const tracker = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  const app = createGatewayApp({
    candidates: [candidate('c', staticProvider('free'), [model('m')])],
    apiKeys: ['sk-a'],
    spend: { tracker, project: { ceilingUsd: 1, windowMs: 60_000 } },
  })
  const post = () =>
    app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer sk-a', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    })
  // Drain the project out-of-band (no spend recorded by the free requests).
  tracker.recordProject!('default', { ceilingUsd: 1, windowMs: 60_000 }, 2)
  assert.equal((await post()).status, 402, 'drained project stays drained even at zero cost')
})

test('project cap defaults to project id "default"', async () => {
  const { MemorySpendTracker } = await import('../src/gateway/spend.js')
  const tracker = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  const app = createGatewayApp({
    candidates: [candidate('c', usageProvider(), [model('m')])],
    apiKeys: ['sk-a'],
    spend: { tracker, project: { ceilingUsd: 1, windowMs: 60_000 } },
  })
  await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer sk-a', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(tracker.projectSpent!('default', { ceilingUsd: 1, windowMs: 60_000 }), 2)
})

test('per-key breaker fires before the project cap and reports cap "key"', async () => {
  const { MemorySpendTracker } = await import('../src/gateway/spend.js')
  const tracker = new MemorySpendTracker({ defaultCeilingUsd: 1 })
  const app = createGatewayApp({
    candidates: [candidate('c', staticProvider('x'), [model('m')])],
    apiKeys: ['sk-a'],
    spend: {
      tracker,
      topUpUrl: 'https://buy.moonpay.com',
      project: { ceilingUsd: 100, windowMs: 60_000 },
    },
  })
  tracker.record('sk-a', 5)
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer sk-a', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 402)
  const body = (await res.json()) as { error: { cap?: string } }
  assert.equal(body.error.cap, 'key')
})

// --- Gateway wiring ---

import { createGatewayApp } from '../src/gateway/index.js'

test('gateway blocks a key past its ceiling with a recoverable 402 + top-up link', async () => {
  const { MemorySpendTracker } = await import('../src/gateway/spend.js')
  const tracker = new MemorySpendTracker({ defaultCeilingUsd: 0.0001 })
  const app = createGatewayApp({
    candidates: [
      candidate('c', staticProvider('hello'), [model('m', { inputCostPerMTok: 1, outputCostPerMTok: 1 })]),
    ],
    apiKeys: ['sk-spent'],
    spend: { tracker, topUpUrl: 'https://buy.moonpay.com' },
  })
  // First request passes, completes, records real cost (1 in + 1 out MTok ≈ tiny
  // but > 0.0001 ceiling? No — far below. Force the drain instead.)
  tracker.record('sk-spent', 5)
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer sk-spent', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 402)
  const body = (await res.json()) as {
    error: { type: string; topUpUrl?: string; spentUsd?: number }
  }
  assert.equal(body.error.type, 'spend_ceiling_exceeded')
  assert.equal(body.error.topUpUrl, 'https://buy.moonpay.com')
  assert.ok((body.error.spentUsd ?? 0) > 1)

  // After reset, the same key flows again.
  tracker.reset('sk-spent')
  const res2 = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer sk-spent', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res2.status, 200)
})

test('gateway records actual cost after a keyed completion', async () => {
  const { MemorySpendTracker } = await import('../src/gateway/spend.js')
  const tracker = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  // A provider that reports usage, like real ones do — cost needs token counts.
  const usageProvider = mockProvider(() => ({
    content: 'hello',
    toolCalls: [],
    stopReason: 'end_turn',
    usage: { inputTokens: 1000, outputTokens: 1000 },
  }))
  const app = createGatewayApp({
    candidates: [
      candidate('c', usageProvider, [model('m', { inputCostPerMTok: 1, outputCostPerMTok: 1 })]),
    ],
    apiKeys: ['sk-acc'],
    spend: { tracker },
  })
  await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer sk-acc', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.ok(tracker.spent('sk-acc') > 0, 'actual cost should be recorded post-completion')
})

test('project cap with ceilingUsd 0 blocks everything (no dead >0 guard)', () => {
  // ceilingUsd: 0 must not silently pass: amount 0 >= 0 → drained from the start.
  const s = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  const cap = { ceilingUsd: 0, windowMs: 60_000 }
  assert.equal(s.checkProject('p', cap, 0), 'block')
  assert.equal(s.checkProject('p', cap, 1), 'block')
  // A sane ceiling still allows free traffic when not drained.
  const ok = { ceilingUsd: 10, windowMs: 60_000 }
  assert.equal(s.checkProject('q', ok, 0), 'allow')
})

test('startGateway rejects invalid project cap config at load', async () => {
  const { startGateway } = await import('../src/gateway/serve.js')
  type GatewayConfig = Parameters<typeof startGateway>[0]
  const cfg = (spend: object): GatewayConfig => ({ spend } as unknown as GatewayConfig)
  assert.throws(
    () => startGateway(cfg({ tracker: new MemorySpendTracker({ defaultCeilingUsd: 1 }), project: { ceilingUsd: 0, windowMs: 60_000 } })),
    /ceilingUsd must be > 0/,
  )
  assert.throws(
    () => startGateway(cfg({ tracker: new MemorySpendTracker({ defaultCeilingUsd: 1 }), project: { ceilingUsd: 10, windowMs: 0 } })),
    /windowMs must be > 0/,
  )
})
