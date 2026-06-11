import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeBreakdown,
  computeOverview,
  computeRoutingHealth,
  computeSettlements,
  modeledRevenueUsd,
} from '../src/operator/aggregate.js'
import type { StoredEvent } from '../src/operator/types.js'

const T = 1_700_000_000_000
const near = (a: number, b: number, eps = 1e-9): void =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`)

function fixture(): StoredEvent[] {
  return [
    { kind: 'request', at: T, source: 's1', provider: 'p1', model: 'A', userId: 'u1', inputTokens: 100, outputTokens: 50, actualCostUsd: 0.001, baselineCostUsd: 0.004, savedUsd: 0.003, latencyMs: 200 },
    { kind: 'request', at: T + 1, source: 's1', provider: 'p1', model: 'A', userId: 'u2', inputTokens: 200, outputTokens: 80, actualCostUsd: 0.002, baselineCostUsd: 0.005, savedUsd: 0.003, latencyMs: 400 },
    { kind: 'request', at: T + 2, source: 's2', provider: 'p2', model: 'B', userId: 'u1', inputTokens: 50, outputTokens: 20, actualCostUsd: 0.0005, baselineCostUsd: 0.002, savedUsd: 0.0015, latencyMs: 900 },
    { kind: 'error', at: T + 3, source: 's2', provider: 'p2', model: 'B', error: 'boom' },
    { kind: 'failover', at: T + 4, source: 's1', provider: 'p1', model: 'A', error: '429' },
    { kind: 'retry', at: T + 5, source: 's1', provider: 'p1', model: 'A', retryAttempt: 1, delayMs: 50 },
    { kind: 'cache', at: T + 6, source: 's1', hit: true },
    { kind: 'cache', at: T + 7, source: 's1', hit: true },
    { kind: 'cache', at: T + 8, source: 's2', hit: false },
  ]
}

test('modeledRevenueUsd caps actual+margin at the baseline', () => {
  near(modeledRevenueUsd(0.001, 0.004, 15), 0.00115) // 1.15× under baseline
  near(modeledRevenueUsd(0.01, 0.005, 15), 0.005) // capped at baseline
  near(modeledRevenueUsd(0.001, undefined, 15), 0.00115) // no baseline → just margin
  near(modeledRevenueUsd(undefined, 0.005, 15), 0) // unpriced → no revenue
})

test('computeOverview rolls up traffic, savings, revenue, and percentiles', () => {
  const o = computeOverview(fixture(), 3_600_000, T + 9, 15)
  assert.equal(o.requests, 3)
  assert.equal(o.inputTokens, 350)
  assert.equal(o.outputTokens, 150)
  near(o.actualCostUsd, 0.0035)
  near(o.baselineCostUsd, 0.011)
  near(o.savedUsd, 0.0075)
  near(o.savingsPct, 0.0075 / 0.011)
  near(o.revenueUsd, 0.00115 + 0.0023 + 0.000575)
  near(o.marginUsd, o.revenueUsd - 0.0035)
  // latencies [200,400,900] → nearest-rank
  assert.equal(o.latencyP50Ms, 400)
  assert.equal(o.latencyP95Ms, 900)
  // attempt-level health
  assert.equal(o.errors, 1)
  assert.equal(o.failovers, 1)
  assert.equal(o.retries, 1)
  near(o.errorRate, 1 / 4)
  near(o.failoverRate, 1 / 3)
  near(o.cacheHitRate, 2 / 3)
  assert.equal(o.users, 2)
  assert.equal(o.sources, 2)
})

test('computeBreakdown groups by model and attributes errors', () => {
  const rows = computeBreakdown(
    fixture(),
    (e) => e.model ?? 'unknown',
    15,
    (e) => ('model' in e ? e.model : undefined),
  )
  const a = rows.find((r) => r.key === 'A')!
  const b = rows.find((r) => r.key === 'B')!
  assert.equal(a.requests, 2)
  near(a.actualCostUsd, 0.003)
  near(a.savedUsd, 0.006)
  assert.equal(a.avgLatencyMs, 300)
  assert.equal(a.failovers, 1) // failover on model A attributed
  assert.equal(b.requests, 1)
  assert.equal(b.errors, 1) // error on model B attributed
})

test('computeRoutingHealth reports availability + selection mix', () => {
  const h = computeRoutingHealth(fixture())
  assert.equal(h.autoRequests, 3)
  assert.equal(h.pinnedRequests, 0)
  const p2 = h.providers.find((p) => p.provider === 'p2')!
  near(p2.availability, 1 / 2) // 1 request, 1 error
  const top = h.selections[0]
  assert.equal(top.key, 'A')
  assert.equal(top.count, 2)
})

test('computeSettlements sums settled + counts stuck', () => {
  const events: StoredEvent[] = [
    { kind: 'settlement', at: T, source: 's1', amountUsd: 1.5, status: 'settled', signature: 'sig1', network: 'devnet' },
    { kind: 'settlement', at: T + 1, source: 's1', amountUsd: 0.5, status: 'failed', error: 'nope' },
    { kind: 'settlement', at: T + 2, source: 's2', amountUsd: 2, status: 'frozen' },
  ]
  const { rows, settledUsd, stuck } = computeSettlements(events, 100)
  near(settledUsd, 1.5)
  assert.equal(stuck, 2)
  assert.equal(rows[0].at, T + 2) // newest first
})
