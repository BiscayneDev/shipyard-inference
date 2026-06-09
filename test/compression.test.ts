import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slidingWindowCompression, summarizeCompression } from '../src/index.js'
import type { ChatMessage } from '../src/index.js'
import { chatParams, mockProvider } from './helpers.js'

const convo: ChatMessage[] = [
  { role: 'user', content: '1' },
  { role: 'assistant', content: 'a1' },
  { role: 'user', content: '2' },
  { role: 'assistant', content: 'a2' },
  { role: 'user', content: '3' },
  { role: 'assistant', content: 'a3' },
]

test('slidingWindowCompression keeps the most recent messages, starting on a user turn', async () => {
  const out = await slidingWindowCompression({ maxMessages: 3 })(
    chatParams({ messages: convo }),
  )
  // last 3 = [assistant a2, user 3, assistant a3] → trimmed to start at user 3.
  assert.deepEqual(out.messages, [
    { role: 'user', content: '3' },
    { role: 'assistant', content: 'a3' },
  ])
})

test('slidingWindowCompression is a no-op under the limit', async () => {
  const params = chatParams({ messages: convo.slice(0, 2) })
  const out = await slidingWindowCompression({ maxMessages: 10 })(params)
  assert.equal(out, params)
})

test('summarizeCompression replaces older turns with a summary, keeping recent ones', async () => {
  const summarizer = mockProvider(() => ({
    content: 'SUMMARY',
    toolCalls: [],
    stopReason: 'end_turn',
  }))
  const out = await summarizeCompression({ provider: summarizer, keepRecent: 2 })(
    chatParams({ messages: convo }),
  )

  assert.equal(out.messages.length, 3)
  assert.equal(out.messages[0]?.role, 'user')
  assert.match(out.messages[0]?.content ?? '', /SUMMARY/)
  assert.deepEqual(out.messages.slice(1), [
    { role: 'user', content: '3' },
    { role: 'assistant', content: 'a3' },
  ])
  assert.equal(summarizer.calls.length, 1)
})

test('summarizeCompression is a no-op for short histories', async () => {
  const summarizer = mockProvider(() => ({ content: 'x', toolCalls: [], stopReason: 'end_turn' }))
  const params = chatParams({ messages: convo.slice(0, 2) })
  const out = await summarizeCompression({ provider: summarizer, keepRecent: 2 })(params)
  assert.equal(out, params)
  assert.equal(summarizer.calls.length, 0)
})
