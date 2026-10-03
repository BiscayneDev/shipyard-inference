import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDevKey } from '../src/gateway/dev-keys.js'
import { createOwnerKeyApp, INFERENCE_SCOPES } from '../src/gateway/owner-keys.js'
import { createGatewayApp, MemoryApiKeyStore, MemoryProjectSpendStore } from '../src/gateway/index.js'
import { candidate, mockProvider, model } from './helpers.js'

function setup(tokens = ['owner']) {
  const keyStore = new MemoryApiKeyStore()
  const app = createOwnerKeyApp({ operatorTokens: tokens, keyStore, caps: { 'buoy-credits': 20, stopped: 0 } })
  const issue = (body: unknown, token = 'owner') => app.request('/api/owner/keys', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { app, issue, keyStore }
}
const input = { projectId: 'buoy-credits', label: 'buoy-credits', scopes: [...INFERENCE_SCOPES] }

test('owner-only route fails closed with no operator tokens and rejects developer keys', async () => {
  assert.equal((await setup([]).issue(input)).status, 401)
  const t = setup()
  const dev = await t.keyStore.issue({}, Date.now())
  for (const token of ['', 'wrong', dev.key]) assert.equal((await t.issue(input, token)).status, 401)
  assert.equal((await t.keyStore.listAccounts()).length, 1)
})

test('owner key inherits configured cap and only validated project/scopes/label', async () => {
  const t = setup()
  const r = await t.issue({ ...input, scopes: ['chat:write', 'chat:write'], capUsd: 999, model: 'pinned', userId: 'override' })
  assert.equal(r.status, 201)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  const d = await r.json() as any
  assert.equal(d.capUsd, 20)
  assert.equal(d.account.projectId, 'buoy-credits')
  assert.deepEqual(d.account.scopes, ['chat:write'])
  assert.equal(d.account.model, undefined)
  assert.notEqual(d.account.userId, 'override')
  assert.equal((await t.keyStore.resolve(d.key))?.projectId, 'buoy-credits')
})

test('invalid issuance never creates an uncapped or unscoped key', async () => {
  const t = setup()
  for (const body of [null, [], {}, { ...input, projectId: '__proto__' }, { ...input, projectId: 'a b' }, { ...input, scopes: [] }, { ...input, scopes: ['*'] }, { ...input, scopes: 'chat:write' }, { ...input, label: 'x'.repeat(65) }]) {
    assert.equal((await t.issue(body)).status, 400)
  }
  assert.equal((await t.issue({ ...input, projectId: 'missing' })).status, 409)
  assert.equal((await t.keyStore.listAccounts()).length, 0)
  assert.equal((await t.issue({ ...input, projectId: 'stopped' })).status, 201)
})

test('scopes enforce endpoints on both auth surfaces and legacy keys stay compatible', async () => {
  const t = setup()
  const provider = mockProvider(() => ({ content: 'hello', toolCalls: [], stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } }))
  const app = createGatewayApp({ candidates: [candidate('c', provider, [model('m')])], keyStore: t.keyStore })
  const d = await (await t.issue({ ...input, scopes: ['models:read'] })).json() as any
  assert.equal((await app.request('/v1/models', { headers: { authorization: `Bearer ${d.key}` } })).status, 200)
  for (const path of ['/v1/chat/completions', '/v1/messages', '/v1/messages/count_tokens', '/v1/video/generate', '/v1/decisions']) {
    assert.equal((await app.request(path, { method: 'POST', headers: { 'x-api-key': d.key, ...(path.startsWith('/v1/messages') ? {} : { authorization: `Bearer ${d.key}` }) } })).status, 403)
  }
  const legacy = await t.keyStore.issue({}, Date.now())
  assert.equal((await app.request('/v1/messages', { method: 'POST', headers: { authorization: `Bearer ${d.key}`, 'x-api-key': legacy.key } })).status, 403)
  assert.equal((await app.request('/v1/models', { headers: { authorization: `Bearer ${legacy.key}` } })).status, 200)
})

test('issued scoped keys share the project meter and block at the configured cap', async () => {
  const t = setup()
  const a = await (await t.issue(input)).json() as any
  const b = await (await t.issue(input)).json() as any
  const store = new MemoryProjectSpendStore()
  const now = Date.UTC(2026, 9, 3)
  await store.add('buoy-credits', '2026-10-03', 20)
  const app = createGatewayApp({ candidates: [candidate('c', mockProvider(), [model('m')])], keyStore: t.keyStore, projectCaps: { caps: { 'buoy-credits': 20 }, store, now: () => now } })
  for (const key of [a.key, b.key]) {
    for (const path of ['/v1/chat/completions', '/v1/messages']) {
      const r = await app.request(path, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }) })
      assert.equal(r.status, 402)
      assert.equal((await r.json() as any).error.capUsd, 20)
    }
  }
})

 test('developer child keys cannot shed inherited scopes', async () => {
  const t = setup()
  const d = await (await t.issue({ ...input, scopes: ['chat:write'] })).json() as any
  const child = await createDevKey(t.keyStore, d.account, { label: 'child' })
  assert.equal(child.status, 201)
  const account = await t.keyStore.resolve(child.body.key as string)
  assert.deepEqual(account?.scopes, ['chat:write'])
  assert.equal(account?.projectId, 'buoy-credits')
 })
