import type { LLMChatParams } from '../types.js'
import type { ModelMetadata, ProviderCandidate } from './candidates.js'
import { isCapable } from './capabilities.js'
import { estimateInputTokens } from './estimate.js'
import { resolveModelMetadata } from './pricing.js'

export interface RoutingDecision {
  candidate: ProviderCandidate
  /** Model id to request; `undefined` lets the provider use its own default. */
  model?: string
  /** Resolved metadata for the chosen model, when known. */
  meta?: ModelMetadata
  /** Estimated USD cost for this call, when priced. */
  estimatedCostUsd?: number
}

export interface RoutingContext {
  params: LLMChatParams
  candidates: ProviderCandidate[]
  /** 0-based attempt counter; increments across failover retries. */
  attempt: number
  /** Errors from prior attempts for this request. */
  previousErrors: unknown[]
  /** Router-level pricing overrides, merged below per-candidate metadata. */
  pricingOverrides?: Record<string, Partial<ModelMetadata>>
}

/**
 * A strategy returns an *ordered* list of decisions, best first. The router
 * walks the list, trying each until one succeeds or hits a non-retryable
 * error. Returning a list (not a single pick) is what lets a single strategy
 * express both "cheapest" and "fall through on failure".
 */
export interface RoutingStrategy {
  select(ctx: RoutingContext): RoutingDecision[]
}

function estimateCostUsd(meta: ModelMetadata, params: LLMChatParams): number {
  const inputTok = estimateInputTokens(params)
  const outputTok = params.maxTokens ?? 4096
  return (
    (inputTok / 1_000_000) * meta.inputCostPerMTok +
    (outputTok / 1_000_000) * meta.outputCostPerMTok
  )
}

/** Expand candidate×model into capable, priced decisions. */
function capableDecisions(ctx: RoutingContext): RoutingDecision[] {
  const { params, candidates, pricingOverrides } = ctx
  const out: RoutingDecision[] = []

  for (const candidate of candidates) {
    for (const explicit of candidate.models ?? []) {
      const { meta } = resolveModelMetadata(explicit.model, explicit, pricingOverrides)
      if (!isCapable(meta, params.routingHints, params)) continue
      out.push({ candidate, model: meta.model, meta, estimatedCostUsd: estimateCostUsd(meta, params) })
    }
  }

  return out
}

/**
 * Cheapest capable model wins. Capable candidate×model pairs are sorted by
 * estimated cost ascending; the full sorted list is returned so a failed
 * cheapest pick falls through to the next-cheapest. Models with no pricing
 * data sort last (cost `Infinity`) — picked only when uniquely capable.
 */
export function costOptimized(): RoutingStrategy {
  return {
    select(ctx) {
      return capableDecisions(ctx).sort(
        (a, b) => (a.estimatedCostUsd ?? Infinity) - (b.estimatedCostUsd ?? Infinity),
      )
    },
  }
}

/**
 * Availability-first routing (the roadmap's `withFailover`). Tries candidates
 * in `order` (by candidate id) — or in configured order when `order` is
 * omitted — ignoring cost. A candidate with model metadata uses its first
 * capable model; otherwise the request's `model` (or the provider default) is
 * used, so providers without a pricing table (e.g. UsePod) still work.
 */
export function failover(order?: string[]): RoutingStrategy {
  return {
    select(ctx) {
      const ordered = order
        ? [...ctx.candidates].sort(
            (a, b) => indexOrLast(order, a.id) - indexOrLast(order, b.id),
          )
        : ctx.candidates

      const decisions: RoutingDecision[] = []
      for (const candidate of ordered) {
        const models = candidate.models ?? []
        const capable = models
          .map((m) => resolveModelMetadata(m.model, m, ctx.pricingOverrides).meta)
          .find((meta) => isCapable(meta, ctx.params.routingHints, ctx.params))

        if (capable) {
          decisions.push({ candidate, model: capable.model, meta: capable })
        } else if (models.length === 0) {
          // No metadata: trust the caller's model / provider default.
          decisions.push({ candidate, model: ctx.params.model })
        }
        // else: candidate has models but none capable → skip it.
      }
      return decisions
    },
  }
}

function indexOrLast(order: string[], id: string): number {
  const i = order.indexOf(id)
  return i === -1 ? order.length : i
}

/**
 * Run strategies in order, concatenating their decisions and de-duplicating by
 * candidate id + model. Lets you express e.g. "cheapest capable, but always
 * keep UsePod as a final fallback": `composite(costOptimized(), failover(['usepod']))`.
 */
export function composite(...strategies: RoutingStrategy[]): RoutingStrategy {
  return {
    select(ctx) {
      const seen = new Set<string>()
      const merged: RoutingDecision[] = []
      for (const strategy of strategies) {
        for (const d of strategy.select(ctx)) {
          const key = `${d.candidate.id}::${d.model ?? ''}`
          if (seen.has(key)) continue
          seen.add(key)
          merged.push(d)
        }
      }
      return merged
    },
  }
}
