import type { ProviderCandidate, ModelMetadata, ModelTier } from '../router/candidates.js'
import type { AutoTierResult } from '../router/jev-tier.js'
import type { RoutingStrategy } from '../router/strategy.js'
import type { RouterEvent } from '../router/router.js'
import type { CacheStore } from '../router/cache.js'
import type { UsageRecorder } from '../router/usage.js'
import type { TelemetryReporter } from '../operator/reporter.js'
import type { ApiKeyStore } from './keys.js'
import type { X402Config } from './x402.js'
import type { DecisionProvider } from '../decisions/types.js'
import type { DecisionFeedbackRecorder } from '../router/decision-feedback.js'
import type { SpendTracker } from './spend.js'
import type { ProviderHealthTracker } from '../router/health.js'

/** A verified x402 payment collected for one request. */
export interface X402PaymentInfo {
  /** Payer wallet when known (owner of the funding token account). */
  payer?: string
  /** Confirmed on-chain signature. */
  signature: string
  /** Whole USDC actually collected. */
  amountUsdc: number
}

export interface GatewayModel {
  id: string
  ownedBy?: string
}

/**
 * `/v1/decisions` route: typed-decision inference from a System One model
 * (e.g. TypeSafe Jev) — state + typed questions in, probabilistic typed
 * answers out. The route rides the same auth as chat: API keys, or a verified
 * x402 payment (`exact` flat or `upto` metered on the decision's usage).
 */
export interface DecisionsConfig {
  /** Decision backend serving the route. */
  provider: DecisionProvider
  /**
   * Models to advertise under `GET /v1/models` (owned by the provider, e.g.
   * `jev-latest`). Defaults to the provider's declared models, else
   * `jev-latest`.
   */
  models?: GatewayModel[]
}

/** One guardrail evaluation of a completed completion, quality + safety. */
export interface GuardrailResult {
  /** Request id of the evaluated completion. */
  requestId: string
  /** Model that produced the output, when known. */
  model?: string
  /** Probability the output is unsafe/harmful/off-instruction (0–1). */
  unsafe?: number
  /** Normalized answer quality (0–1, 1 = fully addresses the request). */
  quality?: number
  /** True when the evaluation crossed a flag threshold. */
  flagged: boolean
  /** Model that judged, for auditability. */
  judgedBy?: string
}

/**
 * Observe-only output guardrails: after a completion finishes, a decision
 * model scores the output for safety and answer quality — a fraction of a
 * cent at ~100ms, fire-and-forget so it never adds latency to the response.
 * Results flow to `onResult` for telemetry/escalation; responses are never
 * blocked or altered in this mode.
 */
export interface GuardrailsConfig {
  /** Decision backend used to judge outputs. */
  provider: DecisionProvider
  /** Backend model id per call; the provider applies its own default. */
  model?: string
  /** Flag when the unsafe probability exceeds this. Default 0.8. */
  flagUnsafeAbove?: number
  /** Flag when normalized quality falls below this. Default 0.25. */
  flagQualityBelow?: number
  /** Called with every evaluation result (fire-and-forget, never blocks). */
  onResult?: (result: GuardrailResult) => void
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
  }): { placementId: string; usdcPerImpression: number; line: string } | null
  settle(args: {
    userId: string
    requestId: string
    model: string
    billedCostUsd: number
    measuredWaitMs: number
    placement: { placementId: string; usdcPerImpression: number; line: string }
    surfaceId: string
  }): Promise<unknown>
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
   * Per-request x402 charging (USDC on Solana). When set, inference routes
   * answer unauthenticated requests with a 402 payment challenge instead of a
   * 401, and a verified `X-PAYMENT` proof serves the request — Paybox or any
   * wallet can pay per call, no API key needed.
   */
  x402?: X402Config
  /** Called with each verified x402 payment (wire to `recordSettlement`). */
  onX402Payment?: (payment: X402PaymentInfo) => void
  /**
   * Per-request quality floor for requests that don't name a catalog model
   * (or name `auto`): the Router infers a minimum tier from the request shape
   * (prompt size, tools, requested output) and `costOptimized` then picks the
   * cheapest model that clears it. Explicit model names are always honored and
   * bypass the floor. Default off (plain cost-optimized routing). Pass a
   * function (may be async — e.g. `createJevTierInferrer`, content-aware
   * judgment) for custom logic.
   */
  autoTier?: boolean | ((params: import('../types.js').LLMChatParams) => AutoTierResult | Promise<AutoTierResult>)
  /**
   * Per-user API key store. When set, a request's `sk-shipyard-…` bearer resolves
   * to an account and the request is auto-attributed to that account's `userId`
   * (overriding the OpenAI `user` field) — so a developer's IDE traffic ties to
   * their wallet for routing rebates + Tender kickbacks. Composed with `apiKeys`.
   */
  keyStore?: ApiKeyStore
  /** Local bootstrap mode: allow unauthenticated requests while still resolving any issued key. */
  bootstrapAuth?: boolean
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
  /**
   * Typed-decision route (`POST /v1/decisions`) served by a System One model
   * (e.g. TypeSafe Jev). Off when omitted — the route 404s.
   */
  decisions?: DecisionsConfig
  /**
   * Observe-only output guardrails over completed completions. Off when
   * omitted. Never blocks or alters responses; results flow to `onResult`.
   */
  guardrails?: GuardrailsConfig
  /**
   * Judgment-loop recorder: joins `tier_decided` events with guardrail
   * outcomes per request id and aggregates per-tier quality/confidence plus
   * Jev fallback/latency/cost. Exposed at `GET /v1/decisions/feedback`.
   * Use `MemoryDecisionFeedback` (in `shipyard-inference/router`).
   */
  decisionFeedback?: DecisionFeedbackRecorder
  /** Port for `startGateway`. Default 8787. */
  port?: number
  /**
   * Provider circuit breaker forwarded to the Router: candidates whose
   * circuit is open are skipped during selection. Off when omitted.
   */
  health?: ProviderHealthTracker
  /**
   * Per-key spend circuit breaker. When set, keyed requests are checked
   * against a cumulative USD ceiling *before* serving (blocked requests get
   * a 402 with a top-up link — recoverable, never a dead session) and actual
   * cost is recorded after completion. Off when omitted.
   */
  spend?: SpendConfig
}

export interface SpendConfig {
  /** The `SpendTracker` itself (e.g. `new MemorySpendTracker({...})`). */
  tracker: SpendTracker
  /**
   * Top-up URL included in the 402 body so a drained agent can self-serve.
   * e.g. a MoonPay buy link (optionally with the wallet address pre-filled).
   */
  topUpUrl?: string
}

/**
 * Models to advertise: explicit list, else the union of candidates' declared
 * models. Decision models (when `/v1/decisions` is on) are always appended —
 * callers can ask for them by name even when the deployment pins an explicit
 * chat catalog.
 */
export function resolveModelList(config: GatewayConfig): GatewayModel[] {
  const out: GatewayModel[] = []
  const seen = new Set<string>()
  if (config.models && config.models.length > 0) {
    for (const m of config.models) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      out.push(m)
    }
  } else {
    for (const candidate of config.candidates) {
      for (const model of candidate.models ?? []) {
        if (seen.has(model.model)) continue
        seen.add(model.model)
        out.push({ id: model.model, ownedBy: candidate.id })
      }
    }
  }
  if (config.decisions) {
    const models =
      config.decisions.models ??
      (config.decisions.provider.models ?? ['jev-latest']).map((id) => ({
        id,
        ownedBy: config.decisions!.provider.id,
      }))
    for (const m of models) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      out.push(m)
    }
  }
  return out
}
