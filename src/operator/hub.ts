import { createHash } from 'node:crypto'
import {
  computeBreakdown,
  computeErrors,
  computeFeed,
  computeOverview,
  computeRoutingHealth,
  computeSettlements,
  computeTimeseries,
} from './aggregate.js'
import { NullTelemetryStore, type TelemetryStore } from './store.js'
import type {
  BillingView,
  BreakdownRow,
  ErrorRow,
  FeedRow,
  Overview,
  RequestEvent,
  RoutingHealth,
  SavingsSnapshot,
  SlaSummary,
  StoredEvent,
  TelemetryEvent,
  TimeseriesBucket,
  TreasuryBalance,
} from './types.js'

export interface TelemetryHubOptions {
  /** Durable store. Defaults to {@link NullTelemetryStore} (in-memory only). */
  store?: TelemetryStore
  /** How long events live in the in-memory query ring. Default 48h. */
  retentionMs?: number
  /** Hard cap on ring size (newest-wins) as a memory backstop. Default 500k. */
  maxEvents?: number
  /** Pricing margin used to model revenue (Dock's M2 rule). Default 15(%). */
  marginPct?: number
  /** `Date.now`, injectable for tests. */
  now?: () => number
}

const HOUR = 3_600_000

export interface SavingsSnapshotInput {
  tenantId: string
  projectId?: string
  windowMs: number
  at: number
  overview: Overview
  baselineModel?: string
  requestClass?: string
  windowStartAt?: number
  windowEndAt?: number
  frozenAt?: number
  shadowMode?: boolean
  signature?: string
  metadata?: Record<string, unknown>
}

export function buildSavingsSnapshot(input: SavingsSnapshotInput): SavingsSnapshot {
  const { overview } = input
  return {
    kind: 'savings_snapshot',
    at: input.at,
    tenantId: input.tenantId,
    projectId: input.projectId,
    windowMs: input.windowMs,
    requests: overview.requests,
    inputTokens: overview.inputTokens,
    outputTokens: overview.outputTokens,
    actualCostUsd: overview.actualCostUsd,
    baselineCostUsd: overview.baselineCostUsd,
    savedUsd: overview.savedUsd,
    routingSavingsUsd: overview.routingSavingsUsd,
    cachingSavingsUsd: overview.cachingSavingsUsd,
    compressionSavingsUsd: overview.compressionSavingsUsd,
    savingsPct: overview.savingsPct,
    revenueUsd: overview.revenueUsd,
    marginUsd: overview.marginUsd,
    marginPct: overview.marginPct,
    users: overview.users,
    sources: overview.sources,
    baselineModel: input.baselineModel,
    requestClass: input.requestClass,
    windowStartAt: input.windowStartAt,
    windowEndAt: input.windowEndAt,
    frozenAt: input.frozenAt,
    shadowMode: input.shadowMode,
    signature: input.signature,
    metadata: input.metadata,
  }
}

export interface SlaSummaryInput {
  tenantId: string
  projectId?: string
  windowMs: number
  at: number
  overview: Overview
}

export function buildSlaSummary(input: SlaSummaryInput): SlaSummary {
  const { overview } = input
  const successRatePct = Math.max(0, 100 - overview.errorRate * 100)
  return {
    kind: 'sla_summary',
    at: input.at,
    tenantId: input.tenantId,
    projectId: input.projectId,
    windowMs: input.windowMs,
    requests: overview.requests,
    availabilityPct: Math.max(0, 100 - overview.errorRate * 100),
    successRatePct,
    errorRatePct: overview.errorRate * 100,
    p50LatencyMs: overview.latencyP50Ms,
    p95LatencyMs: overview.latencyP95Ms,
    p99LatencyMs: overview.latencyP99Ms,
    breachCount: overview.errors,
  }
}

function latestDefined<T>(items: T[], pick: (item: T) => string | undefined): string | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const value = pick(items[i]!)
    if (value !== undefined) return value
  }
  return undefined
}

function countDefined<T>(items: T[], pick: (item: T) => string | undefined): number {
  const seen = new Set<string>()
  for (const item of items) {
    const value = pick(item)
    if (value !== undefined) seen.add(value)
  }
  return seen.size
}

function signSnapshot(snapshot: SavingsSnapshot): string {
  const payload = {
    at: snapshot.at,
    tenantId: snapshot.tenantId,
    projectId: snapshot.projectId,
    windowMs: snapshot.windowMs,
    requests: snapshot.requests,
    inputTokens: snapshot.inputTokens,
    outputTokens: snapshot.outputTokens,
    actualCostUsd: snapshot.actualCostUsd,
    baselineCostUsd: snapshot.baselineCostUsd,
    savedUsd: snapshot.savedUsd,
    routingSavingsUsd: snapshot.routingSavingsUsd,
    cachingSavingsUsd: snapshot.cachingSavingsUsd,
    compressionSavingsUsd: snapshot.compressionSavingsUsd,
    savingsPct: snapshot.savingsPct,
    revenueUsd: snapshot.revenueUsd,
    marginUsd: snapshot.marginUsd,
    marginPct: snapshot.marginPct,
    users: snapshot.users,
    sources: snapshot.sources,
    baselineModel: snapshot.baselineModel,
    requestClass: snapshot.requestClass,
    windowStartAt: snapshot.windowStartAt,
    windowEndAt: snapshot.windowEndAt,
    frozenAt: snapshot.frozenAt,
    shadowMode: snapshot.shadowMode,
    metadata: snapshot.metadata,
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

/** A request event after the hub tags it with a source. */
type StoredRequest = RequestEvent & { source: string }

/**
 * Central in-memory aggregator. Holds a retention-bounded ring of every event
 * the operator has ingested and answers windowed queries off it (delegating the
 * math to the pure functions in `aggregate.ts`). Durability is the `store`'s job;
 * on `boot()` the hub replays the recent window to rebuild the ring after a
 * restart. Deliberately framework-free so it can run embedded or behind HTTP.
 */
export class TelemetryHub {
  private ring: StoredEvent[] = []
  private readonly store: TelemetryStore
  private readonly retentionMs: number
  private readonly maxEvents: number
  private readonly now: () => number
  readonly marginPct: number
  private treasury: TreasuryBalance[] | null = null

  constructor(opts: TelemetryHubOptions = {}) {
    this.store = opts.store ?? new NullTelemetryStore()
    this.retentionMs = opts.retentionMs ?? 48 * HOUR
    this.maxEvents = opts.maxEvents ?? 500_000
    this.marginPct = opts.marginPct ?? 15
    this.now = opts.now ?? Date.now
  }

  /** Replay the recent window from the store to rebuild aggregates after restart. */
  async boot(): Promise<void> {
    const since = this.now() - this.retentionMs
    const events = await this.store.replay(since)
    if (events.length) {
      this.ring = events
      this.prune()
    }
  }

  /**
   * Ingest a batch from one source. Tags each event with `source`, persists it,
   * and folds it into the ring. Persistence is awaited but failures are swallowed
   * so a bad disk never drops live telemetry from the in-memory view.
   */
  async ingest(source: string, events: TelemetryEvent[]): Promise<number> {
    if (!events.length) return 0
    const stored: StoredEvent[] = events.map((e) => ({ ...e, source }))

    let max = this.ring.length ? this.ring[this.ring.length - 1].at : -Infinity
    let needSort = false
    for (const e of stored) {
      this.ring.push(e)
      if (e.at < max) needSort = true
      else max = e.at
    }
    if (needSort) this.ring.sort((a, b) => a.at - b.at)
    this.prune()

    try {
      await this.store.append(stored)
    } catch {
      // Durability is best-effort; the live view already has the events.
    }
    return stored.length
  }

  /** Drop events older than retention, then trim to the size cap (oldest-first). */
  private prune(): void {
    const cutoff = this.now() - this.retentionMs
    let start = 0
    while (start < this.ring.length && this.ring[start].at < cutoff) start++
    if (start > 0) this.ring = this.ring.slice(start)
    if (this.ring.length > this.maxEvents) {
      this.ring = this.ring.slice(this.ring.length - this.maxEvents)
    }
  }

  /** Newest treasury balances, set by the server's poller. */
  setTreasuryBalances(balances: TreasuryBalance[] | null): void {
    this.treasury = balances
  }

  /** Flush and release the durable store. */
  async close(): Promise<void> {
    await this.store.close()
  }

  /** Distinct source ids seen in the ring (for the SPA's source filter). */
  knownSources(): string[] {
    const s = new Set<string>()
    for (const e of this.ring) s.add(e.source)
    return [...s].sort()
  }

  /** Events within `windowMs` of now, optionally filtered by source. */
  private windowed(windowMs: number, source?: string): { since: number; events: StoredEvent[] } {
    const since = this.now() - windowMs
    const events = this.ring.filter(
      (e) => e.at >= since && (source === undefined || e.source === source),
    )
    return { since, events }
  }

  overview(windowMs: number, source?: string): Overview {
    const { events } = this.windowed(windowMs, source)
    return computeOverview(events, windowMs, this.now(), this.marginPct)
  }

  timeseries(windowMs: number, buckets = 60, source?: string): TimeseriesBucket[] {
    const { since, events } = this.windowed(windowMs, source)
    const bucketMs = Math.max(60_000, Math.floor(windowMs / buckets))
    return computeTimeseries(events, since, this.now(), bucketMs, this.marginPct)
  }

  breakdown(
    dimension: 'model' | 'provider' | 'user' | 'source',
    windowMs: number,
    source?: string,
  ): BreakdownRow[] {
    const { events } = this.windowed(windowMs, source)
    const keyOf: Record<typeof dimension, (e: StoredRequest) => string | undefined> = {
      model: (e) => e.model ?? 'unknown',
      provider: (e) => e.provider ?? 'unknown',
      user: (e) => e.userId,
      source: (e) => e.source,
    }
    // Errors/failovers attribute to provider/model only (users/sources aren't on those events).
    const attributeErrors =
      dimension === 'provider'
        ? (e: StoredEvent) => ('provider' in e ? e.provider : undefined)
        : dimension === 'model'
          ? (e: StoredEvent) => ('model' in e ? e.model : undefined)
          : dimension === 'source'
            ? (e: StoredEvent) => e.source
            : () => undefined
    return computeBreakdown(events, keyOf[dimension], this.marginPct, attributeErrors)
  }

  errors(windowMs: number, source?: string): ErrorRow[] {
    const { events } = this.windowed(windowMs, source)
    return computeErrors(events)
  }

  feed(limit = 100, source?: string): FeedRow[] {
    const events = source ? this.ring.filter((e) => e.source === source) : this.ring
    return computeFeed(events, limit)
  }

  routingHealth(windowMs: number, source?: string): RoutingHealth {
    const { events } = this.windowed(windowMs, source)
    return computeRoutingHealth(events)
  }

  billing(windowMs: number, source?: string): BillingView {
    const { events } = this.windowed(windowMs, source)
    const overview = computeOverview(events, windowMs, this.now(), this.marginPct)
    const { rows, settledUsd, stuck } = computeSettlements(events, 100)
    return {
      revenueUsd: overview.revenueUsd,
      actualCostUsd: overview.actualCostUsd,
      marginUsd: overview.marginUsd,
      settledUsd,
      stuck,
      treasury: this.treasury,
      settlements: rows,
    }
  }

  savingsReport(
    windowMs: number,
    options: { tenantId?: string; projectId?: string; source?: string } = {},
  ): SavingsSnapshot {
    const { since, events } = this.windowed(windowMs, options.source)
    const overview = computeOverview(events, windowMs, this.now(), this.marginPct)
    const requests = events.filter((event): event is StoredRequest => event.kind === 'request')
    const snapshot = buildSavingsSnapshot({
      tenantId: options.tenantId ?? 'global',
      projectId: options.projectId,
      windowMs,
      at: this.now(),
      overview,
      baselineModel: latestDefined(requests, (r) => r.baselineModel),
      requestClass: latestDefined(requests, (r) => r.requestClass),
      windowStartAt: since,
      windowEndAt: this.now(),
      frozenAt: requests.at(-1)?.at ?? this.now(),
      shadowMode: countDefined(requests, (r) => r.baselineModel) > 0,
    })
    return {
      ...snapshot,
      signature: signSnapshot(snapshot),
    }
  }
}
