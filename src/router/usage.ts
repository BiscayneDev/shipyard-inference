import type { UsageInfo } from '../types.js'

/** One completed request, as handed to a `UsageRecorder`. */
export interface UsageRecord {
  candidateId: string
  model?: string
  usage?: UsageInfo
  actualCostUsd?: number
  /** Cost the same request would have incurred on the baseline model, direct/uncached. */
  baselineCostUsd?: number
  /** `baselineCostUsd − actualCostUsd` when both are known. */
  savedUsd?: number
  /** Savings split for auditability. */
  routingSavingsUsd?: number
  cachingSavingsUsd?: number
  compressionSavingsUsd?: number
  /** Frozen baseline path for the savings report. */
  baselineModel?: string
  /** Customer request class used to keep the baseline scoped honestly. */
  requestClass?: string
  /** Opaque end-user id from `LLMChatParams.metadata.userId`, for per-user attribution. */
  userId?: string
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
  /** Baseline (direct/uncached) cost summed across requests that had a baseline. */
  baselineCostUsd: number
  /** Total saved vs baseline (`baselineCostUsd − costUsd` over those requests). */
  savedUsd: number
}

export interface UsageTotals extends UsageModelTotals {
  /** Per-model breakdown, keyed by model id (or `'unknown'`). */
  perModel: Record<string, UsageModelTotals>
  /** Per-user breakdown, keyed by `userId` (records without a userId are omitted). */
  perUser: Record<string, UsageModelTotals>
}

function emptyTotals(): UsageModelTotals {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    baselineCostUsd: 0,
    savedUsd: 0,
  }
}

/**
 * In-memory aggregator: running totals plus a per-model breakdown. Deliberately
 * minimal — no persistence, no eviction. Read with `totals()`, clear with
 * `reset()`. Off by default; pass one as `RouterOptions.usageRecorder`.
 */
export class MemoryUsageRecorder implements UsageRecorder {
  private overall = emptyTotals()
  private byModel = new Map<string, UsageModelTotals>()
  private byUser = new Map<string, UsageModelTotals>()

  record(record: UsageRecord): void {
    const inputTokens = record.usage?.inputTokens ?? 0
    const outputTokens = record.usage?.outputTokens ?? 0
    const cost = record.actualCostUsd ?? 0
    // Only credit baseline/saved when a baseline was computed, so the savings
    // total is honest (never invents savings for unpriced/no-baseline requests).
    const baseline = record.baselineCostUsd ?? 0
    const saved = record.savedUsd ?? 0

    const add = (t: UsageModelTotals): void => {
      t.requests += 1
      t.inputTokens += inputTokens
      t.outputTokens += outputTokens
      t.costUsd += cost
      t.baselineCostUsd += baseline
      t.savedUsd += saved
    }

    add(this.overall)

    const modelKey = record.model ?? 'unknown'
    const model = this.byModel.get(modelKey) ?? emptyTotals()
    add(model)
    this.byModel.set(modelKey, model)

    if (record.userId !== undefined) {
      const user = this.byUser.get(record.userId) ?? emptyTotals()
      add(user)
      this.byUser.set(record.userId, user)
    }
  }

  totals(): UsageTotals {
    const perModel: Record<string, UsageModelTotals> = {}
    for (const [model, totals] of this.byModel) perModel[model] = { ...totals }
    const perUser: Record<string, UsageModelTotals> = {}
    for (const [user, totals] of this.byUser) perUser[user] = { ...totals }
    return { ...this.overall, perModel, perUser }
  }

  reset(): void {
    this.overall = emptyTotals()
    this.byModel.clear()
    this.byUser.clear()
  }
}
