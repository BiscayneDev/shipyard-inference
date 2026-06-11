import type { ProviderCandidate, ModelMetadata } from '../router/candidates.js'
import type { RoutingStrategy } from '../router/strategy.js'
import type { RouterEvent } from '../router/router.js'
import type { CacheStore } from '../router/cache.js'
import type { UsageRecorder } from '../router/usage.js'
import type { TelemetryReporter } from '../operator/reporter.js'

export interface GatewayModel {
  id: string
  ownedBy?: string
}

export interface GatewayConfig {
  /** Routable backends, exactly as passed to `Router`. */
  candidates: ProviderCandidate[]
  /** Routing strategy. Defaults to the Router default (`costOptimized`). */
  strategy?: RoutingStrategy
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
  cors?: { origins: string[] | '*' }
  /** Models advertised by `GET /v1/models`. Defaults to candidates' declared models. */
  models?: GatewayModel[]
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
