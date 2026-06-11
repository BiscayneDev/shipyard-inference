import type { LLMChatParams } from '../types.js'
import type { ModelTier } from './candidates.js'
import { estimateInputTokens } from './estimate.js'

export interface AutoTierThresholds {
  /** Prompt tokens at/above which a request needs at least `standard`. Default 1500. */
  standardInputTokens?: number
  /** Prompt tokens at/above which a request needs `frontier`. Default 16000. */
  frontierInputTokens?: number
  /** Requested output tokens (`maxTokens`) at/above which we bump to `frontier`. Default 4000. */
  frontierOutputTokens?: number
}

/**
 * Infer the minimum quality tier a request needs from cheap structural signals —
 * no extra model call. The Router uses this as a per-request floor so it routes
 * to the cheapest model that's *good enough*, rather than the globally cheapest.
 *
 * Heuristic:
 *  - large prompt OR big requested output ⇒ `frontier`
 *  - tools in play OR a non-trivial prompt ⇒ `standard` (tool-use wants a capable model)
 *  - otherwise short and simple           ⇒ `economy`
 *
 * Thresholds are tunable; an explicit `routingHints.tier` always overrides this.
 */
export function inferTier(params: LLMChatParams, thresholds: AutoTierThresholds = {}): ModelTier {
  const standardAt = thresholds.standardInputTokens ?? 1500
  const frontierInAt = thresholds.frontierInputTokens ?? 16000
  const frontierOutAt = thresholds.frontierOutputTokens ?? 4000

  const inputTok = estimateInputTokens(params)
  const outputTok = params.maxTokens ?? 0
  const hasTools = (params.tools?.length ?? 0) > 0

  if (inputTok >= frontierInAt || outputTok >= frontierOutAt) return 'frontier'
  if (hasTools || inputTok >= standardAt) return 'standard'
  return 'economy'
}
