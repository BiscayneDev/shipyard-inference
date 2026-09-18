import { MemoryDecisionFeedback, type DecisionFeedbackReport, type TierDecisionRecord } from './decision-feedback.js'
import type { GuardrailResult } from '../gateway/config.js'

/**
 * Serverless-persistent {@link DecisionFeedbackRecorder}: writes each tier
 * decision and guardrail outcome as a row in Supabase (PostgREST over plain
 * `fetch`), so the judgment loop accumulates across cold starts and instances.
 * `report()` computes the aggregate in SQL so the endpoint reflects ALL
 * traffic, not just the current warm instance. Falls back to an in-memory
 * {@link MemoryDecisionFeedback} when Supabase env vars are absent (local
 * dev) — the same tiering as every other store in this repo.
 *
 * Schema (see {@link SUPABASE_DECISION_FEEDBACK_SCHEMA}):
 *
 *   decision_feedback(
 *     request_id text primary key,
 *     kind       text not null,          -- 'tier' | 'guardrail'
 *     tier       text, source text, jev_tier text, structural_tier text,
 *     confidence double precision, needs_reasoning double precision,
 *     latency_ms bigint, decided_by text, cached boolean,
 *     decision_input_tokens bigint, decision_output_tokens bigint,
 *     model text, unsafe double precision, quality double precision,
 *     flagged boolean, judged_by text,
 *     at bigint not null
 *   )
 *
 * `request_id` is the primary key and rows are written idempotently per kind
 * (the router emits `tier_decided` once per request; guardrails once per
 * completion), so retries never double-count.
 */
export interface SupabaseDecisionFeedbackOptions {
  /** Project URL, e.g. `https://abcd.supabase.co`. */
  url: string
  /** Service-role (or a key with insert+select on the table) key. */
  key: string
  /** Table name. Default `decision_feedback`. */
  table?: string
  /** Injectable fetch (tests). Defaults to global `fetch`. */
  fetch?: typeof fetch
}

interface FeedbackRow {
  request_id: string
  kind: 'tier' | 'guardrail'
  tier?: string
  source?: string
  jev_tier?: string
  structural_tier?: string
  confidence?: number
  needs_reasoning?: number
  latency_ms?: number
  decided_by?: string
  cached?: boolean
  decision_input_tokens?: number
  decision_output_tokens?: number
  model?: string
  unsafe?: number
  quality?: number
  flagged?: boolean
  judged_by?: string
  at: number
}

/** One-time schema; apply via the Supabase SQL editor or a migration. */
export const SUPABASE_DECISION_FEEDBACK_SCHEMA = `
create table if not exists decision_feedback (
  request_id               text not null,
  kind                     text not null,
  tier                     text,
  source                   text,
  jev_tier                 text,
  structural_tier          text,
  confidence               double precision,
  needs_reasoning          double precision,
  latency_ms               bigint,
  decided_by               text,
  cached                   boolean,
  decision_input_tokens    bigint,
  decision_output_tokens   bigint,
  model                    text,
  unsafe                   double precision,
  quality                  double precision,
  flagged                  boolean,
  judged_by                text,
  at                       bigint not null,
  primary key (request_id, kind)
);
create index if not exists decision_feedback_at_idx on decision_feedback (at);
create index if not exists decision_feedback_tier_idx on decision_feedback (kind, tier);
`

export class SupabaseDecisionFeedback {
  private readonly base: string
  private readonly table: string
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof fetch
  /** Local fallback when Supabase is not configured. */
  private readonly local: MemoryDecisionFeedback

  constructor(opts: SupabaseDecisionFeedbackOptions) {
    if (!opts.url) throw new Error('SupabaseDecisionFeedback: `url` is required')
    if (!opts.key) throw new Error('SupabaseDecisionFeedback: `key` is required')
    this.base = opts.url.replace(/\/+$/, '') + '/rest/v1'
    this.table = opts.table || 'decision_feedback'
    this.fetchImpl = opts.fetch ?? fetch
    this.headers = {
      apikey: opts.key,
      authorization: `Bearer ${opts.key}`,
      'content-type': 'application/json',
    }
    this.local = new MemoryDecisionFeedback()
  }

  async recordTier(requestId: string, record: TierDecisionRecord): Promise<void> {
    this.local.recordTier(requestId, record)
    const row: FeedbackRow = {
      request_id: requestId,
      kind: 'tier',
      at: Date.now(),
      tier: record.tier,
      source: record.source,
      ...(record.jevTier !== undefined ? { jev_tier: record.jevTier } : {}),
      ...(record.structuralTier !== undefined ? { structural_tier: record.structuralTier } : {}),
      ...(record.confidence !== undefined ? { confidence: record.confidence } : {}),
      ...(record.needsReasoning !== undefined ? { needs_reasoning: record.needsReasoning } : {}),
      ...(record.latencyMs !== undefined ? { latency_ms: Math.round(record.latencyMs) } : {}),
      ...(record.decidedBy !== undefined ? { decided_by: record.decidedBy } : {}),
      ...(record.cached !== undefined ? { cached: record.cached } : {}),
      ...(record.usage ? { decision_input_tokens: record.usage.inputTokens, decision_output_tokens: record.usage.outputTokens } : {}),
    }
    await this.insert(row)
  }

  async recordGuardrail(result: GuardrailResult): Promise<void> {
    this.local.recordGuardrail(result)
    const row: FeedbackRow = {
      request_id: result.requestId,
      kind: 'guardrail',
      at: Date.now(),
      ...(result.model !== undefined ? { model: result.model } : {}),
      ...(result.unsafe !== undefined ? { unsafe: result.unsafe } : {}),
      ...(result.quality !== undefined ? { quality: result.quality } : {}),
      ...(result.flagged !== undefined ? { flagged: result.flagged } : {}),
      ...(result.judgedBy !== undefined ? { judged_by: result.judgedBy } : {}),
    }
    await this.insert(row)
  }

  private async insert(row: FeedbackRow): Promise<void> {
    // Never let a persistence failure take a request down or spam logs — the
    // judgment loop is observability, not a dependency (same posture as the
    // guardrail evaluator). The in-memory fallback keeps this instance honest.
    try {
      const res = await this.fetchImpl(`${this.base}/${this.table}`, {
        method: 'POST',
        headers: { ...this.headers, prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([row]),
      })
      if (!res.ok) throw new Error(`supabase insert failed: ${res.status}`)
    } catch {
      // swallow by design
    }
  }

  /**
   * Aggregate report computed in SQL over ALL persisted rows (cross-instance,
   * cross-deploy) with this instance's in-memory rows as a floor. The per-tier
   * join uses guardrail rows' `quality` where the request ids line up.
   */
  async report(): Promise<DecisionFeedbackReport> {
    // Pull the last 7 days of rows and aggregate client-side — dependency-free
    // (a PostgREST rpc would need a SQL function deployed first). Rows are
    // bounded by window + hard cap.
    const windowMs = 7 * 24 * 60 * 60 * 1000 // last 7 days
    const since = Date.now() - windowMs
    const tierUrl =
      `${this.base}/${this.table}?select=request_id,tier,source,jev_tier,structural_tier,` +
      `confidence,needs_reasoning,latency_ms,decided_by,cached,decision_input_tokens,decision_output_tokens` +
      `&kind=eq.tier&at=gte.${since}&order=at.asc&limit=50000`
    const guardUrl =
      `${this.base}/${this.table}?select=request_id,quality,flagged,unsafe` +
      `&kind=eq.guardrail&at=gte.${since}&order=at.asc&limit=50000`
    try {
      const [tierRes, guardRes] = await Promise.all([
        this.fetchImpl(tierUrl, { headers: this.headers }),
        this.fetchImpl(guardUrl, { headers: this.headers }),
      ])
      if (!tierRes.ok || !guardRes.ok) throw new Error('feedback query failed')
      const tiers = (await tierRes.json()) as Array<Record<string, unknown>>
      const guards = (await guardRes.json()) as Array<Record<string, unknown>>
      return aggregate(tiers, guards)
    } catch {
      // Supabase unreachable → this instance's in-memory view
      return this.local.report()
    }
  }
}

function aggregate(
  tiers: Array<Record<string, unknown>>,
  guards: Array<Record<string, unknown>>,
): DecisionFeedbackReport {
  const qualityByReq = new Map<string, { quality?: number; flagged: boolean }>()
  for (const g of guards) {
    const id = g.request_id as string
    const prev = qualityByReq.get(id)
    const flagged = Boolean(g.flagged)
    const quality = typeof g.quality === 'number' ? (g.quality as number) : undefined
    if (!prev) qualityByReq.set(id, { quality, flagged })
    else
      qualityByReq.set(id, {
        quality: quality ?? prev.quality,
        flagged: prev.flagged || flagged,
      })
  }

  const perTierAcc = new Map<
    string,
    { requests: number; quality: number; qualityN: number; flagged: number; confidence: number; confidenceN: number }
  >()
  const jev = {
    decisions: 0,
    cacheHits: 0,
    fallbacks: 0,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    confidence: 0,
  }
  let tierDecisions = 0
  let joined = 0

  for (const t of tiers) {
    tierDecisions++
    const tier = (t.tier as string) ?? 'unknown'
    const source = (t.source as string) ?? 'structural'
    if (source === 'jev') {
      jev.decisions++
      if (t.cached === true) jev.cacheHits++
      if (typeof t.latency_ms === 'number' && t.cached !== true) jev.latencyMs += t.latency_ms
      if (typeof t.confidence === 'number') jev.confidence += t.confidence
      if (typeof t.decision_input_tokens === 'number') jev.inputTokens += t.decision_input_tokens
      if (typeof t.decision_output_tokens === 'number') jev.outputTokens += t.decision_output_tokens
    } else {
      jev.fallbacks++
    }
    const g = qualityByReq.get(t.request_id as string)
    if (g) {
      joined++
      const acc =
        perTierAcc.get(tier) ?? { requests: 0, quality: 0, qualityN: 0, flagged: 0, confidence: 0, confidenceN: 0 }
      acc.requests++
      if (g.quality !== undefined) {
        acc.quality += g.quality
        acc.qualityN++
      }
      if (g.flagged) acc.flagged++
      if (typeof t.confidence === 'number') {
        acc.confidence += t.confidence
        acc.confidenceN++
      }
      perTierAcc.set(tier, acc)
    }
  }

  const perTier: DecisionFeedbackReport['perTier'] = {}
  for (const [tier, a] of perTierAcc) {
    perTier[tier] = {
      requests: a.requests,
      avgQuality: a.qualityN ? round(a.quality / a.qualityN) : 0,
      flaggedRate: a.requests ? round(a.flagged / a.requests) : 0,
      avgConfidence: a.confidenceN ? round(a.confidence / a.confidenceN) : 0,
    }
  }

  let flagged = 0
  let qualitySum = 0
  let qualityN = 0
  for (const g of qualityByReq.values()) {
    if (g.flagged) flagged++
    if (g.quality !== undefined) {
      qualitySum += g.quality
      qualityN++
    }
  }
  const backendCalls = jev.decisions - jev.cacheHits
  return {
    tierDecisions,
    joined,
    perTier,
    jev: {
      decisions: jev.decisions,
      cacheHits: jev.cacheHits,
      fallbacks: jev.fallbacks,
      avgLatencyMs: backendCalls > 0 ? round(jev.latencyMs / backendCalls) : 0,
      inputTokens: jev.inputTokens,
      outputTokens: jev.outputTokens,
      avgConfidence: jev.decisions > 0 ? round(jev.confidence / jev.decisions) : 0,
    },
    guardrails: {
      evaluations: qualityByReq.size,
      flagged,
      avgQuality: qualityN ? round(qualitySum / qualityN) : 0,
    },
  }

  function round(x: number): number {
    return Math.round(x * 1e4) / 1e4
  }
}

