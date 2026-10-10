import { test } from 'node:test'
import assert from 'node:assert/strict'
import { taskHeaderHints } from '../src/gateway/server.js'
import { taskClassMaxTier, clampTier } from '../src/router/router.js'

const h = (o: Record<string, string>) => (n: string) => o[n]

test('headers: class and budget parse, budget becomes a bounded attempt timeout', () => {
  assert.deepEqual(taskHeaderHints(h({ 'x-dinghy-task-class': 'Lookup', 'x-dinghy-latency-budget-ms': '12000' })), { taskClass: 'lookup', attemptTimeoutMs: 18000 })
  assert.equal(taskHeaderHints(h({ 'x-dinghy-latency-budget-ms': '100' }))?.attemptTimeoutMs, 1000)
  assert.equal(taskHeaderHints(h({ 'x-dinghy-latency-budget-ms': '999999' }))?.attemptTimeoutMs, 60000)
})
test('headers: unknown or absent ignored', () => {
  assert.equal(taskHeaderHints(h({})), undefined)
  assert.equal(taskHeaderHints(h({ 'x-dinghy-task-class': 'nonsense' })), undefined)
})
test('cascade: low-confidence chat/lookup start at standard, confident ones are left alone', () => {
  assert.equal(taskClassMaxTier('chat', 0.58), 'standard')
  assert.equal(taskClassMaxTier('lookup', 0.69), 'standard')
  assert.equal(taskClassMaxTier('lookup', 0.9), undefined)
  assert.equal(taskClassMaxTier('chat', undefined), undefined)
})
test('research is never capped; synthesize caps at standard; background at economy', () => {
  assert.equal(taskClassMaxTier('research', 0.1), undefined)
  assert.equal(taskClassMaxTier('synthesize', 0.99), 'standard')
  assert.equal(taskClassMaxTier('background', 0.99), 'economy')
  assert.equal(clampTier('frontier', undefined, taskClassMaxTier('chat', 0.58)), 'standard')
})

import { createGatewayApp } from '../src/gateway/index.js'
import { candidate, mockProvider, model } from './helpers.js'

test('end to end: low-confidence frontier chat starts at standard; research keeps frontier', async () => {
  const mk = (n: string) => mockProvider(async () => ({ content: n, toolCalls: [], stopReason: 'end_turn' as const }))
  const gw = createGatewayApp({
    candidates: [
      candidate('s', mk('std'), [model('std', { inputCostPerMTok: 1, outputCostPerMTok: 1, tier: 'standard' })]),
      candidate('f', mk('big'), [model('big', { inputCostPerMTok: 5, outputCostPerMTok: 5, tier: 'frontier' })]),
    ],
    apiKeys: ['k'],
    autoTier: () => ({ tier: 'frontier', source: 'jev', confidence: 0.58 }) as never,
  })
  const ask = async (cls?: string) => {
    const res = await gw.request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer k', 'content-type': 'application/json', ...(cls ? { 'x-dinghy-task-class': cls } : {}) },
      body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'find food near me' }] }),
    })
    assert.equal(res.status, 200)
    return ((await res.json()) as { choices: Array<{ message: { content: string } }> }).choices[0]!.message.content
  }
  assert.equal(await ask(), 'big')
  assert.equal(await ask('chat'), 'std')
  assert.equal(await ask('research'), 'big')
})

test('ceiling is real: the frontier model is not the first attempt even when it is the cheapest; it runs only as fallback', async () => {
  const calls: string[] = []
  const mk = (n: string, fail = false) => mockProvider(async () => { calls.push(n); if (fail) throw Object.assign(new Error('boom'), { status: 503 }); return { content: n, toolCalls: [], stopReason: 'end_turn' as const } })
  const build = (stdFails: boolean) => createGatewayApp({
    candidates: [
      // frontier is CHEAPER than standard on purpose: cost ordering alone would pick it first
      candidate('f', mk('big'), [model('big', { inputCostPerMTok: 0.1, outputCostPerMTok: 0.1, tier: 'frontier' })]),
      candidate('s', mk('std', stdFails), [model('std', { inputCostPerMTok: 1, outputCostPerMTok: 1, tier: 'standard' })]),
    ],
    apiKeys: ['k'],
    autoTier: () => ({ tier: 'frontier', source: 'jev', confidence: 0.4 }) as never,
  })
  const ask = async (gw: ReturnType<typeof build>, cls: string) => {
    const res = await gw.request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer k', 'content-type': 'application/json', 'x-dinghy-task-class': cls },
      body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'hi' }] }),
    })
    return { status: res.status, text: res.status === 200 ? ((await res.json()) as { choices: Array<{ message: { content: string } }> }).choices[0]!.message.content : '' }
  }
  const ok = build(false)
  assert.equal((await ask(ok, 'chat')).text, 'std')
  assert.deepEqual(calls, ['std'], 'frontier must not be attempted first')
  calls.length = 0
  assert.equal((await ask(ok, 'research')).text, 'big', 'research is uncapped')
  calls.length = 0
  const flaky = build(true)
  assert.equal((await ask(flaky, 'chat')).text, 'big', 'falls back above the ceiling after a failure')
  assert.equal(calls[0], 'std')
})

test('ceiling never starves a request: with only frontier models available it is still served', async () => {
  const mk = (n: string) => mockProvider(async () => ({ content: n, toolCalls: [], stopReason: 'end_turn' as const }))
  const gw = createGatewayApp({
    candidates: [candidate('f', mk('big'), [model('big', { inputCostPerMTok: 5, outputCostPerMTok: 5, tier: 'frontier' })])],
    apiKeys: ['k'],
    autoTier: () => ({ tier: 'frontier', source: 'jev', confidence: 0.4 }) as never,
  })
  const res = await gw.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json', 'x-dinghy-task-class': 'chat' },
    body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200)
})
