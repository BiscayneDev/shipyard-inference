import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createTelemetryReporter,
  createInProcessReporter,
} from '../src/operator/reporter.js'
import { TelemetryHub } from '../src/operator/hub.js'
import type { RouterEvent } from '../src/router/router.js'
import type { IngestPayload, RequestEvent } from '../src/operator/types.js'

const completed: RouterEvent = {
  type: 'request_completed',
  candidateId: 'c1',
  model: 'm1',
  usage: { inputTokens: 10, outputTokens: 5 },
  actualCostUsd: 0.001,
  baselineCostUsd: 0.003,
  savedUsd: 0.002,
  userId: 'u1',
  latencyMs: 120,
  pinned: true,
}

function captureFetch(): { calls: IngestPayload[]; fetch: typeof fetch } {
  const calls: IngestPayload[] = []
  const fetch = (async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body) as IngestPayload)
    return { ok: true, status: 200 }
  }) as unknown as typeof fetch
  return { calls, fetch }
}

test('reporter normalizes RouterEvents and POSTs a tagged batch', async () => {
  const { calls, fetch } = captureFetch()
  const r = createTelemetryReporter({ url: 'http://hub', token: 't', source: 'svc-a', fetch })
  r.onEvent(completed)
  r.onEvent({ type: 'cache_hit', key: 'k' })
  r.onEvent({ type: 'route_error', candidateId: 'c1', attempt: 1, error: new Error('429 rate limit') })
  r.onEvent({ type: 'route_success', candidateId: 'c1', model: 'm1', attempt: 1 }) // dropped
  await r.flush()
  await r.close()

  assert.equal(calls.length, 1)
  assert.equal(calls[0].source, 'svc-a')
  const kinds = calls[0].events.map((e) => e.kind)
  assert.deepEqual(kinds, ['request', 'cache', 'error']) // route_success not forwarded
  const req = calls[0].events[0] as RequestEvent
  assert.equal(req.provider, 'c1')
  assert.equal(req.inputTokens, 10)
  assert.equal(req.savedUsd, 0.002)
  assert.equal(req.userId, 'u1')
  assert.equal(req.pinned, true) // pin flag threaded from the Router event
  const err = calls[0].events[2]
  assert.equal(err.kind, 'error')
  assert.match((err as { error: string }).error, /429 rate limit/)
})

test('recordSettlement enqueues a settlement event', async () => {
  const { calls, fetch } = captureFetch()
  const r = createTelemetryReporter({ url: 'http://hub', source: 'svc-a', fetch })
  r.recordSettlement({ userId: 'u1', amountUsd: 1.5, status: 'settled', signature: 'sig', network: 'devnet' })
  await r.flush()
  await r.close()
  const ev = calls[0].events[0]
  assert.equal(ev.kind, 'settlement')
  assert.equal((ev as { amountUsd: number }).amountUsd, 1.5)
})

test('delivery failures never throw into the hot path', async () => {
  let errors = 0
  const fetch = (async () => {
    throw new Error('network down')
  }) as unknown as typeof fetch
  const r = createTelemetryReporter({
    url: 'http://hub',
    source: 'svc-a',
    fetch,
    onError: () => errors++,
  })
  assert.doesNotThrow(() => r.onEvent(completed)) // enqueue is synchronous + safe
  await r.flush()
  await r.close()
  assert.equal(errors, 1)
})

test('in-process reporter feeds a hub directly', async () => {
  const hub = new TelemetryHub()
  const r = createInProcessReporter(hub, 'embedded')
  r.onEvent(completed)
  await r.flush()
  const o = hub.overview(3_600_000)
  assert.equal(o.requests, 1)
  assert.equal(hub.knownSources().join(), 'embedded')
  await r.close()
})
