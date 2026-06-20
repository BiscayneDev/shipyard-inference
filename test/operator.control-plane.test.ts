import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildSavingsSnapshot,
  buildSlaSummary,
  JsonlControlPlaneStore,
} from '../src/operator/index.js'
import type { Overview } from '../src/operator/types.js'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'shipyard-cp-'))
}

const overview: Overview = {
  windowMs: 3_600_000,
  at: 1_700_000_000_000,
  requests: 2,
  rpm: 2,
  inputTokens: 300,
  outputTokens: 120,
  tpm: 420,
  errors: 1,
  failovers: 1,
  retries: 0,
  cacheHits: 4,
  cacheMisses: 1,
  cacheHitRate: 0.8,
  failoverRate: 0.5,
  errorRate: 0.3333333333,
  actualCostUsd: 0.25,
  baselineCostUsd: 0.4,
  savedUsd: 0.15,
  savingsPct: 0.375,
  revenueUsd: 0.3,
  marginUsd: 0.05,
  marginPct: 0.1666666667,
  latencyP50Ms: 120,
  latencyP95Ms: 220,
  latencyP99Ms: 260,
  users: 1,
  sources: 1,
}

test('control-plane JSONL store persists and scopes by tenant/project', async () => {
  const dir = tmp()
  try {
    const store = new JsonlControlPlaneStore(dir)
    await store.append([
      {
        kind: 'tenant',
        id: 'tenant-1',
        name: 'Tenant One',
        createdAt: 10,
      },
      {
        kind: 'project',
        id: 'project-1',
        tenantId: 'tenant-1',
        name: 'Project One',
        createdAt: 20,
      },
      {
        kind: 'api_key',
        id: 'key-1',
        tenantId: 'tenant-1',
        projectId: 'project-1',
        keyHash: 'hash-1',
        createdAt: 30,
      },
      {
        kind: 'billing_plan',
        id: 'plan-1',
        tenantId: 'tenant-1',
        name: 'Pro',
        createdAt: 40,
        monthlyCommitUsd: 100,
      },
      {
        kind: 'usage',
        at: 50,
        tenantId: 'tenant-1',
        projectId: 'project-1',
        apiKeyId: 'key-1',
        source: 'gateway-a',
        model: 'sonnet',
        inputTokens: 100,
        outputTokens: 20,
        actualCostUsd: 0.12,
        baselineCostUsd: 0.18,
        savedUsd: 0.06,
        latencyMs: 90,
      },
      buildSavingsSnapshot({
        tenantId: 'tenant-1',
        projectId: 'project-1',
        windowMs: 3_600_000,
        at: 60,
        overview,
      }),
      buildSlaSummary({
        tenantId: 'tenant-1',
        projectId: 'project-1',
        windowMs: 3_600_000,
        at: 70,
        overview,
      }),
      {
        kind: 'tenant',
        id: 'tenant-2',
        name: 'Tenant Two',
        createdAt: 100,
      },
      {
        kind: 'project',
        id: 'project-2',
        tenantId: 'tenant-2',
        name: 'Project Two',
        createdAt: 110,
      },
      {
        kind: 'usage',
        at: 120,
        tenantId: 'tenant-2',
        projectId: 'project-2',
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 10,
      },
    ])
    await store.close()

    const fresh = new JsonlControlPlaneStore(dir)
    const tenantScope = await fresh.query({ tenantId: 'tenant-1' })
    assert.deepEqual(
      tenantScope.map((r) => r.kind),
      ['tenant', 'project', 'api_key', 'billing_plan', 'usage', 'savings_snapshot', 'sla_summary'],
    )

    const projectScope = await fresh.query({ projectId: 'project-1' })
    assert.equal(projectScope.every((r) => 'tenantId' in r ? r.tenantId === 'tenant-1' : r.id === 'tenant-1' || r.id === 'project-1'), true)
    assert.equal(projectScope.some((r) => r.kind === 'billing_plan'), true)

    const billing = await fresh.billingSummary({ tenantId: 'tenant-1', windowMs: 3_600_000 })
    assert.equal(billing.tenantId, 'tenant-1')
    assert.equal(billing.projectId, undefined)
    assert.equal(billing.requests, 1)
    assert.equal(billing.inputTokens, 100)
    assert.equal(billing.outputTokens, 20)
    assert.equal(billing.actualCostUsd, 0.12)
    assert.equal(billing.baselineCostUsd, 0.18)
    assert.equal(billing.savedUsd, 0.06)
    assert.equal(billing.plan?.name, 'Pro')
    assert.equal(billing.savingsSnapshot?.kind, 'savings_snapshot')
    assert.equal(billing.sla?.kind, 'sla_summary')

    await fresh.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hub snapshot helpers preserve the billing metadata', () => {
  const snapshot = buildSavingsSnapshot({
    tenantId: 'tenant-3',
    projectId: 'project-3',
    windowMs: 86_400_000,
    at: 123,
    overview,
  })
  const sla = buildSlaSummary({
    tenantId: 'tenant-3',
    projectId: 'project-3',
    windowMs: 86_400_000,
    at: 456,
    overview,
  })

  assert.equal(snapshot.tenantId, 'tenant-3')
  assert.equal(snapshot.projectId, 'project-3')
  assert.equal(snapshot.savedUsd, overview.savedUsd)
  assert.equal(sla.tenantId, 'tenant-3')
  assert.equal(sla.projectId, 'project-3')
  assert.equal(sla.requests, overview.requests)
  assert.equal(sla.errorRatePct, overview.errorRate * 100)
})
