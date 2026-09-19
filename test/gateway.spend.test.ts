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
