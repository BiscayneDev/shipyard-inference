import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOperatorConsole, TelemetryHub } from '../src/operator/index.js'

const now = 1_700_000_000_000

test('operator exposes a signed savings report for a window', async () => {
  const hub = new TelemetryHub({ now: () => now })
  await hub.ingest('gateway-a', [
    {
      kind: 'request',
      at: now - 1_000,
      source: 'gateway-a',
      provider: 'cheap',
      model: 'cheap',
      userId: 'alice',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      actualCostUsd: 2.1,
      baselineCostUsd: 50,
      savedUsd: 47.9,
      latencyMs: 100,
      pinned: false,
      baselineModel: 'premium-default',
      requestClass: 'general',
      routingSavingsUsd: 45.8,
      cachingSavingsUsd: 2.1,
      compressionSavingsUsd: 0,
    } as any,
  ])

  const app = createOperatorConsole({ hub, operatorTokens: [], ingestTokens: [] })
  const res = await app.request('/api/reports/savings?window=1h')
  assert.equal(res.status, 200)
  const report = await res.json()
  assert.equal(report.baselineModel, 'premium-default')
  assert.equal(report.requestClass, 'general')
  assert.equal(report.signature.length > 0, true)
  assert.equal(report.savedUsd, 47.9)
  assert.equal(report.routingSavingsUsd, 45.8)
  assert.equal(report.cachingSavingsUsd, 2.1)
})

// --- appliance advisor endpoint (Lighthouse) ---

test('GET /api/appliance returns hardware ladder and ollama state', async () => {
  const hub = new TelemetryHub({ now: () => now })
  const app = createOperatorConsole({ hub, operatorTokens: [], ingestTokens: [] })
  const res = await app.request('/api/appliance')
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    at: number
    hardware: { chip: string; totalRamGb: number } | null
    maxParametersB: number
    ladderSource: string
    ollamaUp: boolean
    available: Array<{ model: string }>
    missing: string[]
  }
  // On the CI/dev machine the probe either works or degrades — both valid.
  if (body.hardware) {
    assert.ok(body.hardware.totalRamGb > 0)
    assert.ok(body.maxParametersB >= 3)
    assert.equal(body.ladderSource, 'probed')
  } else {
    assert.equal(body.ladderSource, 'fallback')
    assert.equal(body.maxParametersB, 3)
  }
  assert.ok(Array.isArray(body.available))
  assert.ok(Array.isArray(body.missing))
})

test('GET /api/feed carries failover receipts', async () => {
  const hub = new TelemetryHub({ now: () => now })
  await hub.ingest('gw', [
    { kind: 'failover', at: now - 2, source: 'gw', provider: 'p1', model: 'A', error: 'HTTP 429' } as any,
    { kind: 'request', at: now - 1, source: 'gw', provider: 'p2', model: 'B', inputTokens: 1, outputTokens: 1, latencyMs: 10 } as any,
  ])
  const app = createOperatorConsole({ hub, operatorTokens: [], ingestTokens: [] })
  const res = await app.request('/api/feed?limit=10')
  const rows = (await res.json()) as Array<{ failover?: { from: string; error?: string } }>
  assert.ok(rows.length >= 1)
  assert.equal(rows[0].failover?.from, 'p1')
  assert.equal(rows[0].failover?.error, 'HTTP 429')
})
