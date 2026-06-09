import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Router, MemoryCacheStore, cacheKey, costOptimized } from '../src/index.js'
import { candidate, chatParams, model, mockProvider } from './helpers.js'

test('cacheKey is stable regardless of object key order', () => {
  const a = chatParams({ maxTokens: 100, routingHints: { tier: 'economy', requireTools: true } })
  const b = chatParams({
    maxTokens: 100,
    routingHints: { requireTools: true, tier: 'economy' },
  })
  assert.equal(cacheKey(a), cacheKey(b))
})

test('different requests produce different cache keys', () => {
  assert.notEqual(
    cacheKey(chatParams({ system: 'a' })),
    cacheKey(chatParams({ system: 'b' })),
  )
})

test('MemoryCacheStore stores and retrieves responses', async () => {
  const store = new MemoryCacheStore()
  const response = { content: 'hi', toolCalls: [], stopReason: 'end_turn' as const }
  await store.set('k', response)
  assert.deepEqual(await store.get('k'), response)
  assert.equal(await store.get('missing'), undefined)
})

test('Router returns a cached response without calling the provider twice', async () => {
  const provider = mockProvider(() => ({
    content: 'answer',
    toolCalls: [],
    stopReason: 'end_turn',
  }))
  const router = new Router({
    candidates: [candidate('only', provider, [model('m')])],
    strategy: costOptimized(),
    cache: new MemoryCacheStore(),
  })

  const first = await router.chat(chatParams())
  const second = await router.chat(chatParams())

  assert.equal(first.content, 'answer')
  assert.equal(second.content, 'answer')
  assert.equal(provider.calls.length, 1, 'second call served from cache')
})
