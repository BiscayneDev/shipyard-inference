import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Router, MemoryCacheStore, cacheKey } from '../src/index.js'
import type { LLMStreamEvent } from '../src/index.js'
import { candidate, chatParams, model, streamingProvider } from './helpers.js'

const doneEvent: LLMStreamEvent = {
  type: 'done',
  response: { content: 'cached answer', toolCalls: [], stopReason: 'end_turn' },
}

async function drain(stream: AsyncIterable<LLMStreamEvent>): Promise<LLMStreamEvent[]> {
  const out: LLMStreamEvent[] = []
  for await (const e of stream) out.push(e)
  return out
}

test('a clean stream populates the cache; a repeat is served from it', async () => {
  const provider = streamingProvider([{ type: 'text_delta', text: 'cached answer' }, doneEvent])
  const router = new Router({
    candidates: [candidate('c', provider, [model('m')])],
    cache: new MemoryCacheStore(),
  })

  await drain(router.chatStream(chatParams()))
  const second = await drain(router.chatStream(chatParams()))

  assert.equal(provider.streamCalls.length, 1, 'second request served from cache')
  assert.ok(second.some((e) => e.type === 'done'))
  const text = second
    .filter((e) => e.type === 'text_delta')
    .map((e) => (e as { text: string }).text)
    .join('')
  assert.equal(text, 'cached answer')
})

test('a mid-stream error leaves the cache empty', async () => {
  const store = new MemoryCacheStore()
  const provider = streamingProvider([{ type: 'text_delta', text: 'partial' }], {
    throwAt: 1,
    error: new Error('boom'),
  })
  const router = new Router({
    candidates: [candidate('c', provider, [model('m')])],
    cache: store,
  })

  await assert.rejects(async () => {
    for await (const _e of router.chatStream(chatParams())) void _e
  })

  assert.equal(await store.get(cacheKey(chatParams())), undefined)
})
