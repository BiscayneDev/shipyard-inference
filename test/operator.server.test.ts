import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TelemetryHub } from '../src/operator/hub.js'
import { createOperatorConsole, parseWindowMs } from '../src/operator/server.js'
import type { IngestPayload, Overview, TelemetryEvent } from '../src/operator/types.js'

const T = 1_700_000_000_000

function setup() {
  const hub = new TelemetryHub({ now: () => T })
  const app = createOperatorConsole({
    hub,
    ingestTokens: ['ing'],
    operatorTokens: ['op'],
  })
  return { hub, app }
}

const ingestBody = (events: TelemetryEvent[]): IngestPayload => ({ source: 'svc-a', events })

const req = (at: number): TelemetryEvent => ({
  kind: 'request',
  at,
  provider: 'p1',
  model: 'A',
  userId: 'u1',
  inputTokens: 10,
  outputTokens: 5,
  actualCostUsd: 0.001,
  baselineCostUsd: 0.003,
  savedUsd: 0.002,
  latencyMs: 100,
})

test('parseWindowMs understands shorthand and raw ms', () => {
  assert.equal(parseWindowMs('15m'), 900_000)
  assert.equal(parseWindowMs('6h'), 21_600_000)
  assert.equal(parseWindowMs('2d'), 172_800_000)
  assert.equal(parseWindowMs('60000'), 60_000)
  assert.equal(parseWindowMs(undefined), 3_600_000)
})

test('POST /ingest rejects a bad ingest token', async () => {
  const { app } = setup()
  const res = await app.request('/ingest', {
    method: 'POST',
    headers: { authorization: 'Bearer nope', 'content-type': 'application/json' },
    body: JSON.stringify(ingestBody([req(T)])),
  })
  assert.equal(res.status, 401)
})

test('GET /api/* requires the operator token', async () => {
  const { app } = setup()
  const res = await app.request('/api/overview', { headers: { authorization: 'Bearer ing' } })
  assert.equal(res.status, 401) // ingest token is not an operator token
})

test('ingest → query returns the expected aggregate', async () => {
  const { app } = setup()
  const ingest = await app.request('/ingest', {
    method: 'POST',
    headers: { authorization: 'Bearer ing', 'content-type': 'application/json' },
    body: JSON.stringify(ingestBody([req(T), req(T - 1), req(T - 2)])),
  })
  assert.equal(ingest.status, 200)
  assert.deepEqual(await ingest.json(), { accepted: 3 })

  const res = await app.request('/api/overview?window=1h', {
    headers: { authorization: 'Bearer op' },
  })
  assert.equal(res.status, 200)
  const o = (await res.json()) as Overview
  assert.equal(o.requests, 3)
  assert.equal(o.inputTokens, 30)
  assert.ok(Math.abs(o.savedUsd - 0.006) < 1e-9)

  // source filter narrows to a deployment
  const meta = await (await app.request('/api/meta', { headers: { authorization: 'Bearer op' } })).json()
  assert.deepEqual((meta as { sources: string[] }).sources, ['svc-a'])
})

test('the dashboard shell is served unauthenticated', async () => {
  const { app } = setup()
  const res = await app.request('/')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /text\/html/)
})
