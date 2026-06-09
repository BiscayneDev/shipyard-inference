import type { LLMChatParams, RoutingHints } from '../types.js'
import { type ModelMetadata, TIER_RANK } from './candidates.js'
import { estimateInputTokens } from './estimate.js'

/**
 * Decide whether a model can serve a request. All checks are AND'd, and each
 * is skipped when its corresponding hint is absent — so with no hints (and no
 * tools) every model is considered capable. The only implicit requirement is
 * tool support when the request actually carries tools.
 */
export function isCapable(
  meta: ModelMetadata,
  hints: RoutingHints | undefined,
  params: LLMChatParams,
): boolean {
  const caps = meta.capabilities

  // Tools: required explicitly or implied by a tool-bearing request.
  if ((hints?.requireTools || params.tools.length > 0) && !caps.includes('tools')) {
    return false
  }

  if (hints?.requireVision && !caps.includes('vision')) return false

  if (hints?.minContextWindow && meta.contextWindow < hints.minContextWindow) {
    return false
  }

  if (hints?.tier && TIER_RANK[meta.tier] < TIER_RANK[hints.tier]) return false

  if (
    hints?.maxCostPerMTokOut !== undefined &&
    meta.outputCostPerMTok > hints.maxCostPerMTokOut
  ) {
    return false
  }

  if (hints?.tags && !hints.tags.every((t) => caps.includes(t))) return false

  // Context-window fit guard: estimated prompt + requested output must fit.
  const outputBudget = params.maxTokens ?? 4096
  if (estimateInputTokens(params) + outputBudget > meta.contextWindow) {
    return false
  }

  return true
}
