import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectStream, responseToStream, parseToolArguments } from '../src/index.js'
import type { LLMResponse, LLMStreamEvent } from '../src/index.js'

async function* fromArray(events: LLMStreamEvent[]): AsyncIterable<LLMStreamEvent> {
  for (const e of events) yield e
}

test('collectStream returns the authoritative done response', async () => {
  const response: LLMResponse = {
    content: 'hi',
    toolCalls: [],
    stopReason: 'end_turn',
    usage: { inputTokens: 1, outputTokens: 2 },
  }
  const res = await collectStream(fromArray([{ type: 'text_delta', text: 'hi' }, { type: 'done', response }]))
  assert.deepEqual(res, response)
})

test('collectStream assembles from deltas when no done event arrives', async () => {
  const res = await collectStream(
    fromArray([
      { type: 'text_delta', text: 'Hel' },
      { type: 'text_delta', text: 'lo' },
      { type: 'tool_call_start', index: 0, id: 'c1', name: 'get_weather' },
      { type: 'tool_call_delta', index: 0, argsTextDelta: '{"city":' },
      { type: 'tool_call_delta', index: 0, argsTextDelta: '"SF"}' },
    ]),
  )
  assert.equal(res.content, 'Hello')
  assert.equal(res.stopReason, 'tool_use')
  assert.deepEqual(res.toolCalls, [{ id: 'c1', name: 'get_weather', input: { city: 'SF' } }])
})

test('responseToStream round-trips through collectStream', async () => {
  const response: LLMResponse = {
    content: 'answer',
    toolCalls: [{ id: 'c1', name: 'f', input: { a: 1 } }],
    stopReason: 'tool_use',
  }
  const back = await collectStream(responseToStream(response))
  assert.deepEqual(back, response)
})

test('parseToolArguments returns {} and warns on invalid JSON', () => {
  assert.deepEqual(parseToolArguments('f', ''), {})
  assert.deepEqual(parseToolArguments('f', '{"a":1}'), { a: 1 })
  assert.deepEqual(parseToolArguments('f', '{not json'), {})
})
