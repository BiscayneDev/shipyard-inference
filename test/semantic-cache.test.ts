import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Router, SemanticCacheStore } from '../src/index.js'
import type { Embedder } from '../src/index.js'
import { candidate, chatParams, model, mockProvider } from './helpers.js'

// Deterministic bag-of-words embedder over a tiny vocab — paraphrases that share
// words get identical vectors (cosine 1), different topics diverge.
const VOCAB = ['capital', 'france', 'germany', 'weather', 'paris']
function fakeEmbedder(): Embedder {
  return {
    async embed(text: string) {
      const t = text.toLowerCase()
      return VOCAB.map((w) => (t.includes(w) ? 1 : 0))
    },
  }
}

const ask = (content: string) => chatParams({ messages: [{ role: 'user', content }] })
const paris = { content: 'Paris', toolCalls: [], stopReason: 'end_turn' as const }

test('returns a hit for a paraphrase above the threshold', async () => {
  const store = new SemanticCacheStore({ embedder: fakeEmbedder(), threshold: 0.9 })
  await store.set(ask('What is the capital of France?'), paris)
  assert.deepEqual(await store.get(ask('Tell me the capital of France, please')), paris)
})

test('misses a semantically different request', async () => {
  const store = new SemanticCacheStore({ embedder: fakeEmbedder(), threshold: 0.9 })
  await store.set(ask('What is the capital of France?'), paris)
  assert.equal(await store.get(ask('What is the capital of Germany?')), undefined)
})

test('an empty cache returns undefined', async () => {
  const store = new SemanticCacheStore({ embedder: fakeEmbedder() })
  assert.equal(await store.get(ask('anything')), undefined)
})

test('Router serves paraphrases from the semantic cache (provider called once)', async () => {
  const provider = mockProvider(() => paris)
  const router = new Router({
    candidates: [candidate('c', provider, [model('m')])],
    cache: new SemanticCacheStore({ embedder: fakeEmbedder(), threshold: 0.9 }),
  })

  await router.chat(ask('What is the capital of France?'))
  await router.chat(ask('the capital of France, please'))

  assert.equal(provider.calls.length, 1)
})
