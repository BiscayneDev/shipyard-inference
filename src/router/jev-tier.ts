import type { LLMChatParams } from '../types.js'
import { createHash } from 'node:crypto'
import type { ModelTier } from './candidates.js'
import { TIER_RANK } from './candidates.js'
import { inferTier } from './auto-tier.js'
import { estimateInputTokens } from './estimate.js'
import type { DecisionProvider } from '../decisions/types.js'

export interface JevTierInferrerOptions {
  /** Decision backend (e.g. `createTypeSafeProvider`, or a stub in dev). */
  provider: DecisionProvider
  /** Backend model id per call; the provider applies its own default. */
  model?: string
  /**
   * How the Jev judgment combines with the structural floor from
   * {@link inferTier} (prompt size, tools, output budget):
   *  - `'max'` (default): the effective tier is the higher of the two — Jev
   *    can only *raise* quality on top of the cheap heuristics, never undercut
   *    a request the heuristics already know is big or tool-heavy.
   *  - `'jev'`: trust Jev entirely (heuristic still used on fallback).
   */
  combine?: 'max' | 'jev'
  /**
   * Cap on the effective tier, applied after combining. An appliance whose
   * catalog has no frontier model sets `'standard'` so a frontier judgment
   * can't starve the request of every capable candidate. Default: no cap.
   */
  maxTier?: ModelTier
  /** Structural fallback when Jev errors, times out, or answers weakly. Default `inferTier`. */
  fallback?: (params: LLMChatParams) => ModelTier
  /**
   * Cap on added routing latency. When the decision call exceeds this the
   * structural fallback applies — routing stays available even if the decision
   * backend is down. Default 2000ms.
   */
  timeoutMs?: number
  /** Characters of request content sent as Jev state. Default 6000. */
  stateCharBudget?: number
  /**
   * Cache decision calls keyed by the exact request state (system + messages +
   * tool names + output budget). Repeated/continued requests with identical
   * state reuse the previous judgment for free, with no latency or backend
   * cost. Default 0 (off) — set e.g. 300000 (5 min) to enable.
   */
  cacheTtlMs?: number
  /** Max cached decisions (LRU-ish FIFO). Default 512. */
  cacheMaxEntries?: number
  /**
   * Minimum choice confidence to accept the Jev tier; below it the structural
   * fallback applies (an unconfident guess shouldn't change routing). Default 0
   * (accept any well-formed answer).
   */
  minConfidence?: number
  /** Observability: what tier was applied and where it came from. */
  onResult?: (result: JevTierResult) => void
}

export interface JevTierResult {
  /** Tier finally applied to routing. */
  tier: ModelTier
  /** Tier Jev chose (undefined when the call failed/was weak). */
  jevTier?: ModelTier
  /** Structural tier from the heuristics (always computed). */
  structuralTier: ModelTier
  /** Whether the final tier came from the structural fallback. */
  fallback: boolean
  /** Set when the fallback fired. */
  error?: unknown
  /** Jev's calibrated confidence in the tier choice (0–1). */
  confidence?: number
  /** Jev's `needs_reasoning` score (0–1), when answered. */
  needsReasoning?: number
  /** Decision-call latency in ms. */
  latencyMs?: number
  /** Backend model that judged (e.g. `jev-1.13.0`). */
  decidedBy?: string
  /** Decision-call token usage, for per-request cost accounting. */
  usage?: { inputTokens: number; outputTokens: number }
  /** True when the decision was served from the cache (no backend call). */
  cached?: boolean
}

/**
 * A routing decision with its evidence. Inferrers may return this instead of a
 * bare tier; the Router unwraps it, routes on `tier`, and emits the evidence
 * as a `tier_decided` event (surfaced on the gateway API and in the portal).
 */
export interface TierDecision {
  tier: ModelTier
  /** Where the tier came from. */
  source: 'jev' | 'structural'
  /** Jev's chosen tier, before combining with the structural floor. */
  jevTier?: ModelTier
  /** Structural tier from the heuristics. */
  structuralTier?: ModelTier
  /** Calibrated confidence in the tier choice (0–1). */
  confidence?: number
  /** `needs_reasoning` score (0–1), when the backend answered it. */
  needsReasoning?: number
  /** Decision-call latency in ms. */
  latencyMs?: number
  /** Backend model that judged (e.g. `jev-1.13.0`). */
  decidedBy?: string
  /** Decision-call token usage. */
  usage?: { inputTokens: number; outputTokens: number }
  /** True when the decision was served from the cache (no backend call). */
  cached?: boolean
}

/** What `autoTier` may return: a tier, or a tier with evidence. */
export type AutoTierResult = ModelTier | TierDecision

/** The exact questions asked per request — stable so answers stay comparable. */
const TIER_QUESTIONS = {
  tier: {
    type: 'choice' as const,
    instructions:
      'What minimum quality tier does an AI model need to answer this request well? Judge the task, not its length.',
    criteria: {
      economy:
        'Simple, casual, or well-defined tasks — greetings, quick facts, classification, short edits, boilerplate answers',
      standard:
        'Professional or technical work — multi-step instructions, code changes, structured writing, data extraction, tool use',
      frontier:
        'High-stakes or deeply complex work — architecture design, long-horizon reasoning, nuanced judgment, complex refactors, deep analysis',
    },
  },
  needs_reasoning: {
    type: 'noul' as const,
    instructions:
      'Answering this request well requires careful multi-step reasoning rather than a quick top-of-mind response.',
  },
}

/**
 * Content-aware auto-tier: instead of inferring a routing quality floor from
 * request *shape* only (see {@link inferTier}), ask a System One model (Jev)
 * to judge the request *content* — topic, complexity, reasoning depth — and
 * route to the cheapest model that clears it. One bundled decision call,
 * typically 70–500ms and fractions of a cent.
 *
 * Safe by construction: any error, timeout, or low-confidence answer falls
 * back to the structural heuristics, so this can sit in the hot path with a
 * decision backend that's down or not yet provisioned.
 */
export function createJevTierInferrer(
  opts: JevTierInferrerOptions,
): (params: LLMChatParams) => Promise<AutoTierResult> {
  const combine = opts.combine ?? 'max'
  const structural = opts.fallback ?? inferTier
  const timeoutMs = opts.timeoutMs ?? 2000
  const stateCharBudget = opts.stateCharBudget ?? 6000
  const minConfidence = opts.minConfidence ?? 0
  const cacheTtlMs = opts.cacheTtlMs ?? 0
  const cacheMaxEntries = opts.cacheMaxEntries ?? 512
  const cache = cacheTtlMs > 0 ? new Map<string, { at: number; decision: TierDecision }>() : undefined

  function buildState(params: LLMChatParams): unknown {
    const toolNames = (params.tools ?? []).map((t) => t.name).filter(Boolean)
    const raw = JSON.stringify({
      system: params.system,
      messages: params.messages?.map((m) => ({ role: m.role, content: m.content })),
      tools: toolNames,
      requested_output_tokens: params.maxTokens ?? null,
    })
    const state = raw.length > stateCharBudget ? raw.slice(0, stateCharBudget) + '…[truncated]' : raw
    return {
      request: state,
      note: 'This is an AI inference request about to be routed to a model. Judge what answering it well requires.',
    }
  }

  function withTimeout<T>(p: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`jev tier inferrer timed out after ${timeoutMs}ms`)), timeoutMs)
      p.then(
        (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          clearTimeout(timer)
          reject(e)
        },
      )
    })
  }

  return async (params: LLMChatParams): Promise<AutoTierResult> => {
    const structuralTier = structural(params)
    const t0 = Date.now()
    const state = JSON.stringify(buildState(params))
    const cacheKey = `${opts.model ?? ''}:${createHash('sha256').update(state).digest('hex')}`
    if (cache) {
      const hit = cache.get(cacheKey)
      if (hit && Date.now() - hit.at <= cacheTtlMs) {
        const decision: TierDecision = { ...hit.decision, cached: true }
        opts.onResult?.({
          tier: decision.tier,
          jevTier: decision.jevTier,
          structuralTier,
          fallback: false,
          confidence: decision.confidence,
          needsReasoning: decision.needsReasoning,
          latencyMs: 0,
          decidedBy: decision.decidedBy,
          ...(decision.usage ? { usage: decision.usage } : {}),
          cached: true,
        })
        return decision
      }
      if (hit) cache.delete(cacheKey)
      if (cache.size >= cacheMaxEntries) cache.delete(cache.keys().next().value!)
    }
    try {
      const res = await withTimeout(
        opts.provider.decide({
          state: buildState(params),
          questions: TIER_QUESTIONS,
          model: opts.model,
        }),
      )
      const latencyMs = Date.now() - t0
      const tierAnswer = res.answers['tier']
      const reasoningAnswer = res.answers['needs_reasoning']
      if (tierAnswer?.type !== 'choice' || !(tierAnswer.choice in TIER_QUESTIONS.tier.criteria)) {
        throw new Error(`jev tier answer malformed: ${JSON.stringify(tierAnswer)?.slice(0, 200)}`)
      }
      if (tierAnswer.confidence < minConfidence) {
        throw new Error(`jev tier confidence ${tierAnswer.confidence} below minimum ${minConfidence}`)
      }
      let jevTier = tierAnswer.choice as ModelTier
      // A strong "needs reasoning" signal floors the answer at standard —
      // even when the tier choice was economy — since reasoning-heavy tasks
      // are exactly what economy models fumble.
      if (jevTier === 'economy' && reasoningAnswer?.type === 'noul' && reasoningAnswer.noul > 0.75) {
        jevTier = 'standard'
      }
      const tier0 = combine === 'max' && TIER_RANK[structuralTier] > TIER_RANK[jevTier] ? structuralTier : jevTier
      // Cap the effective tier (appliance with no frontier rung); the raw
      // judgment is preserved on the decision for telemetry.
      const tier = opts.maxTier && TIER_RANK[tier0] > TIER_RANK[opts.maxTier] ? opts.maxTier : tier0
      const decision: TierDecision = {
        tier,
        source: 'jev',
        jevTier,
        structuralTier,
        confidence: tierAnswer.confidence,
        ...(reasoningAnswer?.type === 'noul' ? { needsReasoning: reasoningAnswer.noul } : {}),
        latencyMs,
        decidedBy: res.model,
        ...(res.usage ? { usage: res.usage } : {}),
      }
      cache?.set(cacheKey, { at: Date.now(), decision })
      opts.onResult?.({ tier, jevTier, structuralTier, fallback: false, confidence: tierAnswer.confidence, ...(reasoningAnswer?.type === 'noul' ? { needsReasoning: reasoningAnswer.noul } : {}), latencyMs, decidedBy: res.model, ...(res.usage ? { usage: res.usage } : {}) })
      return decision
    } catch (error) {
      const latencyMs = Date.now() - t0
      opts.onResult?.({ tier: structuralTier, structuralTier, fallback: true, error, latencyMs })
      return { tier: structuralTier, source: 'structural', structuralTier, latencyMs } satisfies TierDecision
    }
  }
}
