import type { LLMProvider } from '../types.js'

/** Quality tiers, ordered economy < standard < frontier. */
export type ModelTier = 'economy' | 'standard' | 'frontier'

export interface ModelMetadata {
  /** Canonical model id as the provider expects it (e.g. `claude-sonnet-4-5`). */
  model: string
  /** USD per 1M input tokens. */
  inputCostPerMTok: number
  /** USD per 1M output tokens. */
  outputCostPerMTok: number
  /**
   * USD per 1M cache-read tokens (prompt served from the provider's cache).
   * Defaults to 0.1× input (Anthropic ephemeral); set explicitly per provider
   * (e.g. OpenAI cached reads are ~0.5× input).
   */
  cacheReadCostPerMTok?: number
  /** USD per 1M cache-write tokens (Anthropic cache creation). Defaults to 1.25× input. */
  cacheWriteCostPerMTok?: number
  /** Maximum context window in tokens. */
  contextWindow: number
  tier: ModelTier
  /** Free-form capability tags, e.g. `['tools', 'vision', 'json']`. */
  capabilities: string[]
}

/**
 * A routable backend: any `LLMProvider` (including another `Router` or a
 * UsePod provider) plus the set of models it can serve. Per-candidate model
 * metadata is authoritative for pricing — the same model id behind a proxy
 * (UsePod) has a different effective price than calling it directly.
 */
export interface ProviderCandidate {
  /** Stable label used for ordering and observability, e.g. `anthropic-primary`. */
  id: string
  provider: LLMProvider
  /**
   * Models this candidate serves. If omitted, the candidate is still usable
   * via `routingHints.pin` or as a `failover` target, but `costOptimized`
   * cannot rank it (no pricing/capability data).
   */
  models?: ModelMetadata[]
}

export const TIER_RANK: Record<ModelTier, number> = {
  economy: 0,
  standard: 1,
  frontier: 2,
}
