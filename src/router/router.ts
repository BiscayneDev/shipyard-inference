import type {
  LLMChatParams,
  LLMResponse,
  LLMProvider,
  UsageInfo,
  LLMStreamEvent,
  LLMStreamOptions,
} from '../types.js'
import type { ModelMetadata, ProviderCandidate } from './candidates.js'
import type { CacheStore } from './cache.js'
import { cacheKey } from './cache.js'
import { responseToStream } from '../stream.js'
import type { CompressionTransform } from './compress.js'
import { NoCapableModelError, isRetryable } from './errors.js'
import { computeActualCostUsd, resolveModelMetadata } from './pricing.js'
import type { UsageRecorder } from './usage.js'
import {
  type RoutingDecision,
  type RoutingStrategy,
  costOptimized,
  failover,
} from './strategy.js'

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
  | { type: 'route_error'; candidateId: string; model?: string; attempt: number; error: unknown }
  | {
      type: 'request_completed'
      candidateId: string
      model?: string
      usage?: UsageInfo
      actualCostUsd?: number
      latencyMs: number
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
  /** Max number of candidates to try. Defaults to "try them all". */
  maxRetries?: number
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

  constructor(opts: RouterOptions) {
    if (opts.candidates.length === 0) {
      throw new Error('[shipyard-inference] Router requires at least one candidate')
    }
    this.opts = opts
    this.strategy = opts.strategy ?? costOptimized()
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

    const decisions = this.plan(compressed)
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

      const startedAt = performance.now()
      try {
        const res = await decision.candidate.provider.chat({
          ...compressed,
          model: decision.model ?? compressed.model,
        })
        if (this.opts.cache && key) await this.opts.cache.set(compressed, res)
        this.emit({
          type: 'route_success',
          candidateId: decision.candidate.id,
          model: decision.model,
          attempt,
        })
        this.recordCompletion(decision, res.usage, performance.now() - startedAt)
        return res
      } catch (error) {
        lastError = error
        const hasMore = attempt < limit - 1
        if (hasMore && isRetryable(error)) {
          this.emit({
            type: 'failover',
            candidateId: decision.candidate.id,
            model: decision.model,
            attempt,
            error,
          })
          continue
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

    const decisions = this.plan(compressed)
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

      const startedAt = performance.now()
      try {
        for await (const event of this.streamFromDecision(decision, compressed, opts)) {
          if (event.type === 'done') {
            if (this.opts.cache && key) await this.opts.cache.set(compressed, event.response)
            this.emit({
              type: 'route_success',
              candidateId: decision.candidate.id,
              model: decision.model,
              attempt,
            })
            this.recordCompletion(decision, event.response.usage, performance.now() - startedAt)
          } else {
            committed = true
          }
          yield event
        }
        return
      } catch (error) {
        lastError = error
        const hasMore = attempt < limit - 1
        if (!committed && isRetryable(error) && hasMore) {
          this.emit({
            type: 'failover',
            candidateId: decision.candidate.id,
            model: decision.model,
            attempt,
            error,
          })
          continue
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

  private plan(params: LLMChatParams): RoutingDecision[] {
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
      return [{ candidate, model: pin.model ?? params.model }]
    }

    return this.strategy.select({
      params,
      candidates: this.opts.candidates,
      attempt: 0,
      previousErrors: [],
      pricingOverrides: this.opts.pricingOverrides,
    })
  }

  private emit(event: RouterEvent): void {
    this.opts.onEvent?.(event)
  }

  /** Resolve actual cost from real usage, emit `request_completed`, record telemetry. */
  private recordCompletion(
    decision: RoutingDecision,
    usage: UsageInfo | undefined,
    latencyMs: number,
  ): void {
    const meta =
      decision.meta ??
      (decision.model
        ? resolveModelMetadata(decision.model, undefined, this.opts.pricingOverrides).meta
        : undefined)
    const actualCostUsd = computeActualCostUsd(meta, usage)

    this.emit({
      type: 'request_completed',
      candidateId: decision.candidate.id,
      model: decision.model,
      usage,
      actualCostUsd,
      latencyMs,
    })
    this.opts.usageRecorder?.record({
      candidateId: decision.candidate.id,
      model: decision.model,
      usage,
      actualCostUsd,
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
