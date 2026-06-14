import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import { anthropicRequestToChatParams } from '../src/anthropic-compat/index.js'
import { candidate, model, staticProvider } from './helpers.js'

const appWith = () =>
  createGatewayApp({
    candidates: [
      candidate('c', staticProvider('hello world'), [
        model('claude-sonnet-4-5', { inputCostPerMTok: 3, outputCostPerMTok: 15 }),
      ]),
    ],
    apiKeys: ['secret'],
  })
const headers = { authorization: 'Bearer secret', 'content-type': 'application/json' }
const msg = (extra = {}) =>
  JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 64, messages: [{ role: 'user', content: 'hi' }], ...extra })

test('POST /v1/messages — non-streaming returns an Anthropic Message', async () => {
  const res = await appWith().request('/v1/messages', { method: 'POST', headers, body: msg() })
  assert.equal(res.status, 200)
  const j = (await res.json()) as {
    type: string; role: string; content: Array<{ type: string; text: string }>; stop_reason: string; usage: { output_tokens: number }
  }
  assert.equal(j.type, 'message')
  assert.equal(j.role, 'assistant')
  assert.equal(j.content[0]?.type, 'text')
  assert.equal(j.content[0]?.text, 'hello world')
  assert.equal(j.stop_reason, 'end_turn')
  assert.equal(res.headers.get('x-shipyard-model'), 'claude-sonnet-4-5')
})

test('POST /v1/messages — x-api-key auth works; bad key → Anthropic 401', async () => {
  const ok = await appWith().request('/v1/messages', {
    method: 'POST', headers: { 'x-api-key': 'secret', 'content-type': 'application/json' }, body: msg(),
  })
  assert.equal(ok.status, 200)
  const bad = await appWith().request('/v1/messages', {
    method: 'POST', headers: { 'x-api-key': 'nope', 'content-type': 'application/json' }, body: msg(),
  })
  assert.equal(bad.status, 401)
  const err = (await bad.json()) as { type: string; error: { type: string } }
  assert.equal(err.type, 'error')
  assert.equal(err.error.type, 'authentication_error')
})

test('POST /v1/messages — streaming emits the Anthropic SSE event sequence', async () => {
  const res = await appWith().request('/v1/messages', { method: 'POST', headers, body: msg({ stream: true }) })
  assert.equal(res.status, 200)
  const text = await res.text()
  for (const ev of ['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'message_delta', 'message_stop']) {
    assert.ok(text.includes(`event: ${ev}`), `missing event ${ev}`)
  }
  assert.ok(text.includes('"type":"text_delta"'))
})

test('POST /v1/messages/count_tokens returns an estimate', async () => {
  const res = await appWith().request('/v1/messages/count_tokens', {
    method: 'POST', headers, body: JSON.stringify({ model: 'claude-sonnet-4-5', messages: [{ role: 'user', content: 'hello there world' }] }),
  })
  assert.equal(res.status, 200)
  assert.ok(((await res.json()) as { input_tokens: number }).input_tokens > 0)
})

test('anthropicRequestToChatParams: system blocks, tools, tool_use/tool_result', () => {
  const params = anthropicRequestToChatParams({
    model: 'm', max_tokens: 10,
    system: [{ type: 'text', text: 'be brief' }],
    tools: [{ name: 'get_weather', description: 'w', input_schema: { type: 'object' } }],
    messages: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', id: 't1', name: 'get_weather', input: { city: 'SF' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"temp":70}' }] },
    ],
  })
  assert.equal(params.system, 'be brief')
  assert.equal(params.tools[0]?.name, 'get_weather')
  assert.equal(params.messages[0]?.content, 'hi')
  assert.equal(params.messages[1]?.toolCalls?.[0]?.name, 'get_weather')
  assert.equal(params.messages[2]?.role, 'tool')
  assert.equal(params.messages[2]?.toolResults?.[0]?.id, 't1')
})
