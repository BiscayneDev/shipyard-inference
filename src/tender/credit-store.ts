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
  /** Unswept (still-payable) accrued kickbacks for an account, in USDC. */
  balance(account: string): Promise<number>
  /** The most recently served sponsored line for an account (the "current" ad). */
  latestLine(account: string): Promise<string | undefined>
  /**
   * Accounts with a positive unswept balance — the sweep work-list. Pass `before`
   * (unix ms) to include only credits accrued at-or-before that cutoff; the sweep
   * driver uses ONE cutoff for both this read and {@link markSwept} so a credit
   * accrued mid-sweep is neither paid nor marked until the next run.
   */
  unsweptByAccount(before?: number): Promise<Array<{ account: string; amountUsd: number }>>
  /**
   * Mark an account's unswept credits as swept (optionally only those accrued
   * at-or-before `before`), settling them so they stop counting toward the
   * balance. Returns the amount marked, in USDC — the caller pays this on-chain.
   */
  markSwept(account: string, before?: number): Promise<number>
  /**
   * Reserve-before-pay: atomically mark an account's unswept (≤`before`) credits
   * swept and return their ids + summed USDC. The sweep claims credits BEFORE the
   * on-chain transfer so a crash can never re-select and re-pay them. On a failed
   * transfer the caller rolls the reservation back with {@link release}.
   */
  claimUnswept(account: string, before?: number): Promise<{ ids: Array<number | string>; amountUsd: number }>
  /** Un-sweep specific credit ids — rolls back a reservation whose transfer failed. */
  release(ids: Array<number | string>): Promise<void>
}

/** In-memory store — fine for a long-lived gateway; resets per process. */
export class MemoryCreditStore implements CreditStore {
  private readonly recs: Array<CreditRecord & { swept: boolean; id: number }> = []
  private seq = 0
  async accrue(rec: CreditRecord): Promise<void> {
    this.recs.push({ ...rec, swept: false, id: ++this.seq })
  }
  async balance(account: string): Promise<number> {
    return this.recs
      .filter((r) => r.account === account && !r.swept)
      .reduce((s, r) => s + r.amountUsd, 0)
  }
  async latestLine(account: string): Promise<string | undefined> {
    for (let i = this.recs.length - 1; i >= 0; i--) if (this.recs[i].account === account) return this.recs[i].line
    return undefined
  }
  async unsweptByAccount(before?: number): Promise<Array<{ account: string; amountUsd: number }>> {
    const sums = new Map<string, number>()
    for (const r of this.recs) {
      if (r.swept) continue
      if (before != null && r.at > before) continue
      sums.set(r.account, (sums.get(r.account) ?? 0) + r.amountUsd)
    }
    return [...sums].filter(([, amt]) => amt > 0).map(([account, amountUsd]) => ({ account, amountUsd }))
  }
  async claimUnswept(account: string, before?: number): Promise<{ ids: number[]; amountUsd: number }> {
    const ids: number[] = []
    let amountUsd = 0
    for (const r of this.recs) {
      if (r.account !== account || r.swept) continue
      if (before != null && r.at > before) continue
      r.swept = true
      ids.push(r.id)
      amountUsd += r.amountUsd
    }
    return { ids, amountUsd }
  }
  async release(ids: Array<number | string>): Promise<void> {
    const set = new Set(ids.map(Number))
    for (const r of this.recs) if (set.has(r.id)) r.swept = false
  }
  async markSwept(account: string, before?: number): Promise<number> {
    return (await this.claimUnswept(account, before)).amountUsd
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
    this.table = opts.table ?? 'shipyard_tender_credits'
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
    // Prefer the server-side aggregate sum (one row). Unswept credits only.
    const agg = await this.fetchImpl(`${this.base}/${this.table}?account=eq.${acct}&swept=is.false&select=amount_usd.sum()`, {
      headers: this.headers,
    })
    if (agg.ok) {
      const rows = (await agg.json()) as Array<{ sum?: number | null }>
      if (rows[0] && 'sum' in rows[0]) return Number(rows[0].sum ?? 0)
    }
    // Fallback (aggregates disabled on the project): fetch rows and sum.
    const res = await this.fetchImpl(`${this.base}/${this.table}?account=eq.${acct}&swept=is.false&select=amount_usd`, {
      headers: this.headers,
    })
    if (!res.ok) throw new Error(`supabase credit balance failed: ${res.status}`)
    const rows = (await res.json()) as Array<{ amount_usd: number }>
    return rows.reduce((s, r) => s + Number(r.amount_usd), 0)
  }

  async unsweptByAccount(before?: number): Promise<Array<{ account: string; amountUsd: number }>> {
    // PostgREST groups by the non-aggregated selected column (account).
    const cutoff = before != null ? `&at=lte.${before}` : ''
    const res = await this.fetchImpl(
      `${this.base}/${this.table}?swept=is.false${cutoff}&select=account,amount_usd.sum()`,
      { headers: this.headers },
    )
    if (!res.ok) throw new Error(`supabase credit unsweptByAccount failed: ${res.status}`)
    const rows = (await res.json()) as Array<{ account: string; sum?: number | null }>
    return rows
      .map((r) => ({ account: r.account, amountUsd: Number(r.sum ?? 0) }))
      .filter((r) => r.amountUsd > 0)
  }

  async claimUnswept(account: string, before?: number): Promise<{ ids: number[]; amountUsd: number }> {
    const acct = encodeURIComponent(account)
    const cutoff = before != null ? `&at=lte.${before}` : ''
    // PATCH the matching rows and ask for the affected rows (id + amount) back, so
    // the caller can pay exactly what was reserved and roll back by id on failure.
    const res = await this.fetchImpl(
      `${this.base}/${this.table}?account=eq.${acct}&swept=is.false${cutoff}&select=id,amount_usd`,
      {
        method: 'PATCH',
        headers: { ...this.headers, prefer: 'return=representation' },
        body: JSON.stringify({ swept: true }),
      },
    )
    if (!res.ok) throw new Error(`supabase credit claimUnswept failed: ${res.status} ${await res.text().catch(() => '')}`)
    const rows = (await res.json()) as Array<{ id: number; amount_usd: number }>
    return { ids: rows.map((r) => r.id), amountUsd: rows.reduce((s, r) => s + Number(r.amount_usd), 0) }
  }

  async release(ids: Array<number | string>): Promise<void> {
    if (ids.length === 0) return
    const list = ids.map((id) => encodeURIComponent(String(id))).join(',')
    const res = await this.fetchImpl(`${this.base}/${this.table}?id=in.(${list})`, {
      method: 'PATCH',
      headers: { ...this.headers, prefer: 'return=minimal' },
      body: JSON.stringify({ swept: false }),
    })
    if (!res.ok) throw new Error(`supabase credit release failed: ${res.status} ${await res.text().catch(() => '')}`)
  }

  async markSwept(account: string, before?: number): Promise<number> {
    return (await this.claimUnswept(account, before)).amountUsd
  }

  async latestLine(account: string): Promise<string | undefined> {
    const url = `${this.base}/${this.table}?account=eq.${encodeURIComponent(account)}&select=line&order=at.desc&limit=1`
    const res = await this.fetchImpl(url, { headers: this.headers })
    if (!res.ok) throw new Error(`supabase credit latestLine failed: ${res.status}`)
    const rows = (await res.json()) as Array<{ line: string }>
    return rows[0]?.line
  }
}

/**
 * One-time schema for the durable kickback ledger. `swept` tracks whether a
 * credit has been paid out on-chain — balance/sweep read only unswept rows.
 *
 * Existing deploys (table created before the sweep column) must run:
 *   alter table shipyard_tender_credits
 *     add column if not exists swept boolean not null default false;
 *   create index if not exists shipyard_tender_credits_unswept_idx
 *     on shipyard_tender_credits (account) where not swept;
 */
export const SUPABASE_TENDER_CREDITS_SCHEMA = `
create table if not exists shipyard_tender_credits (
  id          bigint generated always as identity primary key,
  account     text   not null,
  amount_usd  double precision not null,
  placement_id text  not null,
  line        text   not null,
  request_id  text   not null,
  at          bigint not null,
  swept       boolean not null default false
);
create index if not exists shipyard_tender_credits_account_idx on shipyard_tender_credits (account, at desc);
create index if not exists shipyard_tender_credits_unswept_idx on shipyard_tender_credits (account) where not swept;
`
