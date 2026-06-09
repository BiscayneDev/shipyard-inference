import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Router, failover } from '../src/index.js'
import type { LLMStreamEvent } from '../src/index.js'
import { candidate, chatParams, model, staticProvider, streamingProvider } from './helpers.js'

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

async function drain(stream: AsyncIterable<LLMStreamEvent>): Promise<LLMStreamEvent[]> {
  const out: LLMStreamEvent[] = []
  for await (const e of stream) out.push(e)
  return out
}

const doneEvent = (content: string): LLMStreamEvent => ({
  type: 'done',
  response: { content, toolCalls: [], stopReason: 'end_turn' },
})

test('retryable error BEFORE first content fails over to the next candidate', async () => {
  const primary = candidate(
    'primary',
    streamingProvider([], { throwAt: 0, error: httpError(429) }),
    [model('pm')],
  )
  const fallback = candidate(
    'fallback',
    streamingProvider([{ type: 'text_delta', text: 'hi' }, doneEvent('hi')]),
    [model('fm')],
  )

  const router = new Router({
    candidates: [primary, fallback],
    strategy: failover(['primary', 'fallback']),
  })

  const events = await drain(router.chatStream(chatParams()))
  assert.deepEqual(
    events.filter((e) => e.type === 'text_delta').map((e) => (e as { text: string }).text),
    ['hi'],
  )
  assert.ok(events.some((e) => e.type === 'done'))
})

test('error AFTER first content propagates — no failover, no duplicate output', async () => {
  const primary = candidate(
    'primary',
    streamingProvider([{ type: 'text_delta', text: 'partial' }], {
      throwAt: 1,
      error: httpError(503),
    }),
    [model('pm')],
  )
  const fallback = candidate('fallback', streamingProvider([doneEvent('unused')]), [model('fm')])

  const router = new Router({
    candidates: [primary, fallback],
    strategy: failover(['primary', 'fallback']),
  })

  const seen: string[] = []
  await assert.rejects(async () => {
    for await (const e of router.chatStream(chatParams())) {
      if (e.type === 'text_delta') seen.push(e.text)
    }
  }, /HTTP 503/)

  assert.deepEqual(seen, ['partial'])
  assert.equal(
    (fallback.provider as { streamCalls: unknown[] }).streamCalls.length,
    0,
    'fallback never invoked after commit',
  )
})

test('a non-streaming candidate is adapted into a stream', async () => {
  const only = candidate('only', staticProvider('hello from chat'), [model('m')])
  const router = new Router({ candidates: [only] })

  const events = await drain(router.chatStream(chatParams()))
  const text = events
    .filter((e) => e.type === 'text_delta')
    .map((e) => (e as { text: string }).text)
    .join('')
  assert.equal(text, 'hello from chat')
  assert.ok(events.at(-1)?.type === 'done')
})
