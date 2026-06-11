import type { TelemetryStore } from './store.js'
import type { StoredEvent } from './types.js'

/**
 * Postgres-backed {@link TelemetryStore} for serverless deployments (Vercel),
 * where there is no long-lived process or local disk to hold the JSONL files.
 * Talks to Supabase via PostgREST over plain `fetch` — no client library, no
 * connection pool, so it is safe to construct per-invocation in a function.
 *
 * Expects a table created by {@link SUPABASE_TELEMETRY_SCHEMA}:
 *
 *   telemetry_events(id bigserial pk, at bigint, source text, kind text, event jsonb)
 *
 * `event` holds the full {@link StoredEvent}; `at`/`source`/`kind` are lifted
 * out as indexed columns so replay is a single range scan.
 */
export interface SupabaseTelemetryStoreOptions {
  /** Project URL, e.g. `https://abcd.supabase.co`. */
  url: string
  /** Service-role (or a key with insert+select on the table) key. */
  key: string
  /** Table name. Default `telemetry_events`. */
  table?: string
  /** Injectable fetch (tests). Defaults to global `fetch`. */
  fetch?: typeof fetch
}

interface RestRow {
  event: StoredEvent
}

export class SupabaseTelemetryStore implements TelemetryStore {
  private readonly base: string
  private readonly table: string
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof fetch

  constructor(opts: SupabaseTelemetryStoreOptions) {
    if (!opts.url) throw new Error('SupabaseTelemetryStore: `url` is required')
    if (!opts.key) throw new Error('SupabaseTelemetryStore: `key` is required')
    this.base = opts.url.replace(/\/+$/, '') + '/rest/v1'
    this.table = opts.table ?? 'telemetry_events'
    this.fetchImpl = opts.fetch ?? fetch
    this.headers = {
      apikey: opts.key,
      authorization: `Bearer ${opts.key}`,
      'content-type': 'application/json',
    }
  }

  async append(events: StoredEvent[]): Promise<void> {
    if (events.length === 0) return
    const rows = events.map((e) => ({
      at: e.at,
      source: e.source,
      kind: e.kind,
      event: e,
    }))
    const res = await this.fetchImpl(`${this.base}/${this.table}`, {
      method: 'POST',
      headers: { ...this.headers, prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`supabase append failed: ${res.status} ${detail}`)
    }
  }

  async replay(since: number): Promise<StoredEvent[]> {
    // PostgREST caps rows server-side; page through in `at` order so a busy
    // window never silently truncates the replay.
    const pageSize = 1000
    const out: StoredEvent[] = []
    let offset = 0
    for (;;) {
      const url =
        `${this.base}/${this.table}` +
        `?select=event&at=gte.${since}&order=at.asc` +
        `&offset=${offset}&limit=${pageSize}`
      const res = await this.fetchImpl(url, { headers: this.headers })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`supabase replay failed: ${res.status} ${detail}`)
      }
      const rows = (await res.json()) as RestRow[]
      for (const r of rows) out.push(r.event)
      if (rows.length < pageSize) break
      offset += pageSize
    }
    return out
  }

  async close(): Promise<void> {
    // Stateless — nothing to release.
  }
}

/**
 * One-time schema for the telemetry table. Apply via the Supabase SQL editor or
 * a migration before pointing a {@link SupabaseTelemetryStore} at the project.
 */
export const SUPABASE_TELEMETRY_SCHEMA = `
create table if not exists telemetry_events (
  id     bigint generated always as identity primary key,
  at     bigint not null,
  source text   not null,
  kind   text   not null,
  event  jsonb  not null
);
create index if not exists telemetry_events_at_idx     on telemetry_events (at);
create index if not exists telemetry_events_source_idx on telemetry_events (source, at);
`
