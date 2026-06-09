import type { ModelMetadata, ModelTier } from './candidates.js'
import type { UsageInfo } from '../types.js'

/**
 * Advisory pricing/capability snapshot, keyed by canonical model id. This is
 * NOT billing-accurate and WILL drift — it exists only to rank candidates for
 * cost-optimized routing. Authoritative cost should come from per-candidate
 * `models[]` or `Router`'s `pricingOverrides`. Prices are USD per 1M tokens.
 */
export const DEFAULT_PRICING: Record<string, Omit<ModelMetadata, 'model'>> = {
  // Anthropic
  'claude-opus-4-5': {
    inputCostPerMTok: 5,
    outputCostPerMTok: 25,
    contextWindow: 200_000,
    tier: 'frontier',
    capabilities: ['tools', 'vision', 'json'],
  },
  'claude-sonnet-4-5': {
    inputCostPerMTok: 3,
    outputCostPerMTok: 15,
    contextWindow: 200_000,
    tier: 'standard',
    capabilities: ['tools', 'vision', 'json'],
  },
  'claude-haiku-4-5': {
    inputCostPerMTok: 0.8,
    outputCostPerMTok: 4,
    contextWindow: 200_000,
    tier: 'economy',
    capabilities: ['tools', 'vision', 'json'],
  },
  // OpenAI
  'gpt-4o': {
    inputCostPerMTok: 2.5,
    outputCostPerMTok: 10,
    contextWindow: 128_000,
    tier: 'standard',
    capabilities: ['tools', 'vision', 'json'],
  },
  'gpt-4o-mini': {
    inputCostPerMTok: 0.15,
    outputCostPerMTok: 0.6,
    contextWindow: 128_000,
    tier: 'economy',
    capabilities: ['tools', 'vision', 'json'],
  },
}

/** Sentinel tier for a model we have no metadata for. */
const UNKNOWN_TIER: ModelTier = 'standard'

/**
 * Resolve metadata for a model. Resolution order, highest priority first:
 *   1. `explicit`   — a per-candidate `ModelMetadata` entry (authoritative)
 *   2. `overrides`  — `Router`'s `pricingOverrides[model]`
 *   3. `DEFAULT_PRICING[model]`
 *   4. unknown      — `Infinity` cost so cost-optimized only picks it when it
 *                     is the sole capable option (a warning is emitted then).
 */
export function resolveModelMetadata(
  model: string,
  explicit: ModelMetadata | undefined,
  overrides: Record<string, Partial<ModelMetadata>> | undefined,
): { meta: ModelMetadata; priced: boolean } {
  if (explicit) return { meta: explicit, priced: true }

  const base = DEFAULT_PRICING[model]
  const override = overrides?.[model]

  if (base || override) {
    return {
      meta: {
        model,
        inputCostPerMTok:
          override?.inputCostPerMTok ?? base?.inputCostPerMTok ?? Infinity,
        outputCostPerMTok:
          override?.outputCostPerMTok ?? base?.outputCostPerMTok ?? Infinity,
        contextWindow:
          override?.contextWindow ?? base?.contextWindow ?? Infinity,
        tier: override?.tier ?? base?.tier ?? UNKNOWN_TIER,
        capabilities: override?.capabilities ?? base?.capabilities ?? [],
      },
      priced: true,
    }
  }

  return {
    meta: {
      model,
      inputCostPerMTok: Infinity,
      outputCostPerMTok: Infinity,
      contextWindow: Infinity,
      tier: UNKNOWN_TIER,
      capabilities: [],
    },
    priced: false,
  }
}

/**
 * Actual USD cost from real token usage and resolved model pricing. Returns
 * `undefined` when the model is unpriced (Infinity) or usage is unavailable, so
 * callers can distinguish "free/unknown" from "$0". Cache-read tokens are
 * billed at the input rate (no separate cache rate today).
 */
export function computeActualCostUsd(
  meta: ModelMetadata | undefined,
  usage: UsageInfo | undefined,
): number | undefined {
  if (!meta || !usage) return undefined
  if (!isFinite(meta.inputCostPerMTok) || !isFinite(meta.outputCostPerMTok)) {
    return undefined
  }
  return (
    (usage.inputTokens / 1_000_000) * meta.inputCostPerMTok +
    (usage.outputTokens / 1_000_000) * meta.outputCostPerMTok
  )
}
