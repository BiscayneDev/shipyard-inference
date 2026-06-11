import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SupabaseTelemetryStore } from '../src/operator/supabase-store.js'
import type { StoredEvent } from '../src/operator/index.js'

function req(at: number, source = 'test'): StoredEvent {
  return {
    kind: 'request',
    at,
    source,
    inputTokens: 1,
    outputTokens: 1,
    latencyMs: 10,
  }
}

test('append POSTs lifted columns + full event to PostgREST', async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response('', { status: 201 })
  }) as unknown as typeof fetch

  const store = new SupabaseTelemetryStore({
    url: 'https://proj.supabase.co/',
    key: 'svc-key',
    fetch: fakeFetch,
  })
  await store.append([req(100), req(200, 'other')])

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://proj.supabase.co/rest/v1/telemetry_events')
  assert.equal(calls[0].init.method, 'POST')
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers.apikey, 'svc-key')
  assert.equal(headers.authorization, 'Bearer svc-key')
  const body = JSON.parse(calls[0].init.body as string)
  assert.equal(body.length, 2)
  assert.deepEqual(
    body.map((r: { at: number; source: string; kind: string }) => [r.at, r.source, r.kind]),
    [
      [100, 'test', 'request'],
      [200, 'other', 'request'],
    ],
  )
  assert.equal(body[0].event.inputTokens, 1) // full event preserved in jsonb column
})

test('append is a no-op on empty input (no request)', async () => {
  let called = false
  const fakeFetch = (async () => {
    called = true
    return new Response('', { status: 201 })
  }) as unknown as typeof fetch
  const store = new SupabaseTelemetryStore({ url: 'https://p.supabase.co', key: 'k', fetch: fakeFetch })
  await store.append([])
  assert.equal(called, false)
})

test('replay range-filters by `since`, orders by at, and pages until drained', async () => {
  // 2300 rows newer than `since`; PostgREST returns at most pageSize=1000 per call.
  const all = Array.from({ length: 2300 }, (_, i) => req(1000 + i))
  const seen: string[] = []
  const fakeFetch = (async (url: string | URL | Request) => {
    const u = new URL(String(url))
    seen.push(u.searchParams.get('offset') + ':' + u.searchParams.get('limit'))
    assert.equal(u.searchParams.get('at'), 'gte.500')
    assert.equal(u.searchParams.get('order'), 'at.asc')
    const offset = Number(u.searchParams.get('offset'))
    const limit = Number(u.searchParams.get('limit'))
    const page = all.slice(offset, offset + limit).map((event) => ({ event }))
    return new Response(JSON.stringify(page), { status: 200 })
  }) as unknown as typeof fetch

  const store = new SupabaseTelemetryStore({ url: 'https://p.supabase.co', key: 'k', fetch: fakeFetch })
  const out = await store.replay(500)

  assert.equal(out.length, 2300)
  assert.equal(out[0].at, 1000)
  assert.equal(out[out.length - 1].at, 3299)
  assert.deepEqual(seen, ['0:1000', '1000:1000', '2000:1000']) // last short page ends the loop
})

test('append surfaces a failed write', async () => {
  const fakeFetch = (async () =>
    new Response('boom', { status: 500 })) as unknown as typeof fetch
  const store = new SupabaseTelemetryStore({ url: 'https://p.supabase.co', key: 'k', fetch: fakeFetch })
  await assert.rejects(() => store.append([req(1)]), /supabase append failed: 500/)
})
