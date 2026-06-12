import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp, resolveAuth, MemoryApiKeyStore } from '../src/gateway/index.js'
import { MemoryUsageRecorder } from '../src/index.js'
import { candidate, model, staticProvider } from './helpers.js'

test('MemoryApiKeyStore: issue → resolve → revoke (only the hash is stored)', () => {
  const store = new MemoryApiKeyStore()
  const { key, account } = store.issue({ wallet: 'W', label: 'cursor' }, 1)
  assert.match(key, /^sk-shipyard-/)
  assert.equal(store.resolve(key)?.wallet, 'W')
  assert.equal(store.resolve(key)?.userId, account.userId)
  assert.equal(store.resolve('sk-shipyard-nope'), undefined)
  assert.equal(store.revoke(key), true)
  assert.equal(store.resolve(key), undefined)
})

test('resolveAuth: per-user key → account; static keys compose; dev-open when neither set', () => {
  const store = new MemoryApiKeyStore()
  const { key } = store.issue({ userId: 'alice' }, 1)
  assert.equal(resolveAuth({ keyStore: store }, `Bearer ${key}`).account?.userId, 'alice')
  assert.equal(resolveAuth({ keyStore: store }, 'Bearer bad').ok, false)
  // static shared key still works alongside the store (no account attached)
  const shared = resolveAuth({ keyStore: store, apiKeys: ['shared'] }, 'Bearer shared')
  assert.equal(shared.ok, true)
  assert.equal(shared.account, undefined)
  // neither configured → auth disabled (dev convenience)
  assert.equal(resolveAuth({}, undefined).ok, true)
  // a store IS configured but no token → rejected
  assert.equal(resolveAuth({ keyStore: store }, undefined).ok, false)
})

test('gateway attributes a per-user key to its account (overriding the `user` field)', async () => {
  const store = new MemoryApiKeyStore()
  const { key } = store.issue({ userId: 'dev-1', wallet: 'WalletDev1' }, 1)
  const recorder = new MemoryUsageRecorder()
  const app = createGatewayApp({
    candidates: [
      candidate('c', staticProvider('hi'), [model('m', { inputCostPerMTok: 1, outputCostPerMTok: 1 })]),
    ],
    keyStore: store,
    usageRecorder: recorder,
  })

  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }], user: 'ide-user' }),
  })
  assert.equal(res.status, 200)
  const totals = recorder.totals()
  assert.ok(totals.perUser['dev-1'], 'attributed to the key account')
  assert.equal(totals.perUser['ide-user'], undefined, 'the IDE `user` field is overridden')

  const bad = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer sk-shipyard-nope', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(bad.status, 401)
})
