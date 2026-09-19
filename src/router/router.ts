import type {
  LLMChatParams,
  LLMResponse,
  LLMProvider,
  UsageInfo,
  LLMStreamEvent,
  LLMStreamOptions,
} from '../types.js'
import type { ModelMetadata, ModelTier, ProviderCandidate } from './candidates.js'
import type { AutoTierResult, TierDecision } from './jev-tier.js'
import { inferTier } from './auto-tier.js'
import type { CacheStore } from './cache.js'
import { cacheKey } from './cache.js'
import { responseToStream } from '../stream.js'
import type { CompressionTransform } from './compress.js'
import { NoCapableModelError, isRetryable } from './errors.js'
import { ProviderHealthTracker } from './health.js'
import { computeActualCostUsd, computeBaselineCostUsd, resolveModelMetadata } from './pricing.js'
import type { UsageRecorder } from './usage.js'
import { type RetryPolicy, nextRetryDelayMs, sleep } from './retry.js'
import {
  type RoutingDecision,
  type RoutingStrategy,
  costOptimized,
  failover,
} from './strategy.js'
import { VideoRouter, type VideoRouterEvent } from './video.js'

export type RouterEvent =
  | { type: 'cache_hit'; key: string }
  | { type: 'cache_miss'; key: string }
  | {
      type: 'route_selected'
      candidateId: string
      model?: string
      estimatedCostUsd?: number
      attempt: number
    }
  | { type: 'route_success'; candidateId: string; model?: string; attempt: number }
  | { type: 'failover'; candidateId: string; model?: string; attempt: number; error: unknown }
  | {
      /** The quality floor chosen for an `auto` request, with its evidence. */
      type: 'tier_decided'
      tier: ModelTier
      source: 'jev' | 'structural'
      jevTier?: ModelTier
      structuralTier?: ModelTier
      confidence?: number
      needsReasoning?: number
      latencyMs?: number
      decidedBy?: string
      usage?: { inputTokens: number; outputTokens: number }
      /** True when the decision was served from the inferrer's cache. */
      cached?: boolean
    }
  | {
      type: 'retry'
      candidateId: string
      model?: string
      attempt: number
      retryAttempt: number
      delayMs: number
      error: unknown
    }
  | { type: 'route_error'; candidateId: string; model?: string; attempt: number; error: unknown }
  | {
      type: 'request_completed'
      candidateId: string
      model?: string
      usage?: UsageInfo
      actualCostUsd?: number
      /** Cost the same request would have incurred on `baselineModel`, direct/uncached. */
      baselineCostUsd?: number
      /** `baselineCostUsd − actualCostUsd` when both are known (≥ 0 in practice). */
      savedUsd?: number
      /** Savings split for auditability. */
      routingSavingsUsd?: number
      cachingSavingsUsd?: number
      compressionSavingsUsd?: number
      /** Frozen baseline path for the savings report. */
      baselineModel?: string
      /** Customer request class used to keep the baseline scoped honestly. */
      requestClass?: string
      userId?: string
      latencyMs: number
      /** True when the caller pinned a specific provider/model via `routingHints.pin`. */
      pinned?: boolean
    }

export interface RouterOptions {
  candidates: ProviderCandidate[]
  /** Selection strategy. Defaults to `costOptimized()`. */
  strategy?: RoutingStrategy
  /** Pricing/capability overrides merged below per-candidate metadata. */
  pricingOverrides?: Record<string, Partial<ModelMetadata>>
  /** Optional response cache. Off when omitted. */
  cache?: CacheStore
  /** Optional pre-routing transform (e.g. context compression). Off when omitted. */
  compress?: CompressionTransform
  /** Observability hook for routing/failover events. */
  onEvent?: (event: RouterEvent) => void
  /** Optional sink for completed-request usage/$ telemetry. Off when omitted. */
  usageRecorder?: UsageRecorder
  /**
   * Fixed reference model for the savings baseline — the model the caller would
   * otherwise have called direct. When omitted, the baseline falls back to each
   * request's own `params.model` (the model it asked for), so savings are
   * measured against the intended model per call. `baselineCostUsd`/`savedUsd`
   * land on every `request_completed`; if neither a fixed baseline nor a
   * requested model is available, no savings are claimed.
   */
  baselineModel?: string
  /**
   * Per-candidate retry-with-jitter on retryable errors, before failing over to
   * the next candidate. Off by default (`maxRetries: 0`).
   */
  retry?: RetryPolicy
  /** Max number of candidates to try. Defaults to "try them all". */
  maxRetries?: number
  /**
   * Per-candidate circuit breaker. Candidates whose circuit is open are
   * skipped during selection (no wasted request); attempt outcomes feed
   * `recordSuccess`/`recordFailure` automatically. Off when omitted.
   */
  health?: ProviderHealthTracker
  /**
   * Per-request quality floor. When `true`, the router infers a tier from each
   * request (prompt size, tools, output budget — see `inferTier`) and applies it
   * as `routingHints.tier`, so selection picks the cheapest model that's *good
   * enough* rather than the globally cheapest. Pass a function for custom logic —
   * it may be async (e.g. `createJevTierInferrer`, which asks a System One
   * model to judge request content before routing; its timeout/fallback keeps
   * routing available when the decision backend is down).
   * An explicit `params.routingHints.tier` always overrides this.
   */
  autoTier?: boolean | ((params: LLMChatParams) => AutoTierResult | Promise<AutoTierResult>)
  /** Candidates with video-capable models, forwarded to {@link VideoRouter}. */
  videoCandidates?: ProviderCandidate[]
  /** Poll interval (ms) for video generation polling. Default 5000. */
  videoPollIntervalMs?: number
  /** Max poll attempts for video generation polling. Default 60. */
  videoMaxPollAttempts?: number
}

/**
 * A cost-aware, failover-capable router that is itself an `LLMProvider`, so it
 * composes: a `Router` can be a candidate of another `Router`, the primary or
 * fallback of `withFailover`, or a drop-in wherever an `LLMProvider` is
 * expected. Payment (x402-on-Solana) lives *below* the router, inside the
 * `fetch` each candidate provider was constructed with — the router only ever
 * sees a slow-but-successful call or a thrown error.
 */
export class Router implements LLMProvider {
  private readonly opts: RouterOptions
  private readonly strategy: RoutingStrategy
  private _video?: VideoRouter

  constructor(opts: RouterOptions) {
    if (opts.candidates.length === 0) {
      throw new Error('[shipyard-inference] Router requires at least one candidate')
    }
    this.opts = opts
    this.strategy = opts.strategy ?? costOptimized()
  }

  /** Lazy video router; created on first access from the router's options. */
  get video(): VideoRouter {
    if (!this._video) {
      this._video = new VideoRouter({
        candidates: this.opts.videoCandidates ?? this.opts.candidates,
        pricingOverrides: this.opts.pricingOverrides,
        onEvent: this.opts.onEvent as ((event: VideoRouterEvent) => void) | undefined,
        pollIntervalMs: this.opts.videoPollIntervalMs,
        maxPollAttempts: this.opts.videoMaxPollAttempts,
      })
    }
    return this._video
  }

  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const compressed = this.opts.compress ? await this.opts.compress(params) : params

    const key = this.opts.cache ? cacheKey(compressed) : undefined
    if (this.opts.cache && key) {
      const hit = await this.opts.cache.get(compressed)
      if (hit) {
        this.emit({ type: 'cache_hit', key })
        return hit
      }
      this.emit({ type: 'cache_miss', key })
    }

    const decisions = await this.plan(compressed)
    if (decisions.length === 0) {
      throw new NoCapableModelError(
        '[shipyard-inference] No candidate model satisfies the routing hints',
      )
    }

    const limit = Math.min(decisions.length, this.opts.maxRetries ?? decisions.length)
    let lastError: unknown

    for (let attempt = 0; attempt < limit; attempt++) {
      const decision = decisions[attempt]!
      this.emit({
        type: 'route_selected',
        candidateId: decision.candidate.id,
        model: decision.model,
        estimatedCostUsd: decision.estimatedCostUsd,
        attempt,
      })

      let retryAttempt = 0
      for (;;) {
        const startedAt = performance.now()
        try {
          const res = await decision.candidate.provider.chat({
            ...compressed,
            model: decision.model ?? compressed.model,
          })
          if (this.opts.cache && key) await this.opts.cache.set(compressed, res)
          this.opts.health?.recordSuccess(decision.candidate.id)
          this.emit({
            type: 'route_success',
            candidateId: decision.candidate.id,
            model: decision.model,
            attempt,
          })
          this.recordCompletion(
            decision,
            res.usage,
            performance.now() - startedAt,
            compressed.metadata?.userId,
            compressed.model,
            this.isPinned(compressed),
            compressed.metadata?.requestClass as string | undefined,
          )
          return res
        } catch (error) {
          lastError = error
          this.opts.health?.recordFailure(decision.candidate.id)
          if (this.shouldRetry(retryAttempt, error)) {
            await this.delayRetry(decision, attempt, retryAttempt, error)
            retryAttempt++
            continue
          }
          const hasMore = attempt < limit - 1
          if (hasMore && isRetryable(error)) {
            this.emit({
              type: 'failover',
              candidateId: decision.candidate.id,
              model: decision.model,
              attempt,
              error,
            })
            break
          }
          this.emit({
            type: 'route_error',
            candidateId: decision.candidate.id,
            model: decision.model,
            attempt,
            error,
          })
          throw error
        }
      }
    }

    throw lastError
  }

  /**
   * Streaming variant of {@link chat}. Reuses the same selection/failover loop,
   * with one added rule: **fail over only before the first content event.** Once
   * any token has been emitted to the consumer the request is committed — later
   * errors propagate rather than retrying, since emitted tokens can't be unsent
   * and re-running on another model would duplicate output. The cache is written
   * only on a clean `done`.
   */
  async *chatStream(
    params: LLMChatParams,
    opts?: LLMStreamOptions,
  ): AsyncIterable<LLMStreamEvent> {
    const compressed = this.opts.compress ? await this.opts.compress(params) : params

    const key = this.opts.cache ? cacheKey(compressed) : undefined
    if (this.opts.cache && key) {
      const hit = await this.opts.cache.get(compressed)
      if (hit) {
        this.emit({ type: 'cache_hit', key })
        yield* responseToStream(hit)
        return
      }
      this.emit({ type: 'cache_miss', key })
    }

    const decisions = await this.plan(compressed)
    if (decisions.length === 0) {
      throw new NoCapableModelError(
        '[shipyard-inference] No candidate model satisfies the routing hints',
      )
    }

    const limit = Math.min(decisions.length, this.opts.maxRetries ?? decisions.length)
    let lastError: unknown
    let committed = false

    for (let attempt = 0; attempt < limit; attempt++) {
      const decision = decisions[attempt]!
      this.emit({
        type: 'route_selected',
        candidateId: decision.candidate.id,
        model: decision.model,
        estimatedCostUsd: decision.estimatedCostUsd,
        attempt,
      })

      let retryAttempt = 0
      for (;;) {
        const startedAt = performance.now()
        try {
          for await (const event of this.streamFromDecision(decision, compressed, opts)) {
            if (event.type === 'done') {
              if (this.opts.cache && key) await this.opts.cache.set(compressed, event.response)
              this.opts.health?.recordSuccess(decision.candidate.id)
              this.emit({
                type: 'route_success',
                candidateId: decision.candidate.id,
                model: decision.model,
                attempt,
              })
              this.recordCompletion(
                decision,
                event.response.usage,
                performance.now() - startedAt,
                compressed.metadata?.userId,
                compressed.model,
                this.isPinned(compressed),
                compressed.metadata?.requestClass as string | undefined,
              )
            } else {
              committed = true
            }
            yield event
          }
          return
        } catch (error) {
          lastError = error
          this.opts.health?.recordFailure(decision.candidate.id)
          // Retry the same candidate only before any token is emitted.
          if (!committed && this.shouldRetry(retryAttempt, error)) {
            await this.delayRetry(decision, attempt, retryAttempt, error)
            retryAttempt++
            continue
          }
          const hasMore = attempt < limit - 1
          if (!committed && isRetryable(error) && hasMore) {
            this.emit({
              type: 'failover',
              candidateId: decision.candidate.id,
              model: decision.model,
              attempt,
              error,
            })
            break
          }
          this.emit({
            type: 'route_error',
            candidateId: decision.candidate.id,
            model: decision.model,
            attempt,
            error,
          })
          throw error
        }
      }
    }

    throw lastError
  }

  /** Stream from a decision, adapting non-streaming providers via `responseToStream`. */
  private async *streamFromDecision(
    decision: RoutingDecision,
    params: LLMChatParams,
    opts?: LLMStreamOptions,
  ): AsyncIterable<LLMStreamEvent> {
    const chatParams = { ...params, model: decision.model ?? params.model }
    const provider = decision.candidate.provider
    if (provider.chatStream) {
      yield* provider.chatStream(chatParams, opts)
    } else {
      yield* responseToStream(await provider.chat(chatParams))
    }
  }

  private async plan(params: LLMChatParams): Promise<RoutingDecision[]> {
    // Hard pin short-circuits selection entirely.
    const pin = params.routingHints?.pin
    if (pin) {
      const candidate = pin.provider
        ? this.opts.candidates.find((c) => c.id === pin.provider)
        : this.opts.candidates[0]
      if (!candidate) {
        throw new NoCapableModelError(
          `[shipyard-inference] Pinned provider '${pin.provider}' not found among candidates`,
        )
      }
      // Attach the declared pricing metadata so pinned requests still carry
      // full cost telemetry — usage recording, baseline/savings math, and the
      // Tender attestation gate (which requires a real billed cost > 0) all
      // read `meta`; without it a pinned request reports $0 cost.
      const requested = pin.model ?? params.model
      const declared = requested
        ? (candidate.models ?? []).find((m) => m.model === requested)
        : undefined
      const { meta } =
        declared && requested
          ? resolveModelMetadata(requested, declared, this.opts.pricingOverrides)
          : { meta: undefined }
      return [{ candidate, model: meta?.model ?? requested, ...(meta ? { meta } : {}) }]
    }

    return this.strategy.select({
      params: await this.applyAutoTier(params),
      candidates: this.opts.health
        ? this.opts.candidates.filter((c) => this.opts.health!.isAvailable(c.id))
        : this.opts.candidates,
      attempt: 0,
      previousErrors: [],
      pricingOverrides: this.opts.pricingOverrides,
    })
  }

  /**
   * Apply the per-request quality floor when `autoTier` is on and the caller
   * hasn't pinned a tier. Returns params unchanged otherwise. Async so the
   * inferrer may consult an external decision model (with its own fallback).
   */
  private async applyAutoTier(params: LLMChatParams): Promise<LLMChatParams> {
    if (!this.opts.autoTier) return params
    if (params.routingHints?.tier) return params // explicit tier wins
    const raw: AutoTierResult =
      typeof this.opts.autoTier === 'function' ? await this.opts.autoTier(params) : inferTier(params)
    const d = raw as TierDecision | undefined
    if (!d || typeof d !== 'object' || d.tier === undefined) {
      return { ...params, routingHints: { ...params.routingHints, tier: raw as ModelTier } }
    }
    this.emit({
      type: 'tier_decided',
      tier: d.tier,
      source: d.source,
      ...(d.jevTier !== undefined ? { jevTier: d.jevTier } : {}),
      ...(d.structuralTier !== undefined ? { structuralTier: d.structuralTier } : {}),
      ...(d.confidence !== undefined ? { confidence: d.confidence } : {}),
      ...(d.needsReasoning !== undefined ? { needsReasoning: d.needsReasoning } : {}),
      ...(d.latencyMs !== undefined ? { latencyMs: d.latencyMs } : {}),
      ...(d.decidedBy !== undefined ? { decidedBy: d.decidedBy } : {}),
      ...(d.usage ? { usage: d.usage } : {}),
      ...(d.cached !== undefined ? { cached: d.cached } : {}),
    })
    return { ...params, routingHints: { ...params.routingHints, tier: d.tier } }
  }

  private emit(event: RouterEvent): void {
    this.opts.onEvent?.(event)
  }

  /** Whether to retry the same candidate: within the budget and the error is retryable. */
  private shouldRetry(retryAttempt: number, error: unknown): boolean {
    return retryAttempt < (this.opts.retry?.maxRetries ?? 0) && isRetryable(error)
  }

  /** Emit a `retry` event and sleep the backoff (Retry-After-aware) before retrying. */
  private async delayRetry(
    decision: RoutingDecision,
    attempt: number,
    retryAttempt: number,
    error: unknown,
  ): Promise<void> {
    const delayMs = nextRetryDelayMs(retryAttempt, this.opts.retry ?? {}, error)
    this.emit({
      type: 'retry',
      candidateId: decision.candidate.id,
      model: decision.model,
      attempt,
      retryAttempt,
      delayMs,
      error,
    })
    await sleep(delayMs)
  }

  /** True when the request pinned a specific provider/model (vs. letting the router pick). */
  private isPinned(params: LLMChatParams): boolean {
    const pin = params.routingHints?.pin
    return Boolean(pin && (pin.model || pin.provider))
  }

  /** Resolve actual + baseline cost from real usage, emit `request_completed`, record telemetry. */
  private recordCompletion(
    decision: RoutingDecision,
    usage: UsageInfo | undefined,
    latencyMs: number,
    userId?: string,
    requestedModel?: string,
    pinned?: boolean,
    requestClass?: string,
  ): void {
    const meta =
      decision.meta ??
      (decision.model
        ? resolveModelMetadata(decision.model, undefined, this.opts.pricingOverrides).meta
        : undefined)
    const actualCostUsd = computeActualCostUsd(meta, usage)

    // Baseline = the model the caller would otherwise have used: an explicit
    // `baselineModel` wins, else the model the request asked for (`params.model`).
    const baselineModelId = this.opts.baselineModel ?? requestedModel
    const baselineMeta = baselineModelId
      ? resolveModelMetadata(baselineModelId, undefined, this.opts.pricingOverrides).meta
      : undefined
    const baselineCostUsd = computeBaselineCostUsd(baselineMeta, usage)
    const actualDirectCostUsd = computeBaselineCostUsd(meta, usage)
    const routingSavingsUsd =
      baselineCostUsd !== undefined && actualDirectCostUsd !== undefined
        ? baselineCostUsd - actualDirectCostUsd
        : undefined
    const cachingSavingsUsd =
      actualDirectCostUsd !== undefined && actualCostUsd !== undefined
        ? actualDirectCostUsd - actualCostUsd
        : undefined
    const compressionSavingsUsd =
      routingSavingsUsd !== undefined && cachingSavingsUsd !== undefined ? 0 : undefined
    const savedUsd =
      routingSavingsUsd !== undefined && cachingSavingsUsd !== undefined
        ? routingSavingsUsd + cachingSavingsUsd + (compressionSavingsUsd ?? 0)
        : undefined
    const requestClassLabel = requestClass

    this.emit({
      type: 'request_completed',
      candidateId: decision.candidate.id,
      model: decision.model,
      usage,
      actualCostUsd,
      baselineCostUsd,
      savedUsd,
      routingSavingsUsd,
      cachingSavingsUsd,
      compressionSavingsUsd,
      baselineModel: baselineModelId,
      requestClass: requestClassLabel,
      userId,
      latencyMs,
      pinned,
    })
    this.opts.usageRecorder?.record({
      candidateId: decision.candidate.id,
      model: decision.model,
      usage,
      actualCostUsd,
      baselineCostUsd,
      savedUsd,
      routingSavingsUsd,
      cachingSavingsUsd,
      compressionSavingsUsd,
      baselineModel: baselineModelId,
      requestClass: requestClassLabel,
      userId,
      latencyMs,
      at: Date.now(),
    })
  }
}

/**
 * The roadmap's promised convenience: try `primary`, fall back to `fallback`
 * on retryable errors (rate-limit / outage / model-deprecated). A thin wrapper
 * over `Router` + the `failover` strategy.
 */
export function withFailover(
  primary: ProviderCandidate,
  fallback: ProviderCandidate,
): Router {
  return new Router({
    candidates: [primary, fallback],
    strategy: failover([primary.id, fallback.id]),
  })
}
