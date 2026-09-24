import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp, MemoryApiKeyStore } from '../src/gateway/index.js'
import {
  MemoryProjectSpendStore,
  SupabaseProjectSpendStore,
  parseProjectCaps,
  utcDay,
  nextUtcMidnight,
  type ProjectSpendStore,
} from '../src/gateway/project-caps.js'
import { candidate, mockProvider, model } from './helpers.js'

// $1 in + $1 out = $2 per call at the test model's pricing.
function usageProvider() {
  return mockProvider(() => ({
    content: 'hello',
    toolCalls: [],
    stopReason: 'end_turn',
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
  }))
}

async function setup(opts: { caps: Record<string, number>; store?: ProjectSpendStore; now?: () => number }) {
  const keyStore = new MemoryApiKeyStore()
  const store = opts.store ?? new MemoryProjectSpendStore()
  const pending: Promise<unknown>[] = []
  const app = createGatewayApp({
    candidates: [candidate('c', usageProvider(), [model('m')])],
    keyStore,
    projectCaps: { caps: opts.caps, store, now: opts.now, onPending: (p) => pending.push(p) },
  })
  const issue = async (projectId?: string) => (await keyStore.issue({ projectId }, Date.now())).key
  const chat = (key: string) =>
    app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    })
  const messages = (key: string) =>
    app.request('/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }),
    })
  const settle = () => Promise.all(pending.splice(0))
  return { app, store, issue, chat, messages, settle }
}

test('cap blocks only keys in the capped project, with a PayBox top-up steer', async () => {
  const t = await setup({ caps: { dinghy: 3 } })
  const capped = await t.issue('dinghy')
  const other = await t.issue('someone-else')
  const noProject = await t.issue()
  assert.equal((await t.chat(capped)).status, 200)
  await t.settle()
  assert.equal((await t.chat(capped)).status, 200) // $2 < $3
  await t.settle()
  const blocked = await t.chat(capped) // $4 >= $3
  assert.equal(blocked.status, 402)
  const body = (await blocked.json()) as { error: Record<string, unknown> }
  assert.equal(body.error.type, 'spend_ceiling_exceeded')
  assert.equal(body.error.cap, 'project_daily')
  assert.equal(body.error.projectId, 'dinghy')
  assert.equal(body.error.topUpUrl, 'https://app.paybox.sh')
  assert.match(String(body.error.message), /USDC to your PayBox wallet/)
  assert.match(String(body.error.message), /\$3\.00\/day/)
  // Other projects and project-less keys are untouched.
  assert.equal((await t.chat(other)).status, 200)
  assert.equal((await t.chat(noProject)).status, 200)
})

test('sibling keys in the same project share one cap', async () => {
  const t = await setup({ caps: { p: 3 } })
  const a = await t.issue('p')
  const b = await t.issue('p')
  assert.equal((await t.chat(a)).status, 200)
  await t.settle()
  assert.equal((await t.chat(b)).status, 200)
  await t.settle()
  assert.equal((await t.chat(a)).status, 402)
  assert.equal((await t.chat(b)).status, 402)
})

test('spend persists across gateway instances (cold start keeps the total)', async () => {
  const store = new MemoryProjectSpendStore()
  const t1 = await setup({ caps: { p: 3 }, store })
  const k1 = await t1.issue('p')
  await t1.chat(k1)
  await t1.chat(k1)
  await t1.settle()
  const t2 = await setup({ caps: { p: 3 }, store })
  const k2 = await t2.issue('p')
  assert.equal((await t2.chat(k2)).status, 402)
})

test('daily window rolls over at 00:00 UTC', async () => {
  let now = Date.parse('2026-09-23T23:59:00Z')
  const t = await setup({ caps: { p: 1 }, now: () => now })
  const k = await t.issue('p')
  assert.equal((await t.chat(k)).status, 200)
  await t.settle()
  assert.equal((await t.chat(k)).status, 402)
  now = Date.parse('2026-09-24T00:00:01Z')
  assert.equal((await t.chat(k)).status, 200)
})

test('Anthropic /v1/messages is capped too', async () => {
  const t = await setup({ caps: { p: 1 } })
  const k = await t.issue('p')
  assert.equal((await t.messages(k)).status, 200)
  await t.settle()
  const r = await t.messages(k)
  assert.equal(r.status, 402)
  const body = (await r.json()) as { type: string; error: { cap: string } }
  assert.equal(body.type, 'error')
  assert.equal(body.error.cap, 'project_daily')
})

test('a broken spend store fails open', async () => {
  const broken: ProjectSpendStore = {
    spent: async () => {
      throw new Error('db down')
    },
    add: async () => {
      throw new Error('db down')
    },
  }
  const t = await setup({ caps: { p: 0 }, store: broken })
  const k = await t.issue('p')
  assert.equal((await t.chat(k)).status, 200)
  await t.settle()
})

test('no caps configured means no behavior change', async () => {
  const t = await setup({ caps: {} })
  const k = await t.issue('p')
  for (let i = 0; i < 3; i++) assert.equal((await t.chat(k)).status, 200)
})

test('parseProjectCaps tolerates bad input', () => {
  assert.deepEqual(parseProjectCaps('{"a":10,"b":"2.5","c":"x","d":-1}'), { a: 10, b: 2.5 })
  assert.deepEqual(parseProjectCaps('not json'), {})
  assert.deepEqual(parseProjectCaps(undefined), {})
  assert.deepEqual(parseProjectCaps('[1]'), {})
})

test('utc day helpers', () => {
  assert.equal(utcDay(Date.parse('2026-09-24T03:30:00Z')), '2026-09-24')
  assert.equal(new Date(nextUtcMidnight(Date.parse('2026-09-23T23:59:59Z'))).toISOString(), '2026-09-24T00:00:00.000Z')
})

test('SupabaseProjectSpendStore reads the day row and increments via RPC', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.includes('/rpc/')) return new Response('4.5', { status: 200 })
    return Response.json([{ spent_usd: '2.25' }])
  }) as unknown as typeof fetch
  const s = new SupabaseProjectSpendStore({ url: 'https://x.supabase.co/', key: 'svc', fetch: fakeFetch })
  assert.equal(await s.spent('dinghy sandbox', '2026-09-24'), 2.25)
  assert.match(calls[0]!.url, /shipyard_spend_windows\?select=spent_usd&project_id=eq\.dinghy%20sandbox&window_start=eq\.2026-09-24/)
  assert.equal(await s.add('p', '2026-09-24', 0.5), 4.5)
  assert.match(calls[1]!.url, /\/rest\/v1\/rpc\/shipyard_spend_add$/)
  assert.deepEqual(JSON.parse(String(calls[1]!.init!.body)), { p_project_id: 'p', p_window_start: '2026-09-24', p_amount: 0.5 })
})
