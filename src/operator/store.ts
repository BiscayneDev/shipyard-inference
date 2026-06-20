import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  ApiKey,
  BillingPlan,
  BillingSummary,
  ControlPlaneQuery,
  ControlPlaneRecord,
  Project,
  SavingsSnapshot,
  SlaSummary,
  StoredEvent,
  Tenant,
  UsageRecord,
} from './types.js'

/**
 * Durable sink for telemetry. The hub appends every ingested event here and, on
 * boot, replays the recent window to rebuild its in-memory aggregates. Pluggable
 * so a SQLite/Postgres-backed store can drop in later without touching the hub.
 */
export interface TelemetryStore {
  /** Persist a batch (best-effort; must not throw into the ingest path). */
  append(events: StoredEvent[]): Promise<void>
  /** Replay events with `at >= since` (unix-ms), oldest-first, to rebuild state. */
  replay(since: number): Promise<StoredEvent[]>
  /** Flush + release handles. */
  close(): Promise<void>
}

/** A store that keeps nothing — for tests / embedded use that don't need durability. */
export class NullTelemetryStore implements TelemetryStore {
  async append(): Promise<void> {}
  async replay(): Promise<StoredEvent[]> {
    return []
  }
  async close(): Promise<void> {}
}

const DAY_MS = 86_400_000

/** `events-YYYY-MM-DD.jsonl` for a given unix-ms day (UTC). */
function fileForDay(dir: string, atMs: number, prefix: string): string {
  const d = new Date(atMs)
  const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
  return join(dir, `${prefix}-${day}.jsonl`)
}

/** Shared append-only JSONL mechanics for telemetry and control-plane data. */
class JsonlDayStore<T> {
  private streams = new Map<string, WriteStream>()
  private ready: Promise<void>

  constructor(
    private readonly dir: string,
    private readonly prefix: string,
    private readonly timeOf: (record: T) => number,
  ) {
    this.ready = mkdir(dir, { recursive: true }).then(() => undefined)
  }

  private stream(path: string): WriteStream {
    let s = this.streams.get(path)
    if (!s) {
      s = createWriteStream(path, { flags: 'a' })
      this.streams.set(path, s)
    }
    return s
  }

  private async listFiles(): Promise<string[]> {
    try {
      return await readdir(this.dir)
    } catch {
      return []
    }
  }

  append(records: T[]): Promise<void> {
    if (records.length === 0) return Promise.resolve()
    const doAppend = async (): Promise<void> => {
      await this.ready
      const byPath = new Map<string, string[]>()
      for (const record of records) {
        const path = fileForDay(this.dir, this.timeOf(record), this.prefix)
        const lines = byPath.get(path) ?? []
        lines.push(JSON.stringify(record))
        byPath.set(path, lines)
      }
      await Promise.all(
        [...byPath].map(
          ([path, lines]) =>
            new Promise<void>((resolve, reject) => {
              this.stream(path).write(lines.join('\n') + '\n', (err) =>
                err ? reject(err) : resolve(),
              )
            }),
        ),
      )
    }
    return doAppend()
  }

  async read(filter: { since?: number; until?: number } = {}): Promise<T[]> {
    await this.ready
    const since = filter.since ?? Number.NEGATIVE_INFINITY
    const until = filter.until ?? Number.POSITIVE_INFINITY
    const names = await this.listFiles()
    const files = names
      .filter((n) => n.startsWith(`${this.prefix}-`) && n.endsWith('.jsonl'))
      .filter((n) => {
        const day = Date.parse(n.slice(this.prefix.length + 1, -'.jsonl'.length) + 'T00:00:00Z')
        const cutoffDay = since - DAY_MS
        return Number.isNaN(day) || day >= cutoffDay
      })
      .sort()

    const out: T[] = []
    for (const name of files) {
      let text: string
      try {
        text = await readFile(join(this.dir, name), 'utf8')
      } catch {
        continue
      }
      for (const line of text.split('\n')) {
        if (!line) continue
        try {
          const record = JSON.parse(line) as T
          const at = this.timeOf(record)
          if (typeof at === 'number' && at >= since && at <= until) {
            out.push(record)
          }
        } catch {
          // Skip a torn final line from a crash mid-write.
        }
      }
    }
    out.sort((a, b) => this.timeOf(a) - this.timeOf(b))
    return out
  }

  async close(): Promise<void> {
    await Promise.all(
      [...this.streams.values()].map(
        (s) => new Promise<void>((resolve) => s.end(() => resolve())),
      ),
    )
    this.streams.clear()
  }
}

/**
 * Append-only JSONL store, one file per UTC day. Zero native deps and trivially
 * greppable. Writes are buffered through a per-day `WriteStream`; reads on boot
 * scan only the day-files that can overlap the replay window. Deliberately no
 * compaction — prune by deleting old day-files (cheap, and the hub only replays
 * the recent window anyway).
 */
export class JsonlTelemetryStore implements TelemetryStore {
  private readonly store: JsonlDayStore<StoredEvent>

  constructor(dir: string) {
    this.store = new JsonlDayStore<StoredEvent>(dir, 'events', telemetryTimeOf)
  }

  append(events: StoredEvent[]): Promise<void> {
    return this.store.append(events)
  }

  replay(since: number): Promise<StoredEvent[]> {
    return this.store.read({ since })
  }

  close(): Promise<void> {
    return this.store.close()
  }
}

export interface ControlPlaneStore {
  append(records: ControlPlaneRecord[]): Promise<void>
  query(filter?: ControlPlaneQuery): Promise<ControlPlaneRecord[]>
  billingSummary(filter: ControlPlaneQuery & { windowMs: number }): Promise<BillingSummary>
  close(): Promise<void>
}

function kindMatches(kind: ControlPlaneQuery['kind'], recordKind: string): boolean {
  if (kind === undefined) return true
  return Array.isArray(kind) ? kind.includes(recordKind as never) : kind === recordKind
}

function isTenantRecord(record: ControlPlaneRecord): record is Tenant {
  return record.kind === 'tenant'
}

function isProjectRecord(record: ControlPlaneRecord): record is Project {
  return record.kind === 'project'
}

function isUsageRecord(record: ControlPlaneRecord): record is UsageRecord {
  return record.kind === 'usage'
}

function isSavingsSnapshot(record: ControlPlaneRecord): record is SavingsSnapshot {
  return record.kind === 'savings_snapshot'
}

function isBillingPlan(record: ControlPlaneRecord): record is BillingPlan {
  return record.kind === 'billing_plan'
}

function isSlaSummary(record: ControlPlaneRecord): record is SlaSummary {
  return record.kind === 'sla_summary'
}

function recordTenantId(record: ControlPlaneRecord): string | undefined {
  if (isTenantRecord(record)) return record.id
  if ('tenantId' in record) return record.tenantId
  return undefined
}

function recordProjectId(record: ControlPlaneRecord): string | undefined {
  if (isProjectRecord(record)) return record.id
  if ('projectId' in record) return record.projectId
  return undefined
}

function latestByAt<T extends { at: number }>(records: T[]): T | null {
  if (records.length === 0) return null
  return records.reduce((best, record) => (record.at > best.at ? record : best))
}

function latestBy<T>(records: T[], score: (record: T) => number): T | null {
  if (records.length === 0) return null
  return records.reduce((best, record) => (score(record) > score(best) ? record : best))
}

function telemetryTimeOf(record: StoredEvent): number {
  return record.at
}

function controlPlaneTimeOf(record: ControlPlaneRecord): number {
  switch (record.kind) {
    case 'tenant':
      return record.updatedAt ?? record.createdAt
    case 'project':
      return record.updatedAt ?? record.createdAt
    case 'api_key':
      return record.lastUsedAt ?? record.revokedAt ?? record.createdAt
    case 'usage':
    case 'savings_snapshot':
    case 'sla_summary':
      return record.at
    case 'billing_plan':
      return record.createdAt
  }
}

/**
 * Append-only JSONL store for hosted control-plane entities. Records are
 * durable, queryable by tenant/project, and remain easy to inspect with plain
 * text tools.
 */
export class JsonlControlPlaneStore implements ControlPlaneStore {
  private readonly store: JsonlDayStore<ControlPlaneRecord>

  constructor(dir: string) {
    this.store = new JsonlDayStore<ControlPlaneRecord>(dir, 'control-plane', controlPlaneTimeOf)
  }

  append(records: ControlPlaneRecord[]): Promise<void> {
    return this.store.append(records)
  }

  async query(filter: ControlPlaneQuery = {}): Promise<ControlPlaneRecord[]> {
    const records = await this.store.read({ since: filter.since, until: filter.until })
    const projectRecords = records.filter(isProjectRecord)
    const project = filter.projectId
      ? projectRecords.filter((r) => r.id === filter.projectId).at(-1) ?? null
      : null
    const resolvedTenantId = filter.tenantId ?? project?.tenantId
    return records.filter((record) => {
      if (!kindMatches(filter.kind, record.kind)) return false
      const tenantId = recordTenantId(record)
      const projectId = recordProjectId(record)
      if (resolvedTenantId !== undefined && tenantId !== resolvedTenantId) return false
      if (filter.projectId === undefined) return true
      if (projectId === filter.projectId) return true
      if (isProjectRecord(record) && record.id === filter.projectId) return true
      // Tenant-scoped records still matter for a project query because they carry
      // the shared tenant metadata/billing plan that applies to the project.
      return tenantId !== undefined && tenantId === resolvedTenantId
    })
  }

  async billingSummary(filter: ControlPlaneQuery & { windowMs: number }): Promise<BillingSummary> {
    const scope = await this.query(filter)
    const usage = scope.filter(isUsageRecord)
    const snapshots = scope.filter(isSavingsSnapshot)
    const plans = scope.filter(isBillingPlan)
    const slas = scope.filter(isSlaSummary)
    const latestUsageAt = usage.at(-1)?.at
    const latestSnapshot = snapshots.at(-1) ?? null
    const latestPlan = plans.at(-1) ?? null
    const latestSla = slas.at(-1) ?? null
    const requests = usage.length
    const inputTokens = usage.reduce((sum, r) => sum + r.inputTokens, 0)
    const outputTokens = usage.reduce((sum, r) => sum + r.outputTokens, 0)
    const actualCostUsd = usage.reduce((sum, r) => sum + (r.actualCostUsd ?? 0), 0)
    const baselineCostUsd = usage.reduce((sum, r) => sum + (r.baselineCostUsd ?? 0), 0)
    const savedUsd = usage.reduce((sum, r) => sum + (r.savedUsd ?? 0), 0)
    const snapshotRevenueUsd = latestSnapshot?.revenueUsd ?? actualCostUsd
    const snapshotMarginUsd = latestSnapshot?.marginUsd ?? snapshotRevenueUsd - actualCostUsd
    const snapshotSavingsPct = latestSnapshot?.savingsPct ?? (baselineCostUsd ? savedUsd / baselineCostUsd : 0)
    const marginPct = latestSnapshot?.marginPct ?? (snapshotRevenueUsd ? snapshotMarginUsd / snapshotRevenueUsd : 0)
    const projectRecords = scope.filter(isProjectRecord)
    const tenantId = filter.tenantId ?? projectRecords.at(-1)?.tenantId
    if (!tenantId) {
      throw new Error('billingSummary requires `tenantId` or `projectId`')
    }
    return {
      at: latestUsageAt ?? latestSnapshot?.at ?? latestPlan?.createdAt ?? latestSla?.at ?? Date.now(),
      windowMs: filter.windowMs,
      tenantId,
      projectId: filter.projectId,
      requests,
      inputTokens,
      outputTokens,
      actualCostUsd,
      baselineCostUsd,
      savedUsd,
      savingsPct: snapshotSavingsPct,
      revenueUsd: snapshotRevenueUsd,
      marginUsd: snapshotMarginUsd,
      marginPct,
      plan: latestPlan,
      savingsSnapshot: latestSnapshot,
      sla: latestSla,
    }
  }

  close(): Promise<void> {
    return this.store.close()
  }
}
