import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonlTelemetryStore } from '../src/operator/store.js'
import { TelemetryHub } from '../src/operator/hub.js'
import type { StoredEvent } from '../src/operator/types.js'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'shipyard-op-'))
}

const T = 1_700_000_000_000
const reqs = (at: number, n: number, source = 's1'): StoredEvent[] =>
  Array.from({ length: n }, (_, i) => ({
    kind: 'request' as const,
    at: at + i,
    source,
    model: 'A',
    inputTokens: 10,
    outputTokens: 5,
    actualCostUsd: 0.001,
    baselineCostUsd: 0.003,
    savedUsd: 0.002,
    latencyMs: 100,
  }))

test('JsonlTelemetryStore appends and replays the recent window', async () => {
  const dir = tmp()
  try {
    const store = new JsonlTelemetryStore(dir)
    await store.append(reqs(T, 3))
    await store.close()

    const fresh = new JsonlTelemetryStore(dir)
    const replayed = await fresh.replay(T - 1000)
    assert.equal(replayed.length, 3)
    assert.equal(replayed[0].at, T)
    // events older than `since` are filtered out
    const recent = await fresh.replay(T + 1)
    assert.equal(recent.length, 2)
    await fresh.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hub.boot() rebuilds aggregates from the store after a restart', async () => {
  const dir = tmp()
  try {
    const now = () => T + 1000
    const store1 = new JsonlTelemetryStore(dir)
    const hub1 = new TelemetryHub({ store: store1, now })
    await hub1.ingest('s1', reqs(T, 4))
    await hub1.close()

    const hub2 = new TelemetryHub({ store: new JsonlTelemetryStore(dir), now })
    await hub2.boot()
    const o = hub2.overview(3_600_000)
    assert.equal(o.requests, 4)
    assert.equal(hub2.knownSources().join(), 's1')
    await hub2.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hub prunes events outside the retention window', async () => {
  const now = () => T + 10_000
  const hub = new TelemetryHub({ retentionMs: 5000, now })
  await hub.ingest('s1', reqs(T, 2)) // at T — older than retention (now-5000 = T+5000)
  await hub.ingest('s1', reqs(T + 9000, 3)) // within retention
  const o = hub.overview(3_600_000)
  assert.equal(o.requests, 3) // the 2 stale ones were pruned
})
