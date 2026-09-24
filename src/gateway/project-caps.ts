/**
 * Per-project daily spend caps, persisted across instances.
 *
 * A cap is keyed by the CALLING key's `projectId`: only keys whose account
 * carries that project id count toward (and are blocked by) the cap. Keys with
 * no project, or a project with no configured cap, are never limited here.
 *
 * Spend is tracked per UTC day in a shared store (Supabase in production), so
 * a serverless cold start never forgets what a project already spent today.
 * When a project is over its daily cap, keyed requests get a recoverable 402
 * that points the developer at topping up USDC in their PayBox wallet.
 *
 * Meter failures fail OPEN (logged): a broken store never takes a project's
 * traffic down. The cap is a budget guard, not an auth check.
 */

/** Default place to add USDC when a project hits its daily cap. */
export const DEFAULT_TOP_UP_URL = 'https://app.paybox.sh'

/** Shared per-project, per-UTC-day spend ledger. */
export interface ProjectSpendStore {
  /** USD recorded for `projectId` on UTC day `day` (`YYYY-MM-DD`). */
  spent(projectId: string, day: string): Promise<number>
  /** Atomically add `usd` to the project's day total; returns the new total. */
  add(projectId: string, day: string, usd: number): Promise<number>
}

export interface ProjectCapsConfig {
  /** Daily USD cap per project id, e.g. `{ 'dinghy-sandbox-prod': 10 }`. */
  caps: Record<string, number>
  /** Where spend is recorded. */
  store: ProjectSpendStore
  /** Top-up link in the over-cap response. Default {@link DEFAULT_TOP_UP_URL}. */
  topUpUrl?: string
  /** Clock (tests). Default `Date.now`. */
  now?: () => number
  /**
   * Called with each background write so serverless hosts can keep the
   * invocation alive until it lands (e.g. Vercel `waitUntil`).
   */
  onPending?: (p: Promise<unknown>) => void
}

/** UTC calendar day for a unix-ms timestamp, as `YYYY-MM-DD`. */
export function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10)
}

/** Unix-ms start of the next UTC day (when today's window resets). */
export function nextUtcMidnight(at: number): number {
  const d = new Date(at)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
}

export interface ProjectCapStatus {
  projectId: string
  capUsd: number
  spentUsd: number
  resetsAt: number
}

/** The configured cap for a project, when one applies. */
export function capFor(cfg: ProjectCapsConfig | undefined, projectId: string | undefined): number | undefined {
  if (!cfg || !projectId) return undefined
  const cap = cfg.caps[projectId]
  return typeof cap === 'number' && Number.isFinite(cap) && cap >= 0 ? cap : undefined
}

/**
 * Check a project's cap. Returns the status when the project is at or over its
 * cap (the caller blocks), otherwise `undefined`. Store errors fail open.
 */
export async function overProjectCap(
  cfg: ProjectCapsConfig | undefined,
  projectId: string | undefined,
): Promise<ProjectCapStatus | undefined> {
  const capUsd = capFor(cfg, projectId)
  if (capUsd === undefined || !cfg || !projectId) return undefined
  const at = (cfg.now ?? Date.now)()
  let spentUsd: number
  try {
    spentUsd = await cfg.store.spent(projectId, utcDay(at))
  } catch (err) {
    console.warn(`[shipyard-gateway] project cap check failed for ${projectId}; allowing: ${errText(err)}`)
    return undefined
  }
  if (spentUsd < capUsd) return undefined
  return { projectId, capUsd, spentUsd, resetsAt: nextUtcMidnight(at) }
}

/** Record actual spend against a capped project (never throws, never blocks). */
export function recordProjectSpend(
  cfg: ProjectCapsConfig | undefined,
  projectId: string | undefined,
  costUsd: number | undefined,
): Promise<void> | undefined {
  if (!cfg || !projectId || !costUsd || costUsd <= 0) return undefined
  if (capFor(cfg, projectId) === undefined) return undefined
  const day = utcDay((cfg.now ?? Date.now)())
  const p = cfg.store.add(projectId, day, costUsd).then(
    () => undefined,
    (err) => {
      console.warn(`[shipyard-gateway] project spend record failed for ${projectId}: ${errText(err)}`)
    },
  )
  cfg.onPending?.(p)
  return p
}

/** OpenAI-style error body for an over-cap project. */
export function projectCapErrorBody(cfg: ProjectCapsConfig, status: ProjectCapStatus) {
  const topUpUrl = cfg.topUpUrl || DEFAULT_TOP_UP_URL
  const cap = status.capUsd.toFixed(2)
  return {
    message:
      `This project hit its $${cap}/day spend limit. Add more USDC to your PayBox wallet to keep going ` +
      `(${topUpUrl}), or wait for the limit to reset at 00:00 UTC.`,
    type: 'spend_ceiling_exceeded',
    code: 'project_daily_cap',
    param: null,
    cap: 'project_daily',
    projectId: status.projectId,
    capUsd: status.capUsd,
    spentUsd: Math.round(status.spentUsd * 1e6) / 1e6,
    resetsAt: new Date(status.resetsAt).toISOString(),
    topUpUrl,
  }
}

/**
 * Parse caps from an env value like `{"dinghy-sandbox-prod":10}`. Invalid JSON
 * or non-numeric entries are ignored (logged) rather than crashing boot.
 */
export function parseProjectCaps(raw: string | undefined): Record<string, number> {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('expected an object')
    const out: Record<string, number> = {}
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = typeof v === 'string' ? Number(v) : v
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[id] = n
      else console.warn(`[shipyard-gateway] ignoring invalid project cap for ${id}`)
    }
    return out
  } catch (err) {
    console.warn(`[shipyard-gateway] SHIPYARD_PROJECT_CAPS is not valid JSON; no project caps applied: ${errText(err)}`)
    return {}
  }
}

/** In-memory ledger — process-local; for tests and single-process servers. */
export class MemoryProjectSpendStore implements ProjectSpendStore {
  private readonly totals = new Map<string, number>()

  async spent(projectId: string, day: string): Promise<number> {
    return this.totals.get(`${projectId}|${day}`) ?? 0
  }

  async add(projectId: string, day: string, usd: number): Promise<number> {
    const k = `${projectId}|${day}`
    const next = (this.totals.get(k) ?? 0) + usd
    this.totals.set(k, next)
    return next
  }
}

export interface SupabaseProjectSpendStoreOptions {
  /** Project URL, e.g. `https://abcd.supabase.co`. */
  url: string
  /** Service-role key. */
  key: string
  /** Table name. Default `shipyard_spend_windows`. */
  table?: string
  /** Increment RPC. Default `shipyard_spend_add`. */
  rpc?: string
  /** Injectable fetch (tests). */
  fetch?: typeof fetch
}

/**
 * Supabase-backed ledger over PostgREST. Reads select the day row; writes go
 * through a security-definer RPC that upserts `spent_usd = spent_usd + amount`
 * in one statement, so concurrent requests never lose spend. Apply
 * {@link SUPABASE_SPEND_WINDOWS_SCHEMA} first.
 */
export class SupabaseProjectSpendStore implements ProjectSpendStore {
  private readonly base: string
  private readonly table: string
  private readonly rpc: string
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof fetch

  constructor(opts: SupabaseProjectSpendStoreOptions) {
    if (!opts.url) throw new Error('SupabaseProjectSpendStore: `url` is required')
    if (!opts.key) throw new Error('SupabaseProjectSpendStore: `key` is required')
    this.base = opts.url.replace(/\/+$/, '') + '/rest/v1'
    this.table = opts.table || 'shipyard_spend_windows'
    this.rpc = opts.rpc || 'shipyard_spend_add'
    this.fetchImpl = opts.fetch ?? fetch
    this.headers = {
      apikey: opts.key,
      authorization: `Bearer ${opts.key}`,
      'content-type': 'application/json',
    }
  }

  async spent(projectId: string, day: string): Promise<number> {
    const url =
      `${this.base}/${this.table}?select=spent_usd` +
      `&project_id=eq.${encodeURIComponent(projectId)}&window_start=eq.${day}&limit=1`
    const res = await this.fetchImpl(url, { headers: this.headers })
    if (!res.ok) throw new Error(`supabase spend read failed: ${res.status} ${await res.text().catch(() => '')}`)
    const rows = (await res.json()) as { spent_usd: number | string }[]
    return rows[0] ? Number(rows[0].spent_usd) || 0 : 0
  }

  async add(projectId: string, day: string, usd: number): Promise<number> {
    const res = await this.fetchImpl(`${this.base}/rpc/${this.rpc}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ p_project_id: projectId, p_window_start: day, p_amount: usd }),
    })
    if (!res.ok) throw new Error(`supabase spend add failed: ${res.status} ${await res.text().catch(() => '')}`)
    return Number(await res.json()) || 0
  }
}

/** One-time schema for the persistent daily spend ledger. */
export const SUPABASE_SPEND_WINDOWS_SCHEMA = `
create table if not exists shipyard_spend_windows (
  project_id   text        not null,
  window_start date        not null,
  spent_usd    numeric     not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (project_id, window_start)
);
alter table shipyard_spend_windows enable row level security;

create or replace function shipyard_spend_add(p_project_id text, p_window_start date, p_amount numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  insert into shipyard_spend_windows as w (project_id, window_start, spent_usd, updated_at)
  values (p_project_id, p_window_start, greatest(p_amount, 0), now())
  on conflict (project_id, window_start)
  do update set spent_usd = w.spent_usd + greatest(excluded.spent_usd, 0), updated_at = now()
  returning spent_usd;
$$;
revoke all on function shipyard_spend_add(text, date, numeric) from public, anon, authenticated;
grant execute on function shipyard_spend_add(text, date, numeric) to service_role;
grant select on shipyard_spend_windows to service_role;
`

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
