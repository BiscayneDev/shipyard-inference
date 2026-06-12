import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createGatewayApp,
  resolveAuth,
  MemoryApiKeyStore,
  SupabaseApiKeyStore,
  hashApiKey,
} from '../src/gateway/index.js'
import { MemoryUsageRecorder } from '../src/index.js'
import { candidate, model, staticProvider } from './helpers.js'

test('MemoryApiKeyStore: issue → resolve → revoke (only the hash is stored)', async () => {
  const store = new MemoryApiKeyStore()
  const { key, account } = await store.issue({ wallet: 'W', label: 'cursor' }, 1)
  assert.match(key, /^sk-shipyard-/)
  assert.equal((await store.resolve(key))?.wallet, 'W')
  assert.equal((await store.resolve(key))?.userId, account.userId)
  assert.equal(await store.resolve('sk-shipyard-nope'), undefined)
  assert.equal(await store.revoke(key), true)
  assert.equal(await store.resolve(key), undefined)
})

test('resolveAuth: per-user key → account; static keys compose; dev-open when neither set', async () => {
  const store = new MemoryApiKeyStore()
  const { key } = await store.issue({ userId: 'alice' }, 1)
  assert.equal((await resolveAuth({ keyStore: store }, `Bearer ${key}`)).account?.userId, 'alice')
  assert.equal((await resolveAuth({ keyStore: store }, 'Bearer bad')).ok, false)
  // static shared key still works alongside the store (no account attached)
  const shared = await resolveAuth({ keyStore: store, apiKeys: ['shared'] }, 'Bearer shared')
  assert.equal(shared.ok, true)
  assert.equal(shared.account, undefined)
  // neither configured → auth disabled (dev convenience)
  assert.equal((await resolveAuth({}, undefined)).ok, true)
  // a store IS configured but no token → rejected
  assert.equal((await resolveAuth({ keyStore: store }, undefined)).ok, false)
})

test('gateway attributes a per-user key to its account (overriding the `user` field)', async () => {
  const store = new MemoryApiKeyStore()
  const { key } = await store.issue({ userId: 'dev-1', wallet: 'WalletDev1' }, 1)
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

test('SupabaseApiKeyStore: issues via POST, resolves by hash, caches the hit', async () => {
  const rows: Record<string, { user_id: string; wallet: string | null; label: string | null; created_at: number }> = {}
  let selectCalls = 0
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Array<{ key_hash: string } & KeyRowT>
      for (const r of body) rows[r.key_hash] = { user_id: r.user_id, wallet: r.wallet, label: r.label, created_at: r.created_at }
      return new Response(null, { status: 201 })
    }
    selectCalls++
    const m = u.match(/key_hash=eq\.([0-9a-f]+)/)
    const row = m ? rows[m[1]] : undefined
    return new Response(JSON.stringify(row ? [row] : []), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  type KeyRowT = { user_id: string; wallet: string | null; label: string | null; created_at: number }

  const store = new SupabaseApiKeyStore({ url: 'https://x.supabase.co', key: 'svc', fetch: fetchImpl })
  const { key, account } = await store.issue({ userId: 'dev-9', wallet: 'W9' }, 5)
  assert.equal(account.userId, 'dev-9')
  assert.equal(Object.keys(rows)[0], hashApiKey(key))

  assert.equal((await store.resolve(key))?.wallet, 'W9') // DB hit
  assert.equal((await store.resolve(key))?.userId, 'dev-9') // cache hit
  assert.equal(selectCalls, 1, 'second resolve served from the TTL cache')
  assert.equal(await store.resolve('sk-shipyard-unknown'), undefined)
})
