import type { ProviderCandidate, ModelMetadata } from '../router/candidates.js'
import type { RoutingStrategy } from '../router/strategy.js'
import type { RouterEvent } from '../router/router.js'
import type { CacheStore } from '../router/cache.js'
import type { UsageRecorder } from '../router/usage.js'
import type { TelemetryReporter } from '../operator/reporter.js'
import type { ApiKeyStore } from './keys.js'

export interface GatewayModel {
  id: string
  ownedBy?: string
}

/** Minimal Tender surface the gateway needs (satisfied by `GatewayTender`). */
export interface GatewayTenderHook {
  minWaitMs?: number
  serve(ctx: {
    requestId: string
    surfaceId: string
    userId?: string
    userWallet?: string
    agentic?: boolean
  }): { placementId: string; usdcPerImpression: number } | null
  settle(args: {
    userId: string
    requestId: string
    model: string
    billedCostUsd: number
    measuredWaitMs: number
    placement: { placementId: string; usdcPerImpression: number }
    surfaceId: string
  }): unknown
}

export interface GatewayConfig {
  /** Routable backends, exactly as passed to `Router`. */
  candidates: ProviderCandidate[]
  /** Routing strategy. Defaults to the Router default (`costOptimized`). */
  strategy?: RoutingStrategy
  /**
   * Model the savings baseline is priced against — what the caller would have
   * used directly. When set, every `request_completed` event carries
   * `baselineCostUsd`/`savedUsd`, so the operator can show provable savings.
   */
  baselineModel?: string
  pricingOverrides?: Record<string, Partial<ModelMetadata>>
  cache?: CacheStore
  usageRecorder?: UsageRecorder
  /** Additional observability hook, composed with the gateway's own capture. */
  onEvent?: (event: RouterEvent) => void
  /**
   * Operator telemetry reporter. When set, every routing decision, completion,
   * failover, retry, error, and cache event flows to the operator hub — so all
   * traffic through this gateway is captured centrally without per-app wiring.
   * Build one with `createTelemetryReporter({ url, source })`; the gateway owns
   * its `onEvent` but the caller owns its lifecycle (`flush`/`close`).
   */
  telemetry?: TelemetryReporter
  /** Static bearer keys. Empty/omitted ⇒ auth disabled (dev only; logs a warning). */
  apiKeys?: string[]
  /**
   * Per-user API key store. When set, a request's `sk-shipyard-…` bearer resolves
   * to an account and the request is auto-attributed to that account's `userId`
   * (overriding the OpenAI `user` field) — so a developer's IDE traffic ties to
   * their wallet for routing rebates + Tender kickbacks. Composed with `apiKeys`.
   */
  keyStore?: ApiKeyStore
  cors?: { origins: string[] | '*' }
  /** Models advertised by `GET /v1/models`. Defaults to candidates' declared models. */
  models?: GatewayModel[]
  /**
   * Tender hook — monetize the request's wait state. On a qualifying wait during
   * a streaming request, `serve(ctx)` auctions a sponsored placement (remembered
   * as the account's current ad); on completion `settle(...)` attests the real,
   * billed impression and accrues the account's kickback. Streaming-only.
   */
  tender?: GatewayTenderHook
  /** Emit `x-shipyard-*` cost headers / trailer. Default true. */
  exposeCostHeaders?: boolean
  /** Port for `startGateway`. Default 8787. */
  port?: number
}

/** Models to advertise: explicit list, else the union of candidates' declared models. */
export function resolveModelList(config: GatewayConfig): GatewayModel[] {
  if (config.models && config.models.length > 0) return config.models
  const seen = new Set<string>()
  const out: GatewayModel[] = []
  for (const candidate of config.candidates) {
    for (const model of candidate.models ?? []) {
      if (seen.has(model.model)) continue
      seen.add(model.model)
      out.push({ id: model.model, ownedBy: candidate.id })
    }
  }
  return out
}
