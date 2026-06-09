import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OpenAIProvider } from '../src/index.js'
import type { LLMStreamEvent } from '../src/index.js'
import { chatParams, openaiSSE, sseFetch } from './helpers.js'

function provider(sse: string) {
  return new OpenAIProvider({ apiKey: 'test-key', fetch: sseFetch(sse) })
}

async function drain(stream: AsyncIterable<LLMStreamEvent>): Promise<LLMStreamEvent[]> {
  const out: LLMStreamEvent[] = []
  for await (const e of stream) out.push(e)
  return out
}

const base = { id: 'c', object: 'chat.completion.chunk', created: 0, model: 'gpt-4o' }

test('maps an OpenAI text stream to deltas + done with usage', async () => {
  const sse = openaiSSE([
    { ...base, choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello' }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: { content: ' world' }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
    { ...base, choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
  ])

  const events = await drain(provider(sse).chatStream(chatParams()))
  const text = events.filter((e) => e.type === 'text_delta').map((e) => (e as { text: string }).text).join('')
  assert.equal(text, 'Hello world')

  const done = events.at(-1)
  assert.ok(done?.type === 'done')
  assert.equal(done.response.content, 'Hello world')
  assert.deepEqual(done.response.usage, { inputTokens: 10, outputTokens: 5 })
})

test('maps an OpenAI tool_call stream, assembling fragmented args in done', async () => {
  const sse = openaiSSE([
    { ...base, choices: [{ index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '' } }] }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '"SF"}' } }] }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
    { ...base, choices: [], usage: { prompt_tokens: 7, completion_tokens: 9, total_tokens: 16 } },
  ])

  const events = await drain(provider(sse).chatStream(chatParams()))

  const start = events.find((e) => e.type === 'tool_call_start')
  assert.ok(start?.type === 'tool_call_start')
  assert.equal(start.id, 'call_1')
  assert.equal(start.name, 'get_weather')

  const done = events.at(-1)
  assert.ok(done?.type === 'done')
  assert.equal(done.response.stopReason, 'tool_use')
  assert.deepEqual(done.response.toolCalls, [{ id: 'call_1', name: 'get_weather', input: { city: 'SF' } }])
})
