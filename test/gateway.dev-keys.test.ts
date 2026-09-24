import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MemoryApiKeyStore,
  SupabaseApiKeyStore,
  maskKey,
  keyIdFromHash,
  hashApiKey,
  effectiveProjectId,
} from '../src/gateway/keys.js'
import {
  listDevKeys,
  createDevKey,
  revokeDevKey,
  relabelDevKey,
  MAX_ACTIVE_KEYS_PER_PROJECT,
} from '../src/gateway/dev-keys.js'

async function firstKey(store: MemoryApiKeyStore, label = 'first') {
  const issued = await store.issue({ label }, 1)
  const caller = (await store.resolve(issued.key))!
  return { ...issued, caller }
}

test('issued keys carry a public id and a masked form that never contains the key', async () => {
  const store = new MemoryApiKeyStore()
  const { key, account } = await store.issue({ label: 'x' }, 1)
  assert.equal(account.keyId, keyIdFromHash(hashApiKey(key)))
  const masked = maskKey(account)
  assert.ok(masked.startsWith('sk-shipyard-'))
  assert.ok(masked.endsWith(key.slice(-4)))
  assert.ok(!masked.includes(key.slice(16, -4)))
  assert.ok(masked.length < key.length)
  assert.equal(maskKey({}), 'sk-shipyard-…')
})

test('a first key anchors the project; created keys join it and are listed masked', async () => {
  const store = new MemoryApiKeyStore()
  const { key, caller } = await firstKey(store)
  const created = await createDevKey(store, caller, { label: '  staging   box ' }, 2)
  assert.equal(created.status, 201)
  const newKey = String(created.body.key)
  assert.ok(newKey.startsWith('sk-shipyard-') && newKey !== key)
  assert.equal(created.body.label, 'staging box')
  assert.equal(created.body.projectId, caller.userId)

  const list = await listDevKeys(store, caller)
  assert.equal(list.status, 200)
  const keys = list.body.keys as { id: string; masked: string; current: boolean; label: string }[]
  assert.equal(keys.length, 2)
  assert.equal(keys[0]!.label, 'staging box') // newest first
  assert.equal(keys.filter((k) => k.current).length, 1)
  assert.ok(!JSON.stringify(list.body).includes(key))
  assert.ok(!JSON.stringify(list.body).includes(newKey))

  // The new key sees the same project.
  const sibling = (await store.resolve(newKey))!
  assert.equal(effectiveProjectId(sibling), caller.userId)
  assert.equal(((await listDevKeys(store, sibling)).body.keys as unknown[]).length, 2)
})

test('keys from other developers are invisible and cannot be revoked or renamed', async () => {
  const store = new MemoryApiKeyStore()
  const a = await firstKey(store, 'a')
  const b = await firstKey(store, 'b')
  assert.equal(((await listDevKeys(store, a.caller)).body.keys as unknown[]).length, 1)
  assert.equal((await revokeDevKey(store, a.caller, b.account.keyId!)).status, 404)
  assert.equal((await relabelDevKey(store, a.caller, b.account.keyId!, { label: 'pwned' })).status, 404)
  assert.ok(await store.resolve(b.key))
})

test('revoke is soft, scoped, and stops the key from authenticating', async () => {
  const store = new MemoryApiKeyStore()
  const { caller } = await firstKey(store)
  const created = await createDevKey(store, caller, { label: 'temp' })
  const id = String(created.body.id)
  const r = await revokeDevKey(store, caller, id, 5)
  assert.equal(r.status, 200)
  assert.equal(r.body.self, false)
  assert.equal(await store.resolve(String(created.body.key)), undefined)
  const keys = (await listDevKeys(store, caller)).body.keys as { id: string; status: string; revokedAt: number }[]
  const row = keys.find((k) => k.id === id)!
  assert.equal(row.status, 'revoked')
  assert.equal(row.revokedAt, 5)
  assert.equal((await revokeDevKey(store, caller, id)).status, 404) // already revoked
})

test('rename requires a label', async () => {
  const store = new MemoryApiKeyStore()
  const { caller, account } = await firstKey(store)
  assert.equal((await relabelDevKey(store, caller, account.keyId!, {})).status, 400)
  assert.equal((await relabelDevKey(store, caller, account.keyId!, { label: 'prod' })).status, 200)
  const keys = (await listDevKeys(store, caller)).body.keys as { label: string }[]
  assert.equal(keys[0]!.label, 'prod')
})

test('active key count per project is capped', async () => {
  const store = new MemoryApiKeyStore()
  const { caller } = await firstKey(store)
  for (let i = 1; i < MAX_ACTIVE_KEYS_PER_PROJECT; i++) {
    assert.equal((await createDevKey(store, caller, { label: `k${i}` })).status, 201)
  }
  assert.equal((await createDevKey(store, caller, {})).status, 409)
})

test('stores without project support answer 501', async () => {
  const store = {
    resolve: async () => undefined,
    issue: async () => {
      throw new Error('no')
    },
    revoke: async () => false,
    listAccounts: async () => [],
  }
  const caller = { userId: 'u', status: 'active' as const, createdAt: 1 }
  assert.equal((await listDevKeys(store, caller)).status, 501)
  assert.equal((await createDevKey(store, caller, {})).status, 501)
  assert.equal((await revokeDevKey(store, caller, 'k_0')).status, 501)
})

test('SupabaseApiKeyStore: project list, scoped revoke, and pre-migration issue fallback', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  let failDisplay = true
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const method = init?.method ?? 'GET'
    if (method === 'POST') {
      const row = JSON.parse(String(init!.body))[0]
      if (failDisplay && 'key_prefix' in row) {
        return new Response('{"code":"PGRST204","message":"Could not find the \'key_prefix\' column"}', { status: 400 })
      }
      return new Response(null, { status: 201 })
    }
    if (method === 'PATCH') return Response.json([{ key_hash: 'abcdef0123456789ffff', user_id: 'u2' }])
    return Response.json([
      { key_hash: 'abcdef0123456789ffff', user_id: 'u2', tenant_id: null, project_id: 'u1', wallet: null, label: 'x', scopes: null, status: 'active', created_at: 2, revoked_at: null, key_prefix: 'sk-shipyard-AbCd', last4: 'wxyz' },
    ])
  }) as unknown as typeof fetch
  const s = new SupabaseApiKeyStore({ url: 'https://x.supabase.co', key: 'svc', fetch: fakeFetch })

  const issued = await s.issue({ label: 'l' }, 1)
  assert.ok(issued.key)
  assert.equal(issued.account.keyPrefix, undefined) // fell back without display columns
  assert.equal(calls.filter((c) => c.init?.method === 'POST').length, 2)
  failDisplay = false
  const issued2 = await s.issue({ label: 'l' }, 1)
  assert.ok(issued2.account.keyPrefix)

  const list = await s.listProject('u1')
  assert.equal(list[0]!.keyId, 'k_abcdef0123456789')
  assert.equal(maskKey(list[0]!), 'sk-shipyard-AbCd…wxyz')
  assert.match(calls.at(-1)!.url, /or=\(project_id\.eq\.u1,and\(project_id\.is\.null,user_id\.eq\.u1\)\)/)

  assert.equal(await s.revokeInProject('u1', 'k_abcdef0123456789', 9), true)
  const patch = calls.at(-1)!
  assert.match(patch.url, /key_hash=like\.abcdef0123456789\*/)
  assert.match(patch.url, /status=eq\.active/)
  assert.deepEqual(JSON.parse(String(patch.init!.body)), { status: 'revoked', revoked_at: 9 })
  // Malformed ids never reach the database.
  const before = calls.length
  assert.equal(await s.revokeInProject('u1', 'k_*', 9), false)
  assert.equal(calls.length, before)
})
