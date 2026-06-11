import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { StoredEvent } from './types.js'

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
function fileForDay(dir: string, atMs: number): string {
  const d = new Date(atMs)
  const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
  return join(dir, `events-${day}.jsonl`)
}

/**
 * Append-only JSONL store, one file per UTC day. Zero native deps and trivially
 * greppable. Writes are buffered through a per-day `WriteStream`; reads on boot
 * scan only the day-files that can overlap the replay window. Deliberately no
 * compaction — prune by deleting old day-files (cheap, and the hub only replays
 * the recent window anyway).
 */
export class JsonlTelemetryStore implements TelemetryStore {
  private streams = new Map<string, WriteStream>()
  private ready: Promise<void>

  constructor(private readonly dir: string) {
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

  async append(events: StoredEvent[]): Promise<void> {
    if (events.length === 0) return
    await this.ready
    // Group by day-file so a batch spanning midnight lands in the right files.
    const byPath = new Map<string, string[]>()
    for (const e of events) {
      const path = fileForDay(this.dir, e.at)
      const lines = byPath.get(path) ?? []
      lines.push(JSON.stringify(e))
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

  async replay(since: number): Promise<StoredEvent[]> {
    await this.ready
    let names: string[]
    try {
      names = await readdir(this.dir)
    } catch {
      return []
    }
    // Only day-files whose day could contain events at/after `since` (minus a
    // day of slack for clock skew / late arrivals).
    const cutoffDay = since - DAY_MS
    const files = names
      .filter((n) => n.startsWith('events-') && n.endsWith('.jsonl'))
      .filter((n) => {
        const day = Date.parse(n.slice('events-'.length, -'.jsonl'.length) + 'T00:00:00Z')
        return Number.isNaN(day) || day >= cutoffDay
      })
      .sort()

    const out: StoredEvent[] = []
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
          const ev = JSON.parse(line) as StoredEvent
          if (typeof ev.at === 'number' && ev.at >= since) out.push(ev)
        } catch {
          // Skip a torn final line from a crash mid-write.
        }
      }
    }
    out.sort((a, b) => a.at - b.at)
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
