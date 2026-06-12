// Durable per-account kickback ledger for the gateway. On serverless (Vercel)
// the in-memory GatewayTender ledger resets every cold start, so accrued
// kickbacks must persist here. Each accrual is an append (account, amount, the
// served line); balance is a server-side SUM; the status line reads the latest
// served line. Async — a DB store can't be synchronous.

export interface CreditRecord {
  account: string
  amountUsd: number
  placementId: string
  /** The sponsored line shown — denormalized so the status line needs no join. */
  line: string
  requestId: string
  at: number
}

export interface CreditStore {
  accrue(rec: CreditRecord): Promise<void>
  /** Total accrued kickbacks for an account, in USDC. */
  balance(account: string): Promise<number>
  /** The most recently served sponsored line for an account (the "current" ad). */
  latestLine(account: string): Promise<string | undefined>
}

/** In-memory store — fine for a long-lived gateway; resets per process. */
export class MemoryCreditStore implements CreditStore {
  private readonly recs: CreditRecord[] = []
  async accrue(rec: CreditRecord): Promise<void> {
    this.recs.push(rec)
  }
  async balance(account: string): Promise<number> {
    return this.recs.filter((r) => r.account === account).reduce((s, r) => s + r.amountUsd, 0)
  }
  async latestLine(account: string): Promise<string | undefined> {
    for (let i = this.recs.length - 1; i >= 0; i--) if (this.recs[i].account === account) return this.recs[i].line
    return undefined
  }
}

export interface SupabaseCreditStoreOptions {
  url: string
  key: string
  table?: string
  fetch?: typeof fetch
}

/**
 * Postgres-backed credit ledger (PostgREST over fetch) — durable across
 * serverless invocations. `balance` uses a server-side aggregate sum so it
 * doesn't fetch every row. Apply {@link SUPABASE_TENDER_CREDITS_SCHEMA} first.
 */
export class SupabaseCreditStore implements CreditStore {
  private readonly base: string
  private readonly table: string
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof fetch

  constructor(opts: SupabaseCreditStoreOptions) {
    if (!opts.url) throw new Error('SupabaseCreditStore: `url` is required')
    if (!opts.key) throw new Error('SupabaseCreditStore: `key` is required')
    this.base = opts.url.replace(/\/+$/, '') + '/rest/v1'
    this.table = opts.table ?? 'tender_credits'
    this.fetchImpl = opts.fetch ?? fetch
    this.headers = {
      apikey: opts.key,
      authorization: `Bearer ${opts.key}`,
      'content-type': 'application/json',
    }
  }

  async accrue(rec: CreditRecord): Promise<void> {
    const res = await this.fetchImpl(`${this.base}/${this.table}`, {
      method: 'POST',
      headers: { ...this.headers, prefer: 'return=minimal' },
      body: JSON.stringify([
        { account: rec.account, amount_usd: rec.amountUsd, placement_id: rec.placementId, line: rec.line, request_id: rec.requestId, at: rec.at },
      ]),
    })
    if (!res.ok) throw new Error(`supabase credit accrue failed: ${res.status} ${await res.text().catch(() => '')}`)
  }

  async balance(account: string): Promise<number> {
    const acct = encodeURIComponent(account)
    // Prefer the server-side aggregate sum (one row).
    const agg = await this.fetchImpl(`${this.base}/${this.table}?account=eq.${acct}&select=amount_usd.sum()`, {
      headers: this.headers,
    })
    if (agg.ok) {
      const rows = (await agg.json()) as Array<{ sum?: number | null }>
      if (rows[0] && 'sum' in rows[0]) return Number(rows[0].sum ?? 0)
    }
    // Fallback (aggregates disabled on the project): fetch rows and sum.
    const res = await this.fetchImpl(`${this.base}/${this.table}?account=eq.${acct}&select=amount_usd`, {
      headers: this.headers,
    })
    if (!res.ok) throw new Error(`supabase credit balance failed: ${res.status}`)
    const rows = (await res.json()) as Array<{ amount_usd: number }>
    return rows.reduce((s, r) => s + Number(r.amount_usd), 0)
  }

  async latestLine(account: string): Promise<string | undefined> {
    const url = `${this.base}/${this.table}?account=eq.${encodeURIComponent(account)}&select=line&order=at.desc&limit=1`
    const res = await this.fetchImpl(url, { headers: this.headers })
    if (!res.ok) throw new Error(`supabase credit latestLine failed: ${res.status}`)
    const rows = (await res.json()) as Array<{ line: string }>
    return rows[0]?.line
  }
}

/** One-time schema for the durable kickback ledger. */
export const SUPABASE_TENDER_CREDITS_SCHEMA = `
create table if not exists tender_credits (
  id          bigint generated always as identity primary key,
  account     text   not null,
  amount_usd  double precision not null,
  placement_id text  not null,
  line        text   not null,
  request_id  text   not null,
  at          bigint not null
);
create index if not exists tender_credits_account_idx on tender_credits (account, at desc);
`
