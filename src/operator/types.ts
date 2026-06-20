/**
 * Operator command center — normalized telemetry wire shapes.
 *
 * A `TelemetryEvent` is the cross-deployment lingua franca: every integration
 * (Dock, the chat portal, a bare gateway) normalizes its `RouterEvent` stream
 * into these and pushes them to the hub. The shapes are deliberately flat and
 * JSON-only so the wire format is stable and the JSONL store is greppable.
 */

/** Latency/percentile-friendly request completion (one settled inference call). */
export interface RequestEvent {
  kind: 'request'
  /** Unix-ms the request completed (stamped by the reporter). */
  at: number
  /** Candidate/provider id that served it (e.g. `'anthropic'`, `'usepod'`). */
  provider?: string
  /** Concrete model id that ran. */
  model?: string
  /** Opaque end-user id from `metadata.userId`, for per-tenant attribution. */
  userId?: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  /** Real provider cost in USD, when priced. */
  actualCostUsd?: number
  /** Cost the same request would have incurred on the baseline model, direct/uncached. */
  baselineCostUsd?: number
  /** `baselineCostUsd − actualCostUsd` when both are known. */
  savedUsd?: number
  latencyMs: number
  /** True when the caller pinned a specific model (vs. letting the router pick). */
  pinned?: boolean
}

/** A routing decision (which candidate/model was chosen for an attempt). */
export interface RouteSelectedEvent {
  kind: 'route_selected'
  at: number
  provider?: string
  model?: string
  estimatedCostUsd?: number
  pinned?: boolean
}

/** An attempt failed and the router moved to the next candidate. */
export interface FailoverEvent {
  kind: 'failover'
  at: number
  provider?: string
  model?: string
  error?: string
}

/** The router retried the same candidate after a backoff. */
export interface RetryEvent {
  kind: 'retry'
  at: number
  provider?: string
  model?: string
  retryAttempt: number
  delayMs: number
  error?: string
}

/** An attempt errored (attempt-level, not necessarily a failed request). */
export interface ErrorEvent {
  kind: 'error'
  at: number
  provider?: string
  model?: string
  error?: string
}

/** A cache lookup outcome (semantic or exact). */
export interface CacheEvent {
  kind: 'cache'
  at: number
  hit: boolean
}

/** Settlement status as reported by the billing side (outside the Router). */
export type SettlementStatus = 'settled' | 'failed' | 'frozen' | 'pending'

/** A USDC settlement attempt — the real money actually collected (or stuck). */
export interface SettlementEvent {
  kind: 'settlement'
  at: number
  userId?: string
  /** Amount in USD (human units). */
  amountUsd: number
  /** On-chain transaction signature, when broadcast. */
  signature?: string
  status: SettlementStatus
  /** Treasury (recipient) wallet address. */
  treasury?: string
  network?: 'mainnet' | 'devnet'
  error?: string
}

/** The discriminated union pushed to / stored by the hub. */
export type TelemetryEvent =
  | RequestEvent
  | RouteSelectedEvent
  | FailoverEvent
  | RetryEvent
  | ErrorEvent
  | CacheEvent
  | SettlementEvent

export type TelemetryKind = TelemetryEvent['kind']

/** A telemetry event after the hub tags it with its originating deployment. */
export type StoredEvent = TelemetryEvent & { source: string }

/** The body a reporter POSTs to `/ingest`. */
export interface IngestPayload {
  /** Deployment/integration id, e.g. `'dock-prod'`, `'chat-portal'`. */
  source: string
  events: TelemetryEvent[]
}

// --------------------------------------------------------------------------
// Query result shapes (hub → SPA)
// --------------------------------------------------------------------------

/** Rolling counters over a window, plus the modeled-revenue view. */
export interface Overview {
  /** Window the rolling figures cover, in ms. */
  windowMs: number
  /** Wall-clock the snapshot was taken (unix-ms). */
  at: number
  requests: number
  /** Requests per minute over the window. */
  rpm: number
  inputTokens: number
  outputTokens: number
  /** Tokens (in+out) per minute over the window. */
  tpm: number
  /** Attempt-level errors (route_error events). */
  errors: number
  failovers: number
  retries: number
  cacheHits: number
  cacheMisses: number
  /** `cacheHits / (cacheHits + cacheMisses)`, or 0 when no lookups. */
  cacheHitRate: number
  /** `failovers / requests`, attempt failover pressure. */
  failoverRate: number
  /** `errors / (errors + requests)`, honest attempt error share. */
  errorRate: number
  actualCostUsd: number
  baselineCostUsd: number
  savedUsd: number
  /** `savedUsd / baselineCostUsd`, 0 when no baseline. */
  savingsPct: number
  /** Modeled revenue = Σ min(actual·(1+margin), baseline) (or actual·(1+margin) when no baseline). */
  revenueUsd: number
  /** `revenueUsd − actualCostUsd`, the gross take. */
  marginUsd: number
  /** `marginUsd / revenueUsd`, 0 when no revenue. */
  marginPct: number
  latencyP50Ms: number
  latencyP95Ms: number
  latencyP99Ms: number
  /** Distinct users seen in the window. */
  users: number
  /** Distinct sources seen in the window. */
  sources: number
}

/** One bucket of the time series. */
export interface TimeseriesBucket {
  /** Bucket start, unix-ms. */
  t: number
  requests: number
  errors: number
  actualCostUsd: number
  savedUsd: number
  revenueUsd: number
  latencyP95Ms: number
  inputTokens: number
  outputTokens: number
}

/** A grouped rollup row (per model / provider / user / source). */
export interface BreakdownRow {
  key: string
  requests: number
  inputTokens: number
  outputTokens: number
  actualCostUsd: number
  baselineCostUsd: number
  savedUsd: number
  revenueUsd: number
  marginUsd: number
  /** Attempt errors attributed to this key (providers/models only). */
  errors: number
  failovers: number
  avgLatencyMs: number
}

/** Per-error-type tally. */
export interface ErrorRow {
  message: string
  count: number
  lastAt: number
  lastProvider?: string
  lastModel?: string
}

/** A recent request, for the live feed. */
export interface FeedRow {
  at: number
  source: string
  provider?: string
  model?: string
  userId?: string
  inputTokens: number
  outputTokens: number
  actualCostUsd?: number
  savedUsd?: number
  latencyMs: number
  pinned?: boolean
}

/** Billing rollup + recent settlements. */
export interface BillingView {
  /** Modeled revenue over the window (mirrors Overview). */
  revenueUsd: number
  actualCostUsd: number
  marginUsd: number
  /** Real USDC actually collected (sum of `settled` settlements in window). */
  settledUsd: number
  /** Settlements that failed/froze and need attention. */
  stuck: number
  /** Live treasury balances by address (USDC, human units); null while unconfigured. */
  treasury: TreasuryBalance[] | null
  settlements: SettlementRow[]
}

export interface TreasuryBalance {
  address: string
  network: 'mainnet' | 'devnet'
  /** USDC balance in human units, or null if the read failed. */
  usdc: number | null
  /** Unix-ms of the read. */
  at: number
  error?: string
}

export interface SettlementRow {
  at: number
  source: string
  userId?: string
  amountUsd: number
  status: SettlementStatus
  signature?: string
  treasury?: string
  network?: 'mainnet' | 'devnet'
  error?: string
}

// --------------------------------------------------------------------------
// Hosted control-plane entities
// --------------------------------------------------------------------------

export interface Tenant {
  kind: 'tenant'
  id: string
  name: string
  createdAt: number
  updatedAt?: number
  status?: 'active' | 'trial' | 'suspended' | 'deleted'
  metadata?: Record<string, unknown>
}

export interface Project {
  kind: 'project'
  id: string
  tenantId: string
  name: string
  createdAt: number
  updatedAt?: number
  archivedAt?: number
  metadata?: Record<string, unknown>
}

export interface ApiKey {
  kind: 'api_key'
  id: string
  tenantId: string
  projectId?: string
  keyHash: string
  label?: string
  createdAt: number
  revokedAt?: number
  lastUsedAt?: number
  metadata?: Record<string, unknown>
}

/** One completed request attributed to a tenant/project/api key. */
export interface UsageRecord {
  kind: 'usage'
  at: number
  tenantId: string
  projectId?: string
  apiKeyId?: string
  source?: string
  provider?: string
  model?: string
  userId?: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  actualCostUsd?: number
  baselineCostUsd?: number
  savedUsd?: number
  latencyMs: number
  pinned?: boolean
}

export interface SavingsSnapshot {
  kind: 'savings_snapshot'
  at: number
  tenantId: string
  projectId?: string
  windowMs: number
  requests: number
  inputTokens: number
  outputTokens: number
  actualCostUsd: number
  baselineCostUsd: number
  savedUsd: number
  savingsPct: number
  revenueUsd: number
  marginUsd: number
  marginPct: number
  users: number
  sources: number
  metadata?: Record<string, unknown>
}

export interface BillingPlan {
  kind: 'billing_plan'
  id: string
  tenantId: string
  name: string
  createdAt: number
  currency?: 'USD'
  active?: boolean
  monthlyCommitUsd?: number
  includedUsd?: number
  overageRatePct?: number
  requestLimit?: number
  seatLimit?: number
  features?: string[]
  metadata?: Record<string, unknown>
}

export interface SlaSummary {
  kind: 'sla_summary'
  at: number
  tenantId: string
  projectId?: string
  windowMs: number
  requests: number
  availabilityPct: number
  successRatePct: number
  errorRatePct: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  breachCount: number
  metadata?: Record<string, unknown>
}

export type ControlPlaneKind =
  | Tenant['kind']
  | Project['kind']
  | ApiKey['kind']
  | UsageRecord['kind']
  | SavingsSnapshot['kind']
  | BillingPlan['kind']
  | SlaSummary['kind']

export type ControlPlaneRecord =
  | Tenant
  | Project
  | ApiKey
  | UsageRecord
  | SavingsSnapshot
  | BillingPlan
  | SlaSummary

export interface ControlPlaneQuery {
  tenantId?: string
  projectId?: string
  kind?: ControlPlaneKind | ControlPlaneKind[]
  since?: number
  until?: number
}

export interface BillingSummary {
  at: number
  windowMs: number
  tenantId: string
  projectId?: string
  requests: number
  inputTokens: number
  outputTokens: number
  actualCostUsd: number
  baselineCostUsd: number
  savedUsd: number
  savingsPct: number
  revenueUsd: number
  marginUsd: number
  marginPct: number
  plan: BillingPlan | null
  savingsSnapshot: SavingsSnapshot | null
  sla: SlaSummary | null
}

/** Health-of-routing rollup. */
export interface RoutingHealth {

  selections: { key: string; count: number }[]
  pinnedRequests: number
  autoRequests: number
  failovers: number
  retries: number
  cacheHits: number
  cacheMisses: number
  /** Per-provider availability = route successes / (successes + errors). */
  providers: ProviderHealthRow[]
}

export interface ProviderHealthRow {
  provider: string
  requests: number
  errors: number
  failovers: number
  /** `requests / (requests + errors)`. */
  availability: number
  avgLatencyMs: number
}
