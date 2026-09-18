import type { GuardrailResult } from '../gateway/config.js'

/** The tier-decision half of the join, mirrored from the `tier_decided` event. */
export interface TierDecisionRecord {
  tier: string
  source: 'jev' | 'structural'
  jevTier?: string
  structuralTier?: string
  confidence?: number
  needsReasoning?: number
  latencyMs?: number
  decidedBy?: string
  usage?: { inputTokens: number; outputTokens: number }
  cached?: boolean
  /** Internal join marker (set when a guardrail outcome was matched). */
  joined?: boolean
}

/** Per-tier aggregates over requests that have BOTH a tier decision and a guardrail outcome. */
export interface TierFeedbackTotals {
  requests: number
  /** Mean guardrail quality (0–1) over joined requests. */
  avgQuality: number
  /** Share of joined requests the guardrail flagged. */
  flaggedRate: number
  /** Mean Jev confidence over joined requests (when answered). */
  avgConfidence: number
}

export interface DecisionFeedbackReport {
  /** Requests seen by the tier inferrer (joined or not). */
  tierDecisions: number
  /** Requests with both a tier decision and a guardrail outcome. */
  joined: number
  perTier: Record<string, TierFeedbackTotals>
  jev: {
    /** Tier decisions made by Jev (not structural fallback). */
    decisions: number
    /** Tier decisions served from the decision cache (no backend call). */
    cacheHits: number
    /** Times Jev errored/timed out/answered weakly and the structural tier applied. */
    fallbacks: number
    /** Mean decision-call latency (ms), backend calls only. */
    avgLatencyMs: number
    /** Total decision-call input tokens — the cost of judging. */
    inputTokens: number
    outputTokens: number
    /** Mean calibrated confidence over accepted Jev answers. */
    avgConfidence: number
  }
  guardrails: {
    evaluations: number
    flagged: number
    avgQuality: number
  }
}

/** Consumed by the gateway: receives tier decisions and guardrail outcomes keyed by request id. */
export interface DecisionFeedbackRecorder {
  recordTier(requestId: string, record: TierDecisionRecord): void
  recordGuardrail(result: GuardrailResult): void
  /** Optional aggregated report, surfaced at `GET /v1/decisions/feedback`. */
  report?(): DecisionFeedbackReport
}

/**
 * In-memory join of tier decisions and guardrail outcomes, keyed by request
 * id: the closed judgment loop. Jev decides which tier serves a request; the
 * guardrail scores how well the answer actually landed. `report()` answers
 * "does economy routing actually degrade answers?" — the calibration data that
 * `minConfidence`, the `needs_reasoning` floor, and `combine` should be tuned
 * against. Entries whose guardrail never lands (backend down, empty output)
 * still count in `tierDecisions` but not in the per-tier quality join.
 */
export class MemoryDecisionFeedback {
  /** @param maxEntries FIFO cap per side of the join (default 10000). */
  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries
  }

  private tiers = new Map<string, TierDecisionRecord>()
  private guardrails = new Map<string, GuardrailResult>()
  private joined = 0
  /** FIFO cap so long-running gateways don't grow these maps without bound. */
  private readonly maxEntries: number
  private perTier = new Map<string, { requests: number; quality: number; flagged: number; confidence: number; confidenceN: number }>()
  private jev = {
    decisions: 0,
    cacheHits: 0,
    fallbacks: 0,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    confidence: 0,
  }

  /** Idempotent per request id (the router emits `tier_decided` once). */
  recordTier(requestId: string, record: TierDecisionRecord): void {
    if (this.tiers.has(requestId)) return
    if (this.tiers.size >= this.maxEntries) {
      this.tiers.delete(this.tiers.keys().next().value!)
    }
    this.tiers.set(requestId, record)
    this.tierDecisions++
    const j = this.jev
    if (record.source === 'jev') {
      j.decisions++
      if (record.cached) j.cacheHits++
      if (record.latencyMs !== undefined) {
        j.latencyMs += record.latencyMs
      }
      if (record.confidence !== undefined) {
        j.confidence += record.confidence
      }
      if (record.usage) {
        j.inputTokens += record.usage.inputTokens
        j.outputTokens += record.usage.outputTokens
      }
    } else {
      j.fallbacks++
    }
    this.maybeJoin(requestId)
  }

  /** Guardrail outcomes may arrive after the tier record (fire-and-forget). */
  recordGuardrail(result: GuardrailResult): void {
    if (this.guardrails.has(result.requestId)) return
    if (this.guardrails.size >= this.maxEntries) {
      this.guardrails.delete(this.guardrails.keys().next().value!)
    }
    this.guardrails.set(result.requestId, result)
    this.maybeJoin(result.requestId)
  }

  private maybeJoin(requestId: string): void {
    const tier = this.tiers.get(requestId)
    const guard = this.guardrails.get(requestId)
    if (!tier || !guard || tier.joined) return
    tier.joined = true
    this.joined++
    const t = this.perTier.get(tier.tier) ?? { requests: 0, quality: 0, flagged: 0, confidence: 0, confidenceN: 0 }
    t.requests++
    if (guard.quality !== undefined) t.quality += guard.quality
    if (guard.flagged) t.flagged++
    if (tier.confidence !== undefined) {
      t.confidence += tier.confidence
      t.confidenceN++
    }
    this.perTier.set(tier.tier, t)
  }

  private tierDecisions = 0

  report(): DecisionFeedbackReport {
    const perTier: Record<string, TierFeedbackTotals> = {}
    for (const [tier, t] of this.perTier) {
      perTier[tier] = {
        requests: t.requests,
        avgQuality: t.requests ? round(t.quality / t.requests) : 0,
        flaggedRate: t.requests ? round(t.flagged / t.requests) : 0,
        avgConfidence: t.confidenceN ? round(t.confidence / t.confidenceN) : 0,
      }
    }
    const j = this.jev
    const backendCalls = j.decisions - j.cacheHits
    let flagged = 0
    let qualitySum = 0
    let qualityN = 0
    for (const g of this.guardrails.values()) {
      if (g.flagged) flagged++
      if (g.quality !== undefined) {
        qualitySum += g.quality
        qualityN++
      }
    }
    return {
      tierDecisions: this.tierDecisions,
      joined: this.joined,
      perTier,
      jev: {
        decisions: j.decisions,
        cacheHits: j.cacheHits,
        fallbacks: j.fallbacks,
        avgLatencyMs: backendCalls > 0 ? round(j.latencyMs / backendCalls) : 0,
        inputTokens: j.inputTokens,
        outputTokens: j.outputTokens,
        avgConfidence: j.decisions > 0 ? round(j.confidence / j.decisions) : 0,
      },
      guardrails: {
        evaluations: this.guardrails.size,
        flagged,
        avgQuality: qualityN ? round(qualitySum / qualityN) : 0,
      },
    }
    function round(x: number): number {
      return Math.round(x * 1e4) / 1e4
    }
  }
}
