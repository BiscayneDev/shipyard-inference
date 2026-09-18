import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SupabaseDecisionFeedback } from '../src/router/supabase-decision-feedback.js'
import type { GuardrailResult } from '../src/gateway/config.js'

// SupabaseDecisionFeedback: persists tier decisions and guardrail outcomes as
// rows over PostgREST, keeps an in-memory floor, and reports by re-querying —
// falling back to the local view when Supabase is unreachable.

interface CapturedRequest {
  url: string
  method: string
  body: unknown
}

function mockSupabase(rows: Array<Record<string, unknown>> = []) {
  const requests: CapturedRequest[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (init?.method === 'POST') {
      const incoming = JSON.parse(String(init.body)) as Array<Record<string, unknown>>
      for (const r of incoming) {
        const existing = rows.findIndex((x) => x.request_id === r.request_id && x.kind === r.kind)
        if (existing >= 0) rows[existing] = { ...rows[existing], ...r }
        else rows.push(r)
      }
      return new Response(null, { status: 201 })
    }
    // GET: filter by kind + select columns (simplified PostgREST emulation)
    const params = new URL(url).searchParams
    const kind = params.get('kind')?.replace('eq.', '')
    const select = (params.get('select') ?? '').split(',')
    const matching = rows.filter((r) => r.kind === kind).map((r) => {
      const out: Record<string, unknown> = { request_id: r.request_id }
      for (const col of select) out[col] = r[col]
      return out
    })
    return new Response(JSON.stringify(matching), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { fetchImpl, requests, rows }
}

test('persists tier decisions and guardrail outcomes as rows, idempotently', async () => {
  const mock = mockSupabase()
  const fb = new SupabaseDecisionFeedback({ url: 'https://x.supabase.co', key: 'k', fetch: mock.fetchImpl })
  await fb.recordTier('req-1', { tier: 'economy', source: 'jev', confidence: 0.9, latencyMs: 120, usage: { inputTokens: 400, outputTokens: 60 } })
  await fb.recordTier('req-1', { tier: 'standard', source: 'jev' }) // same PK → merge-duplicates overwrites, never a second row
  await fb.recordGuardrail({ requestId: 'req-1', quality: 0.9, flagged: false })
  await fb.recordGuardrail({ requestId: 'req-1', quality: 0.8, flagged: false }) // idempotent

  const tierRows = mock.rows.filter((r) => r.kind === 'tier')
  const guardRows = mock.rows.filter((r) => r.kind === 'guardrail')
  assert.equal(tierRows.length, 1)
  assert.equal(guardRows.length, 1)
  // merge-duplicates: the later write wins per column, but request ids never double
  assert.equal(tierRows[0]!.tier, 'standard')
  assert.equal(tierRows[0]!.decision_input_tokens, 400)
})

test('report() aggregates the join across persisted rows', async () => {
  const mock = mockSupabase()
  const fb = new SupabaseDecisionFeedback({ url: 'https://x.supabase.co', key: 'k', fetch: mock.fetchImpl })
  await fb.recordTier('a', { tier: 'economy', source: 'jev', confidence: 0.9, latencyMs: 100, usage: { inputTokens: 300, outputTokens: 50 } })
  await fb.recordTier('b', { tier: 'frontier', source: 'structural', confidence: undefined })
  await fb.recordGuardrail({ requestId: 'a', quality: 0.5, flagged: true })
  await fb.recordGuardrail({ requestId: 'b', quality: 1.0, flagged: false })

  const report = await fb.report()
  assert.equal(report.tierDecisions, 2)
  assert.equal(report.joined, 2)
  assert.equal(report.jev.decisions, 1)
  assert.equal(report.jev.fallbacks, 1)
  assert.equal(report.jev.inputTokens, 300)
  assert.equal(report.perTier.economy!.avgQuality, 0.5)
  assert.equal(report.perTier.economy!.flaggedRate, 1)
  assert.equal(report.perTier.frontier!.avgQuality, 1)
  assert.equal(report.guardrails.evaluations, 2)
  assert.equal(report.guardrails.flagged, 1)
})

test('falls back to the in-memory view when Supabase is unreachable', async () => {
  const failing = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch
  const fb = new SupabaseDecisionFeedback({ url: 'https://x.supabase.co', key: 'k', fetch: failing })
  await fb.recordTier('x', { tier: 'standard', source: 'jev', confidence: 0.8 })
  await fb.recordGuardrail({ requestId: 'x', quality: 0.7, flagged: false })
  const report = await fb.report()
  assert.equal(report.tierDecisions, 1)
  assert.equal(report.joined, 1)
  assert.equal(report.perTier.standard!.avgQuality, 0.7)
})

test('insert failures never throw (observability must not break the request path)', async () => {
  const throwing = (async () => {
    throw new Error('network down')
  }) as typeof fetch
  const fb = new SupabaseDecisionFeedback({ url: 'https://x.supabase.co', key: 'k', fetch: throwing })
  await fb.recordTier('y', { tier: 'economy', source: 'jev' })
  await fb.recordGuardrail({ requestId: 'y', quality: 1, flagged: false })
  const report = await fb.report() // falls back to memory
  assert.equal(report.tierDecisions, 1)
})
