import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MemoryConversationAnchorStore,
  ANCHOR_TTL_MS,
  anchorFromRoute,
  anchorToHints,
} from '../src/gateway/anchor.js'
import { costOptimized } from '../src/router/strategy.js'
import { candidate, chatParams, model, staticProvider } from './helpers.js'

test('MemoryConversationAnchorStore round-trips an anchor', async () => {
  const store = new MemoryConversationAnchorStore()
  assert.equal(await store.get('acct-1'), undefined)
  await store.set('acct-1', { provider: 'ollama', model: 'llama3.2:3b', tier: 'economy', lastAt: Date.now() })
  const a = await store.get('acct-1')
  assert.equal(a?.provider, 'ollama')
  assert.equal(a?.model, 'llama3.2:3b')
  assert.equal(a?.tier, 'economy')
})

test('MemoryConversationAnchorStore expires anchors after TTL', async () => {
  const store = new MemoryConversationAnchorStore()
  await store.set('acct-1', { provider: 'ollama', lastAt: Date.now() - ANCHOR_TTL_MS - 1 })
  assert.equal(await store.get('acct-1'), undefined)
})

test('MemoryConversationAnchorStore clear removes an anchor', async () => {
  const store = new MemoryConversationAnchorStore()
  await store.set('acct-1', { provider: 'x', lastAt: Date.now() })
  await store.clear('acct-1')
  assert.equal(await store.get('acct-1'), undefined)
})

test('anchorFromRoute builds an anchor from a routed provider/model/tier', () => {
  const a = anchorFromRoute({ provider: 'anthropic', model: 'claude-sonnet-4-5', tier: 'standard' }, 123)
  assert.deepEqual(a, { provider: 'anthropic', model: 'claude-sonnet-4-5', tier: 'standard', lastAt: 123 })
  // No provider → no anchor (can't anchor an unrecorded route).
  assert.equal(anchorFromRoute({ provider: undefined }), undefined)
  // Optional fields are omitted, not null.
  const bare = anchorFromRoute({ provider: 'ollama' })
  assert.equal(bare?.model, undefined)
  assert.ok(bare?.lastAt && bare.lastAt > 0)
})

test('anchorToHints returns a prefer hint only when the provider is configured', () => {
  const anchor = { provider: 'ollama', model: 'llama3.2:3b', lastAt: Date.now() }
  assert.deepEqual(anchorToHints(anchor, ['ollama', 'anthropic']), {
    prefer: { provider: 'ollama', model: 'llama3.2:3b' },
  })
  // A removed/unknown provider still yields a soft prefer (never a pin) — the
  // router simply won't match it and falls through to normal routing.
  assert.deepEqual(anchorToHints(anchor, ['anthropic']), { prefer: { provider: 'ollama' } })
  assert.equal(anchorToHints(undefined, ['ollama']), undefined)
})

test('costOptimized prefers the anchored candidate yet keeps the pool as fallback', () => {
  const anchored = candidate('ollama', staticProvider('ollama'), [model('llama', { outputCostPerMTok: 5 })])
  const cheaperOther = candidate('other', staticProvider('other'), [model('other-model', { outputCostPerMTok: 1 })])
  // Without a prefer hint the cheapest wins (other-model).
  const base = costOptimized().select({
    params: chatParams(),
    candidates: [anchored, cheaperOther],
    attempt: 0,
    previousErrors: [],
  })
  assert.equal(base[0]?.model, 'other-model')

  const anchoredParams = chatParams({ routingHints: { prefer: { provider: 'ollama', model: 'llama' } } })
  const preferred = costOptimized().select({
    params: anchoredParams,
    candidates: [anchored, cheaperOther],
    attempt: 0,
    previousErrors: [],
  })
  // The anchored model sorts first (continuity), but the cheaper model is STILL
  // in the list (fallback if the preferred candidate fails or is unavailable).
  assert.equal(preferred[0]?.candidate.id, 'ollama')
  assert.ok(preferred.some((d) => d.candidate.id === 'other'), 'pool preserved as fallback')
})

test('costOptimized prefer-match on model id only (provider agnostic)', () => {
  const a = candidate('a', staticProvider('a'), [model('shared-model', { outputCostPerMTok: 9 })])
  const b = candidate('b', staticProvider('b'), [model('other-model', { outputCostPerMTok: 1 })])
  const preferred = costOptimized().select({
    params: chatParams({ routingHints: { prefer: { model: 'shared-model' } } }),
    candidates: [a, b],
    attempt: 0,
    previousErrors: [],
  })
  assert.equal(preferred[0]?.model, 'shared-model')
  assert.equal(preferred[1]?.model, 'other-model')
})
