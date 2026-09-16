import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import { candidate, mockProvider, model } from './helpers.js'

// Routing contract: a request that names a catalog model gets exactly that
// model from the candidate that declares it; `auto` (or an unknown id) routes
// by strategy (cost-optimized here — cheapest capable serves).

function twoProviderApp() {
  const premium = mockProvider(async () => ({ content: 'premium-served', toolCalls: [], stopReason: 'end_turn' as const }))
  const cheap = mockProvider(async () => ({ content: 'cheap-served', toolCalls: [], stopReason: 'end_turn' as const }))
  const app = createGatewayApp({
    candidates: [
      candidate('premium', premium, [model('big-model', { inputCostPerMTok: 10, outputCostPerMTok: 10 })]),
      candidate('cheap', cheap, [model('small-model', { inputCostPerMTok: 0.1, outputCostPerMTok: 0.1 })]),
    ],
    apiKeys: ['k'],
  })
  return { app, premium, cheap }
}

async function ask(app: ReturnType<typeof createGatewayApp>, model: string): Promise<string> {
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return body.choices[0]!.message.content
}

test('an explicitly named model is served by the candidate that declares it', async () => {
  const { app, premium, cheap } = twoProviderApp()
  const content = await ask(app, 'big-model')
  assert.equal(content, 'premium-served')
  assert.equal(premium.calls.length, 1)
  assert.equal(cheap.calls.length, 0)
})

test('model names match case-insensitively', async () => {
  const { app, premium } = twoProviderApp()
  assert.equal(await ask(app, 'BIG-MODEL'), 'premium-served')
  assert.equal(premium.calls.length, 1)
})

test("'auto' routes by strategy — cheapest capable serves", async () => {
  const { app, cheap } = twoProviderApp()
  assert.equal(await ask(app, 'auto'), 'cheap-served')
  assert.equal(cheap.calls.length, 1)
})

test('an unknown model id falls through to strategy routing rather than erroring', async () => {
  const { app, cheap } = twoProviderApp()
  assert.equal(await ask(app, 'no-such-model'), 'cheap-served')
  assert.equal(cheap.calls.length, 1)
})

test('autoTier floors tool-bearing requests to a capable model when one is declared', async () => {
  const premium = mockProvider(async () => ({ content: 'premium-served', toolCalls: [], stopReason: 'end_turn' as const }))
  const cheap = mockProvider(async () => ({ content: 'cheap-served', toolCalls: [], stopReason: 'end_turn' as const }))
  const app = createGatewayApp({
    candidates: [
      candidate('premium', premium, [model('big-model', { inputCostPerMTok: 10, outputCostPerMTok: 10, tier: 'standard' })]),
      candidate('cheap', cheap, [model('small-model', { inputCostPerMTok: 0.1, outputCostPerMTok: 0.1, tier: 'economy' })]),
    ],
    apiKeys: ['k'],
    autoTier: true,
  })
  // A tool-bearing `auto` request needs at least standard tier → premium serves.
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'auto',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'f', parameters: {} } }],
    }),
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  assert.equal(body.choices[0]!.message.content, 'premium-served')
})

test('autoTier does not override an explicitly named model', async () => {
  const premium = mockProvider(async () => ({ content: 'premium-served', toolCalls: [], stopReason: 'end_turn' as const }))
  const cheap = mockProvider(async () => ({ content: 'cheap-served', toolCalls: [], stopReason: 'end_turn' as const }))
  const app = createGatewayApp({
    candidates: [
      candidate('premium', premium, [model('big-model', { inputCostPerMTok: 10, outputCostPerMTok: 10 })]),
      candidate('cheap', cheap, [model('small-model', { inputCostPerMTok: 0.1, outputCostPerMTok: 0.1 })]),
    ],
    apiKeys: ['k'],
    autoTier: true,
  })
  // Simple prompt would infer economy, but the caller named the model — honor it.
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'big-model', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  assert.equal(body.choices[0]!.message.content, 'premium-served')
})
