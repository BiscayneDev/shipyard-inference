import type { RouterEvent } from '../router/router.js'
import type { TelemetryHub } from './hub.js'
import type { SettlementStatus, TelemetryEvent } from './types.js'

/** Details the billing side reports for a settlement (outside the Router). */
export interface SettlementReport {
  userId?: string
  amountUsd: number
  status: SettlementStatus
  signature?: string
  treasury?: string
  network?: 'mainnet' | 'devnet'
  error?: string
}

/**
 * The drop-in an integration wires into its Router/gateway. `onEvent` is the
 * single hook — pass it as `RouterOptions.onEvent` and every routing decision,
 * failover, retry, error, cache lookup, and completed request flows to the
 * operator hub. `recordSettlement` reports real USDC collection from the billing
 * side. It is fire-and-forget: a bounded queue + best-effort delivery so it can
 * never block, throw into, or slow down the inference hot path.
 */
export interface TelemetryReporter {
  /** Wire as `new Router({ onEvent: reporter.onEvent })`. */
  onEvent: (event: RouterEvent) => void
  /** Report a settlement outcome from the billing layer. */
  recordSettlement: (report: SettlementReport) => void
  /** Force-send everything queued right now. */
  flush: () => Promise<void>
  /** Flush and stop the background timer. */
  close: () => Promise<void>
}

export interface TelemetryReporterOptions {
  /** Operator hub base URL, e.g. `http://localhost:8799`. */
  url: string
  /** Ingest token (`SHIPYARD_TELEMETRY_TOKEN`). */
  token?: string
  /** Deployment id this telemetry is tagged with, e.g. `'dock-prod'`. */
  source: string
  /** Max ms between auto-flushes. Default 2000. */
  flushMs?: number
  /** Flush early once this many events are queued. Default 256. */
  batchSize?: number
  /** Drop oldest beyond this many queued events. Default 10000. */
  maxQueue?: number
  /** Injectable fetch (tests). Defaults to global `fetch`. */
  fetch?: typeof fetch
  /** Called once per delivery failure (debugging). */
  onError?: (err: unknown) => void
}

const trunc = (s: string, n = 300): string => (s.length > n ? s.slice(0, n) + '…' : s)

function errMessage(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined
  if (error instanceof Error) return trunc(error.message)
  return trunc(String(error))
}

/**
 * Translate one `RouterEvent` into a `TelemetryEvent`. Returns `null` for events
 * the operator doesn't track at request granularity (`route_success` — redundant
 * with `request_completed`, which carries the authoritative cost/usage/savings).
 */
function normalize(event: RouterEvent, at: number): TelemetryEvent | null {
  switch (event.type) {
    case 'request_completed':
      return {
        kind: 'request',
        at,
        provider: event.candidateId,
        model: event.model,
        userId: event.userId,
        inputTokens: event.usage?.inputTokens ?? 0,
        outputTokens: event.usage?.outputTokens ?? 0,
        cacheReadTokens: event.usage?.cacheReadTokens,
        cacheWriteTokens: event.usage?.cacheWriteTokens,
        actualCostUsd: event.actualCostUsd,
        baselineCostUsd: event.baselineCostUsd,
        savedUsd: event.savedUsd,
        latencyMs: event.latencyMs,
        pinned: event.pinned,
      }
    case 'route_selected':
      return {
        kind: 'route_selected',
        at,
        provider: event.candidateId,
        model: event.model,
        estimatedCostUsd: event.estimatedCostUsd,
      }
    case 'failover':
      return { kind: 'failover', at, provider: event.candidateId, model: event.model, error: errMessage(event.error) }
    case 'retry':
      return {
        kind: 'retry',
        at,
        provider: event.candidateId,
        model: event.model,
        retryAttempt: event.retryAttempt,
        delayMs: event.delayMs,
        error: errMessage(event.error),
      }
    case 'route_error':
      return { kind: 'error', at, provider: event.candidateId, model: event.model, error: errMessage(event.error) }
    case 'cache_hit':
      return { kind: 'cache', at, hit: true }
    case 'cache_miss':
      return { kind: 'cache', at, hit: false }
    default:
      return null
  }
}

/** Shared machinery: a bounded queue drained by `send`, on a timer + size trigger. */
function makeReporter(
  send: (source: string, events: TelemetryEvent[]) => Promise<void>,
  source: string,
  opts: { flushMs?: number; batchSize?: number; maxQueue?: number; onError?: (err: unknown) => void },
): TelemetryReporter {
  const flushMs = opts.flushMs ?? 2000
  const batchSize = opts.batchSize ?? 256
  const maxQueue = opts.maxQueue ?? 10_000
  let queue: TelemetryEvent[] = []
  let inFlight: Promise<void> = Promise.resolve()
  let closed = false

  const drain = (): Promise<void> => {
    if (queue.length === 0) return inFlight
    const batch = queue
    queue = []
    inFlight = inFlight
      .then(() => send(source, batch))
      .catch((err) => opts.onError?.(err))
    return inFlight
  }

  const enqueue = (event: TelemetryEvent | null): void => {
    if (!event || closed) return
    queue.push(event)
    if (queue.length > maxQueue) queue.splice(0, queue.length - maxQueue)
    if (queue.length >= batchSize) void drain()
  }

  // unref so a reporter never keeps a process alive on its own.
  const timer = setInterval(() => void drain(), flushMs)
  if (typeof timer.unref === 'function') timer.unref()

  const now = (): number => Date.now()

  return {
    onEvent: (event) => enqueue(normalize(event, now())),
    recordSettlement: (report) =>
      enqueue({ kind: 'settlement', at: now(), ...report }),
    flush: () => drain(),
    close: async () => {
      closed = true
      clearInterval(timer)
      await drain()
      await inFlight
    },
  }
}

/** A reporter that POSTs batches to a remote operator hub. */
export function createTelemetryReporter(opts: TelemetryReporterOptions): TelemetryReporter {
  const doFetch = opts.fetch ?? fetch
  const endpoint = opts.url.replace(/\/$/, '') + '/ingest'
  const send = async (source: string, events: TelemetryEvent[]): Promise<void> => {
    const res = await doFetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: JSON.stringify({ source, events }),
    })
    if (!res.ok) throw new Error(`[shipyard-operator] ingest failed: ${res.status}`)
  }
  return makeReporter(send, opts.source, opts)
}

/** A reporter that feeds an in-process hub directly (no HTTP). */
export function createInProcessReporter(
  hub: TelemetryHub,
  source: string,
  opts: { flushMs?: number; batchSize?: number; maxQueue?: number } = {},
): TelemetryReporter {
  const send = async (src: string, events: TelemetryEvent[]): Promise<void> => {
    await hub.ingest(src, events)
  }
  return makeReporter(send, source, opts)
}
