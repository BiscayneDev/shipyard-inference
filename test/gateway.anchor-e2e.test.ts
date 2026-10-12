import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createGatewayApp,
  MemoryApiKeyStore,
  MemoryConversationAnchorStore,
} from '../src/gateway/index.js'
import { MemorySpendTracker } from '../src/gateway/spend.js'
import { candidate, model, staticProvider, mockProvider } from './helpers.js'

// An OpenAI-compatible chat request for this candidate set.
function chatReq(modelName: string, over: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' } as Record<string, string>,
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: 'hi' }],
      ...over,
    }),
  }
}

let KEY = 'sk-shipyard-test'

test('conversation anchor: records the routed provider, then prefers it on the next auto request', async () => {
  const keyStore = new MemoryApiKeyStore()
  const issued = await keyStore.issue({ label: 't' }, Date.now())
  KEY = issued.key
  const anchor = new MemoryConversationAnchorStore()
  // Two candidates at EQUAL cost: without an anchor, cost-tie ordering decides
  // (candidate list order); with an anchor, the anchored provider must win.
  const tracking = mockProvider(() => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' }))
  const candidates = [
    candidate('anchored-provider', tracking, [model('anchored-model', { outputCostPerMTok: 1 })]),
    candidate('other-provider', staticProvider('other'), [model('other-model', { outputCostPerMTok: 1 })]),
  ]
  const app = createGatewayApp({
    keyStore,
    apiKeys: [],
    candidates,
    conversationAnchor: anchor,
  })

  // Prime the anchor to point at 'anchored-provider' (simulating prior
  // continuity from an earlier turn in the same session).
  await anchor.set(issued.account.userId, { provider: 'anchored-provider', model: 'anchored-model', lastAt: Date.now() })

  const res = await app.request('/v1/chat/completions', chatReq('auto'))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('x-shipyard-provider'), 'anchored-provider', 'anchor prefer steered routing')

  // The record path also works: an auto route with no prior anchor records it.
  const keyStore2 = new MemoryApiKeyStore()
  const issued2 = await keyStore2.issue({ label: 't' }, Date.now())
  const anchor2 = new MemoryConversationAnchorStore()
  const app2 = createGatewayApp({
    keyStore: keyStore2,
    apiKeys: [],
    candidates,
    conversationAnchor: anchor2,
  })
  // Reset KEY so auth resolves against keyStore2.
  const prevKey = KEY
  KEY = issued2.key
  const res2 = await app2.request('/v1/chat/completions', chatReq('auto'))
  assert.equal(res2.status, 200)
  const stored = await anchor2.get(issued2.account.userId)
  assert.ok(stored, 'anchor recorded after an auto route')
  assert.equal(stored!.provider, 'anchored-provider')
  KEY = prevKey
})

test('conversation anchor: an explicit model bypasses the anchor (hard statement)', async () => {
  const keyStore = new MemoryApiKeyStore()
  const issued = await keyStore.issue({ label: 't' }, Date.now())
  KEY = issued.key
  const anchor = new MemoryConversationAnchorStore()
  await anchor.set(issued.account.userId, { provider: 'anchored-provider', model: 'anchored-model', lastAt: Date.now() })
  const app = createGatewayApp({
    keyStore,
    apiKeys: [],
    candidates: [
      candidate('anchored-provider', staticProvider('a'), [model('anchored-model')]),
      candidate('cheap-provider', staticProvider('c'), [model('cheap-model')]),
    ],
    conversationAnchor: anchor,
  })
  // Explicit model name — the anchor must NOT override it.
  const res = await app.request('/v1/chat/completions', chatReq('cheap-model'))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('x-shipyard-provider'), 'cheap-provider')
})

test('spend breaker still blocks over-ceiling keys even with an anchor present', async () => {
  const keyStore = new MemoryApiKeyStore()
  const issued = await keyStore.issue({ label: 't' }, Date.now())
  KEY = issued.key
  const anchor = new MemoryConversationAnchorStore()
  await anchor.set(issued.account.userId, { provider: 'c', model: 'm', lastAt: Date.now() })
  const spend = new MemorySpendTracker({ defaultCeilingUsd: 0 })
  await spend.record(issued.account.userId, 0.01) // exceed the ceiling
  const app = createGatewayApp({
    keyStore,
    apiKeys: [],
    candidates: [candidate('c', staticProvider('ok'), [model('m')])],
    conversationAnchor: anchor,
    spend: { tracker: spend },
  })
  const res = await app.request('/v1/chat/completions', chatReq('auto'))
  assert.equal(res.status, 402, 'anchor must not bypass the spend breaker')
})
