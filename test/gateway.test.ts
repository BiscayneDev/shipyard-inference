import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import { candidate, model, staticProvider } from './helpers.js'

function appWith(apiKeys?: string[]) {
  return createGatewayApp({
    candidates: [
      candidate('c', staticProvider('hello'), [
        model('m', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
      ]),
    ],
    apiKeys,
  })
}

const auth = { authorization: 'Bearer secret', 'content-type': 'application/json' }

test('non-streaming completion returns OpenAI shape + x-shipyard headers', async () => {
  const res = await appWith(['secret']).request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200)
  const json = (await res.json()) as {
    object: string
    choices: Array<{ message: { content: string }; finish_reason: string }>
  }
  assert.equal(json.object, 'chat.completion')
  assert.equal(json.choices[0]?.message.content, 'hello')
  assert.equal(json.choices[0]?.finish_reason, 'stop')
  assert.equal(res.headers.get('x-shipyard-model'), 'm')
  assert.equal(res.headers.get('x-shipyard-provider'), 'c')
})

test('missing/invalid bearer is rejected with an OpenAI error shape', async () => {
  const noAuth = await appWith(['secret']).request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(noAuth.status, 401)
  const json = (await noAuth.json()) as { error: { type: string } }
  assert.equal(json.error.type, 'authentication_error')

  const wrong = await appWith(['secret']).request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer nope', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(wrong.status, 401)
})

test('GET /v1/models lists candidate models', async () => {
  const res = await appWith(['secret']).request('/v1/models', {
    headers: { authorization: 'Bearer secret' },
  })
  const json = (await res.json()) as { object: string; data: Array<{ id: string }> }
  assert.equal(json.object, 'list')
  assert.ok(json.data.some((m) => m.id === 'm'))
})

test('no-capable-model maps to a 400 invalid_request_error', async () => {
  const app = createGatewayApp({
    candidates: [candidate('c', staticProvider('x'), [model('m', { capabilities: [] })])],
    apiKeys: ['secret'],
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'f', description: 'd', parameters: {} } }],
    }),
  })
  assert.equal(res.status, 400)
  const json = (await res.json()) as { error: { type: string } }
  assert.equal(json.error.type, 'invalid_request_error')
})

test('healthz is unauthenticated', async () => {
  const res = await appWith(['secret']).request('/healthz')
  assert.equal(res.status, 200)
})
