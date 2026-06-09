import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AnthropicProvider } from '../src/index.js'
import type { LLMStreamEvent } from '../src/index.js'
import { anthropicSSE, chatParams, sseFetch } from './helpers.js'

function provider(sse: string) {
  return new AnthropicProvider({ apiKey: 'test-key', fetch: sseFetch(sse) })
}

async function drain(stream: AsyncIterable<LLMStreamEvent>): Promise<LLMStreamEvent[]> {
  const out: LLMStreamEvent[] = []
  for await (const e of stream) out.push(e)
  return out
}

test('maps an Anthropic text stream to text deltas + done with usage', async () => {
  const sse = anthropicSSE([
    { event: 'message_start', data: { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'claude', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } } },
    { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
    { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } } },
    { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } } },
    { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
    { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } } },
    { event: 'message_stop', data: { type: 'message_stop' } },
  ])

  const events = await drain(provider(sse).chatStream(chatParams()))
  const text = events.filter((e) => e.type === 'text_delta').map((e) => (e as { text: string }).text).join('')
  assert.equal(text, 'Hello world')

  const done = events.at(-1)
  assert.ok(done?.type === 'done')
  assert.equal(done.response.content, 'Hello world')
  assert.equal(done.response.stopReason, 'end_turn')
  assert.deepEqual(done.response.usage, { inputTokens: 10, outputTokens: 5 })
})

test('maps an Anthropic tool_use stream, assembling tool args in done', async () => {
  const sse = anthropicSSE([
    { event: 'message_start', data: { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'claude', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 8, output_tokens: 0 } } } },
    { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tu_1', name: 'get_weather', input: {} } } },
    { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"city":' } } },
    { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '"SF"}' } } },
    { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
    { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 12 } } },
    { event: 'message_stop', data: { type: 'message_stop' } },
  ])

  const events = await drain(provider(sse).chatStream(chatParams()))

  const start = events.find((e) => e.type === 'tool_call_start')
  assert.ok(start?.type === 'tool_call_start')
  assert.equal(start.id, 'tu_1')
  assert.equal(start.name, 'get_weather')
  assert.equal(start.index, 0)

  const done = events.at(-1)
  assert.ok(done?.type === 'done')
  assert.equal(done.response.stopReason, 'tool_use')
  assert.deepEqual(done.response.toolCalls, [{ id: 'tu_1', name: 'get_weather', input: { city: 'SF' } }])
})
