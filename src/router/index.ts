export { Router, withFailover } from './router.js'
export type { RouterOptions, RouterEvent } from './router.js'
export { VideoRouter } from './video.js'
export type { VideoRouterOptions, VideoRouterEvent } from './video.js'
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
export { inferTier } from './auto-tier.js'
export type { AutoTierThresholds } from './auto-tier.js'
export { createJevTierInferrer, sizeFloor } from './jev-tier.js'
export type { JevTierInferrerOptions, JevTierResult, TierDecision, AutoTierResult } from './jev-tier.js'
export { MemoryDecisionFeedback } from './decision-feedback.js'
export type {
  DecisionFeedbackRecorder,
  DecisionFeedbackReport,
  TierDecisionRecord,
  TierFeedbackTotals,
} from './decision-feedback.js'
export { SupabaseDecisionFeedback, SUPABASE_DECISION_FEEDBACK_SCHEMA } from './supabase-decision-feedback.js'
export type { SupabaseDecisionFeedbackOptions } from './supabase-decision-feedback.js'
export { estimateInputTokens } from './estimate.js'
export { NoCapableModelError, isRetryable } from './errors.js'
export { ProviderHealthTracker } from './health.js'
export type { ProviderHealthOptions } from './health.js'
export { backoffDelayMs, retryAfterMs, nextRetryDelayMs } from './retry.js'
export type { RetryPolicy } from './retry.js'
export { MemoryCacheStore, cacheKey, canonicalRequestText } from './cache.js'
export type { CacheStore } from './cache.js'
export { SemanticCacheStore, openAIEmbedder } from './semantic-cache.js'
export type { Embedder, SemanticCacheOptions, OpenAIEmbedderOptions } from './semantic-cache.js'
export type { CompressionTransform } from './compress.js'
export { slidingWindowCompression, summarizeCompression } from './compress.js'
export type { SummarizeCompressionOptions } from './compress.js'
