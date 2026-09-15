import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp, MemoryApiKeyStore, resolveAuth } from '../src/gateway/index.js'
import { candidate, mockProvider, model } from './helpers.js'

function appWith(store: MemoryApiKeyStore, bootstrapAuth = false) {
  const provider = mockProvider(async () => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' as const }))
  const app = createGatewayApp({
    candidates: [candidate('c', provider, [model('m')])],
    keyStore: store,
    bootstrapAuth,
  })
  return { app, provider }
}

test('tenant-scoped keys resolve identity and stamp request metadata', async () => {
  const store = new MemoryApiKeyStore()
  const { key, account } = await store.issue({ tenantId: 'tenant-a', projectId: 'project-a', label: 'cursor' }, 1)
  const auth = await resolveAuth({ keyStore: store }, `Bearer ${key}`)

  assert.equal(auth.ok, true)
  assert.equal(auth.account?.tenantId, 'tenant-a')
  assert.equal(auth.account?.projectId, 'project-a')

  const { app, provider } = appWith(store)
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hello' }] }),
  })

  assert.equal(res.status, 200)
  assert.equal(provider.calls.length, 1)
  assert.equal(provider.calls[0]?.metadata?.tenantId, 'tenant-a')
  assert.equal(provider.calls[0]?.metadata?.projectId, 'project-a')
  assert.equal(provider.calls[0]?.metadata?.apiKeyLabel, 'cursor')
  assert.equal(provider.calls[0]?.metadata?.userId, 'project-a')
  assert.equal(provider.calls[0]?.metadata?.apiKeyId, account.userId)
})

test('revoked keys fail auth', async () => {
  const store = new MemoryApiKeyStore()
  const { key } = await store.issue({ tenantId: 'tenant-b', projectId: 'project-b' }, 1)
  assert.equal(await store.revoke(key), true)
  assert.equal((await resolveAuth({ keyStore: store }, `Bearer ${key}`)).ok, false)

  const { app } = appWith(store)
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hello' }] }),
  })
  assert.equal(res.status, 401)
})

test('missing tokens are rejected when auth is configured', async () => {
  const store = new MemoryApiKeyStore()
  const auth = await resolveAuth({ keyStore: store }, undefined)
  assert.equal(auth.ok, false)

  const { app } = appWith(store)
  const res = await app.request('/v1/models')
  assert.equal(res.status, 401)
})

test('bootstrap local-dev mode stays open while still resolving issued keys', async () => {
  const store = new MemoryApiKeyStore()
  const { key } = await store.issue({ tenantId: 'tenant-c', projectId: 'project-c' }, 1)
  const { app, provider } = appWith(store, true)

  const open = await app.request('/v1/models')
  assert.equal(open.status, 200)

  const keyed = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hello' }] }),
  })
  assert.equal(keyed.status, 200)
  assert.equal(provider.calls.length, 1)
  assert.equal(provider.calls[0]?.metadata?.tenantId, 'tenant-c')
  assert.equal(provider.calls[0]?.metadata?.projectId, 'project-c')
})

test('key store outage falls back to static api keys instead of failing auth', async () => {
  const unavailable = async (): Promise<never> => {
    throw new Error('supabase key resolve failed: 404 relation "api_keys" does not exist')
  }
  const brokenStore = {
    resolve: unavailable,
    issue: unavailable,
    revoke: unavailable,
    listAccounts: unavailable,
  } as unknown as MemoryApiKeyStore

  // Static-key bearer still authenticates despite the store throwing on every resolve.
  const auth = await resolveAuth({ apiKeys: ['static-key'], keyStore: brokenStore }, 'Bearer static-key')
  assert.equal(auth.ok, true)

  // Unknown tokens are still rejected.
  const bad = await resolveAuth({ apiKeys: ['static-key'], keyStore: brokenStore }, 'Bearer nope')
  assert.equal(bad.ok, false)

  // End-to-end: a completion succeeds on the static key while the store is down.
  const provider = mockProvider(async () => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' as const }))
  const app = createGatewayApp({
    candidates: [candidate('c', provider, [model('m')])],
    apiKeys: ['static-key'],
    keyStore: brokenStore,
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer static-key', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hello' }] }),
  })
  assert.equal(res.status, 200)
})