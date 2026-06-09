import type { UsageInfo } from '../types.js'

/** One completed request, as handed to a `UsageRecorder`. */
export interface UsageRecord {
  candidateId: string
  model?: string
  usage?: UsageInfo
  actualCostUsd?: number
  latencyMs: number
  /** Unix-ms timestamp the request completed. */
  at: number
}

/**
 * Sink for completed-request telemetry. The Router calls `record` once per
 * successful request (alongside the `request_completed` event). Bring your own
 * implementation to forward to a metrics backend, or use `MemoryUsageRecorder`.
 */
export interface UsageRecorder {
  record(record: UsageRecord): void
}

export interface UsageModelTotals {
  requests: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface UsageTotals extends UsageModelTotals {
  /** Per-model breakdown, keyed by model id (or `'unknown'`). */
  perModel: Record<string, UsageModelTotals>
}

function emptyTotals(): UsageModelTotals {
  return { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
}

/**
 * In-memory aggregator: running totals plus a per-model breakdown. Deliberately
 * minimal — no persistence, no eviction. Read with `totals()`, clear with
 * `reset()`. Off by default; pass one as `RouterOptions.usageRecorder`.
 */
export class MemoryUsageRecorder implements UsageRecorder {
  private overall = emptyTotals()
  private byModel = new Map<string, UsageModelTotals>()

  record(record: UsageRecord): void {
    const inputTokens = record.usage?.inputTokens ?? 0
    const outputTokens = record.usage?.outputTokens ?? 0
    const cost = record.actualCostUsd ?? 0

    this.overall.requests += 1
    this.overall.inputTokens += inputTokens
    this.overall.outputTokens += outputTokens
    this.overall.costUsd += cost

    const key = record.model ?? 'unknown'
    const model = this.byModel.get(key) ?? emptyTotals()
    model.requests += 1
    model.inputTokens += inputTokens
    model.outputTokens += outputTokens
    model.costUsd += cost
    this.byModel.set(key, model)
  }

  totals(): UsageTotals {
    const perModel: Record<string, UsageModelTotals> = {}
    for (const [model, totals] of this.byModel) perModel[model] = { ...totals }
    return { ...this.overall, perModel }
  }

  reset(): void {
    this.overall = emptyTotals()
    this.byModel.clear()
  }
}
