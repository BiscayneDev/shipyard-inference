export { Router, withFailover } from './router.js'
export type { RouterOptions, RouterEvent } from './router.js'
export {
  costOptimized,
  failover,
  composite,
} from './strategy.js'
export type {
  RoutingStrategy,
  RoutingContext,
  RoutingDecision,
} from './strategy.js'
export type {
  ProviderCandidate,
  ModelMetadata,
  ModelTier,
} from './candidates.js'
export { TIER_RANK } from './candidates.js'
export {
  DEFAULT_PRICING,
  resolveModelMetadata,
  computeActualCostUsd,
  computeBaselineCostUsd,
} from './pricing.js'
export { MemoryUsageRecorder } from './usage.js'
export type {
  UsageRecorder,
  UsageRecord,
  UsageTotals,
  UsageModelTotals,
} from './usage.js'
export { isCapable } from './capabilities.js'
export { estimateInputTokens } from './estimate.js'
export { NoCapableModelError, isRetryable } from './errors.js'
export { backoffDelayMs, retryAfterMs, nextRetryDelayMs } from './retry.js'
export type { RetryPolicy } from './retry.js'
export { MemoryCacheStore, cacheKey, canonicalRequestText } from './cache.js'
export type { CacheStore } from './cache.js'
export { SemanticCacheStore, openAIEmbedder } from './semantic-cache.js'
export type { Embedder, SemanticCacheOptions, OpenAIEmbedderOptions } from './semantic-cache.js'
export type { CompressionTransform } from './compress.js'
export { slidingWindowCompression, summarizeCompression } from './compress.js'
export type { SummarizeCompressionOptions } from './compress.js'
