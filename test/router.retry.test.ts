import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Router, failover } from '../src/index.js'
import type { LLMProvider, LLMResponse, LLMStreamEvent, RouterEvent } from '../src/index.js'
import { candidate, chatParams, model, staticProvider } from './helpers.js'

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

const ok: LLMResponse = { content: 'ok', toolCalls: [], stopReason: 'end_turn' }

/** Throws `httpError(status)` for the first `failTimes` calls, then returns `ok`. */
function flakyProvider(failTimes: number, status = 503): LLMProvider & { calls: number } {
  const state = { calls: 0 }
  return {
    get calls() {
      return state.calls
    },
    async chat() {
      state.calls += 1
      if (state.calls <= failTimes) throw httpError(status)
      return ok
    },
  } as LLMProvider & { calls: number }
}

const fastRetry = { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 1, jitter: false }

test('retries the same candidate through transient errors, then succeeds', async () => {
  const provider = flakyProvider(2, 429)
  const events: RouterEvent[] = []
  const router = new Router({
    candidates: [candidate('c', provider, [model('m')])],
    retry: fastRetry,
    onEvent: (e) => events.push(e),
  })

  const res = await router.chat(chatParams())
  assert.equal(res.content, 'ok')
  assert.equal(provider.calls, 3, '2 failures + 1 success')

  const retries = events.filter((e) => e.type === 'retry')
  assert.equal(retries.length, 2)
  assert.equal((retries[0] as { delayMs: number }).delayMs, 1)
})

test('exhausting retries fails over to the next candidate', async () => {
  const primary = flakyProvider(99) // always fails
  const fallback = candidate('f', staticProvider('from-fallback'), [model('fm')])
  const router = new Router({
    candidates: [candidate('p', primary, [model('pm')]), fallback],
    strategy: failover(['p', 'f']),
    retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
  })

  const res = await router.chat(chatParams())
  assert.equal(res.content, 'from-fallback')
  assert.equal(primary.calls, 3, 'initial + 2 retries before failover')
})

test('non-retryable errors are not retried', async () => {
  const provider = flakyProvider(99, 400)
  const router = new Router({
    candidates: [candidate('c', provider, [model('m')])],
    retry: fastRetry,
  })
  await assert.rejects(() => router.chat(chatParams()), /HTTP 400/)
  assert.equal(provider.calls, 1)
})

test('streaming retries the same candidate before the first token', async () => {
  const state = { calls: 0 }
  const provider: LLMProvider = {
    async chat() {
      return ok
    },
    async *chatStream() {
      state.calls += 1
      if (state.calls <= 1) throw httpError(503)
      yield { type: 'text_delta', text: 'hi' }
      yield { type: 'done', response: { content: 'hi', toolCalls: [], stopReason: 'end_turn' } }
    },
  }

  const router = new Router({
    candidates: [candidate('c', provider, [model('m')])],
    retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
  })

  const events: LLMStreamEvent[] = []
  for await (const e of router.chatStream(chatParams())) events.push(e)

  assert.equal(state.calls, 2, '1 failure + 1 success')
  const text = events
    .filter((e) => e.type === 'text_delta')
    .map((e) => (e as { text: string }).text)
    .join('')
  assert.equal(text, 'hi')
})
