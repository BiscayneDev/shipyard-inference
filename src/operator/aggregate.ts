import type {
  BreakdownRow,
  ErrorRow,
  FeedRow,
  Overview,
  ProviderHealthRow,
  RequestEvent,
  RoutingHealth,
  SettlementRow,
  StoredEvent,
  TimeseriesBucket,
} from './types.js'

/** Modeled revenue for one request: actual + margin, capped at the baseline. */
export function modeledRevenueUsd(
  actualCostUsd: number | undefined,
  baselineCostUsd: number | undefined,
  marginPct: number,
): number {
  if (actualCostUsd === undefined) return 0
  const withMargin = actualCostUsd * (1 + marginPct / 100)
  return baselineCostUsd !== undefined ? Math.min(withMargin, baselineCostUsd) : withMargin
}

/** Nearest-rank percentile over an already-sorted ascending array. */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0
  const rank = Math.ceil((p / 100) * sortedAsc.length)
  return sortedAsc[Math.min(sortedAsc.length - 1, Math.max(0, rank - 1))]
}

const isRequest = (e: StoredEvent): e is RequestEvent & { source: string } => e.kind === 'request'

/** Top-line rolling counters + the modeled-revenue view over `events`. */
export function computeOverview(
  events: StoredEvent[],
  windowMs: number,
  now: number,
  marginPct: number,
): Overview {
  let requests = 0
  let inputTokens = 0
  let outputTokens = 0
  let errors = 0
  let failovers = 0
  let retries = 0
  let cacheHits = 0
  let cacheMisses = 0
  let actualCostUsd = 0
  let baselineCostUsd = 0
  let savedUsd = 0
  let revenueUsd = 0
  const latencies: number[] = []
  const users = new Set<string>()
  const sources = new Set<string>()

  for (const e of events) {
    sources.add(e.source)
    switch (e.kind) {
      case 'request':
        requests++
        inputTokens += e.inputTokens
        outputTokens += e.outputTokens
        actualCostUsd += e.actualCostUsd ?? 0
        baselineCostUsd += e.baselineCostUsd ?? 0
        savedUsd += e.savedUsd ?? 0
        revenueUsd += modeledRevenueUsd(e.actualCostUsd, e.baselineCostUsd, marginPct)
        latencies.push(e.latencyMs)
        if (e.userId) users.add(e.userId)
        break
      case 'error':
        errors++
        break
      case 'failover':
        failovers++
        break
      case 'retry':
        retries++
        break
      case 'cache':
        if (e.hit) cacheHits++
        else cacheMisses++
        break
    }
  }

  latencies.sort((a, b) => a - b)
  const minutes = windowMs / 60_000 || 1
  const lookups = cacheHits + cacheMisses
  const marginUsd = revenueUsd - actualCostUsd

  return {
    windowMs,
    at: now,
    requests,
    rpm: requests / minutes,
    inputTokens,
    outputTokens,
    tpm: (inputTokens + outputTokens) / minutes,
    errors,
    failovers,
    retries,
    cacheHits,
    cacheMisses,
    cacheHitRate: lookups ? cacheHits / lookups : 0,
    failoverRate: requests ? failovers / requests : 0,
    errorRate: errors + requests ? errors / (errors + requests) : 0,
    actualCostUsd,
    baselineCostUsd,
    savedUsd,
    savingsPct: baselineCostUsd ? savedUsd / baselineCostUsd : 0,
    revenueUsd,
    marginUsd,
    marginPct: revenueUsd ? marginUsd / revenueUsd : 0,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    latencyP99Ms: percentile(latencies, 99),
    users: users.size,
    sources: sources.size,
  }
}

/** Bucket request/error/cost telemetry into a time series. */
export function computeTimeseries(
  events: StoredEvent[],
  since: number,
  now: number,
  bucketMs: number,
  marginPct: number,
): TimeseriesBucket[] {
  const n = Math.max(1, Math.ceil((now - since) / bucketMs))
  const buckets: TimeseriesBucket[] = []
  const lat: number[][] = []
  for (let i = 0; i < n; i++) {
    buckets.push({
      t: since + i * bucketMs,
      requests: 0,
      errors: 0,
      actualCostUsd: 0,
      savedUsd: 0,
      revenueUsd: 0,
      latencyP95Ms: 0,
      inputTokens: 0,
      outputTokens: 0,
    })
    lat.push([])
  }
  const idxOf = (at: number): number =>
    Math.min(n - 1, Math.max(0, Math.floor((at - since) / bucketMs)))

  for (const e of events) {
    if (e.at < since) continue
    const i = idxOf(e.at)
    const b = buckets[i]
    if (e.kind === 'request') {
      b.requests++
      b.actualCostUsd += e.actualCostUsd ?? 0
      b.savedUsd += e.savedUsd ?? 0
      b.revenueUsd += modeledRevenueUsd(e.actualCostUsd, e.baselineCostUsd, marginPct)
      b.inputTokens += e.inputTokens
      b.outputTokens += e.outputTokens
      lat[i].push(e.latencyMs)
    } else if (e.kind === 'error') {
      b.errors++
    }
  }
  for (let i = 0; i < n; i++) {
    const s = lat[i].sort((a, b) => a - b)
    buckets[i].latencyP95Ms = percentile(s, 95)
  }
  return buckets
}

/** Group requests by a key (model/provider/user/source) into sortable rows. */
export function computeBreakdown(
  events: StoredEvent[],
  keyOf: (e: RequestEvent & { source: string }) => string | undefined,
  marginPct: number,
  attributeErrors: (e: StoredEvent) => string | undefined = () => undefined,
): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow & { _latSum: number }>()
  const row = (key: string): BreakdownRow & { _latSum: number } => {
    let r = rows.get(key)
    if (!r) {
      r = {
        key,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        actualCostUsd: 0,
        baselineCostUsd: 0,
        savedUsd: 0,
        revenueUsd: 0,
        marginUsd: 0,
        errors: 0,
        failovers: 0,
        avgLatencyMs: 0,
        _latSum: 0,
      }
      rows.set(key, r)
    }
    return r
  }

  for (const e of events) {
    if (isRequest(e)) {
      const key = keyOf(e)
      if (key === undefined) continue
      const r = row(key)
      r.requests++
      r.inputTokens += e.inputTokens
      r.outputTokens += e.outputTokens
      r.actualCostUsd += e.actualCostUsd ?? 0
      r.baselineCostUsd += e.baselineCostUsd ?? 0
      r.savedUsd += e.savedUsd ?? 0
      const rev = modeledRevenueUsd(e.actualCostUsd, e.baselineCostUsd, marginPct)
      r.revenueUsd += rev
      r.marginUsd += rev - (e.actualCostUsd ?? 0)
      r._latSum += e.latencyMs
    } else if (e.kind === 'error' || e.kind === 'failover') {
      const key = attributeErrors(e)
      if (key === undefined) continue
      const r = row(key)
      if (e.kind === 'error') r.errors++
      else r.failovers++
    }
  }

  return [...rows.values()]
    .map(({ _latSum, ...r }) => ({ ...r, avgLatencyMs: r.requests ? _latSum / r.requests : 0 }))
    .sort((a, b) => b.actualCostUsd - a.actualCostUsd || b.requests - a.requests)
}

/** Tally attempt errors by message, newest occurrence first. */
export function computeErrors(events: StoredEvent[]): ErrorRow[] {
  const rows = new Map<string, ErrorRow>()
  for (const e of events) {
    if (e.kind !== 'error') continue
    const message = e.error ?? 'unknown error'
    const r = rows.get(message)
    if (r) {
      r.count++
      if (e.at > r.lastAt) {
        r.lastAt = e.at
        r.lastProvider = e.provider
        r.lastModel = e.model
      }
    } else {
      rows.set(message, {
        message,
        count: 1,
        lastAt: e.at,
        lastProvider: e.provider,
        lastModel: e.model,
      })
    }
  }
  return [...rows.values()].sort((a, b) => b.lastAt - a.lastAt)
}

/** Most-recent requests, newest first, capped at `limit`. */
export function computeFeed(events: StoredEvent[], limit: number): FeedRow[] {
  const out: FeedRow[] = []
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const e = events[i]
    if (!isRequest(e)) continue
    out.push({
      at: e.at,
      source: e.source,
      provider: e.provider,
      model: e.model,
      userId: e.userId,
      inputTokens: e.inputTokens,
      outputTokens: e.outputTokens,
      actualCostUsd: e.actualCostUsd,
      savedUsd: e.savedUsd,
      latencyMs: e.latencyMs,
      pinned: e.pinned,
    })
  }
  return out
}

/** Routing-health rollup: selection mix, pinned/auto, per-provider availability. */
export function computeRoutingHealth(events: StoredEvent[]): RoutingHealth {
  const selections = new Map<string, number>()
  let pinnedRequests = 0
  let autoRequests = 0
  let failovers = 0
  let retries = 0
  let cacheHits = 0
  let cacheMisses = 0
  const prov = new Map<
    string,
    { requests: number; errors: number; failovers: number; latSum: number }
  >()
  const provRow = (p: string) => {
    let r = prov.get(p)
    if (!r) {
      r = { requests: 0, errors: 0, failovers: 0, latSum: 0 }
      prov.set(p, r)
    }
    return r
  }

  for (const e of events) {
    switch (e.kind) {
      case 'request': {
        if (e.pinned) pinnedRequests++
        else autoRequests++
        if (e.model) selections.set(e.model, (selections.get(e.model) ?? 0) + 1)
        if (e.provider) {
          const r = provRow(e.provider)
          r.requests++
          r.latSum += e.latencyMs
        }
        break
      }
      case 'error':
        if (e.provider) provRow(e.provider).errors++
        break
      case 'failover':
        failovers++
        if (e.provider) provRow(e.provider).failovers++
        break
      case 'retry':
        retries++
        break
      case 'cache':
        if (e.hit) cacheHits++
        else cacheMisses++
        break
    }
  }

  const providers: ProviderHealthRow[] = [...prov.entries()]
    .map(([provider, r]) => ({
      provider,
      requests: r.requests,
      errors: r.errors,
      failovers: r.failovers,
      availability: r.requests + r.errors ? r.requests / (r.requests + r.errors) : 1,
      avgLatencyMs: r.requests ? r.latSum / r.requests : 0,
    }))
    .sort((a, b) => b.requests - a.requests)

  return {
    selections: [...selections.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    pinnedRequests,
    autoRequests,
    failovers,
    retries,
    cacheHits,
    cacheMisses,
    providers,
  }
}

/** Settlement rows + settled/stuck totals over the window. */
export function computeSettlements(events: StoredEvent[], limit: number): {
  rows: SettlementRow[]
  settledUsd: number
  stuck: number
} {
  const rows: SettlementRow[] = []
  let settledUsd = 0
  let stuck = 0
  for (const e of events) {
    if (e.kind !== 'settlement') continue
    if (e.status === 'settled') settledUsd += e.amountUsd
    if (e.status === 'failed' || e.status === 'frozen') stuck++
    rows.push({
      at: e.at,
      source: e.source,
      userId: e.userId,
      amountUsd: e.amountUsd,
      status: e.status,
      signature: e.signature,
      treasury: e.treasury,
      network: e.network,
      error: e.error,
    })
  }
  rows.sort((a, b) => b.at - a.at)
  return { rows: rows.slice(0, limit), settledUsd, stuck }
}
