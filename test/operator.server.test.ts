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
