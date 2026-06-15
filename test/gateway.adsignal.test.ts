import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import type { GatewayConfig } from '../src/gateway/index.js'
import { candidate, model, staticProvider } from './helpers.js'

function appWith(over: Partial<GatewayConfig> = {}) {
  return createGatewayApp({
    candidates: [candidate('c', staticProvider('hello'), [model('m')])],
    apiKeys: ['secret'],
    ...over,
  })
}

const auth = { authorization: 'Bearer secret', 'content-type': 'application/json' }

test('coding-shaped request surfaces x-shipyard-loop-* headers', async () => {
  const res = await appWith().request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      model: 'm',
      messages: [{ role: 'user', content: 'fix the bug' }],
      tools: [
        { type: 'function', function: { name: 'read_file', description: 'd', parameters: {} } },
        { type: 'function', function: { name: 'bash', description: 'd', parameters: {} } },
      ],
    }),
  })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('x-shipyard-loop-category'), 'coding')
  assert.equal(res.headers.get('x-shipyard-loop-tier'), 'long')
})

test('a bare no-tools request classifies as chat', async () => {
  const res = await appWith().request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.headers.get('x-shipyard-loop-category'), 'chat')
  assert.equal(res.headers.get('x-shipyard-loop-tier'), 'short')
})

test('exposeAdSignal: false suppresses the loop headers', async () => {
  const res = await appWith({ exposeAdSignal: false }).request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.headers.get('x-shipyard-loop-category'), null)
})
