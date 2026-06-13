// Append-only record of on-chain payouts the sweep has sent. It is the audit and
// reconciliation anchor for the reserve-then-pay flow: a credit is marked swept
// BEFORE its transfer, so a crash can never double-pay — but it can leave a credit
// swept with no payout recorded (an under-pay). Comparing swept credit ids against
// the `creditIds` logged here surfaces exactly those gaps for an operator to
// reconcile against the chain. Mirrors the CreditStore shape (memory + Supabase).

export interface PayoutLogEntry {
  account: string
  /** Wallet the USDC was sent to. */
  destination: string
  amountUsd: number
  /** On-chain transaction signature. */
  signature: string
  /** Ids of the credit rows this payout settled — the reconciliation key. */
  creditIds: Array<number | string>
  /** Unix ms. */
  at: number
}

export interface PayoutLog {
  record(entry: PayoutLogEntry): Promise<void>
  /** All recorded payouts (newest first), for inspection / reconciliation. */
  list(): Promise<PayoutLogEntry[]>
}

/** In-memory payout log — process-local; durable runs should use the Supabase one. */
export class MemoryPayoutLog implements PayoutLog {
  private readonly entries: PayoutLogEntry[] = []
  async record(entry: PayoutLogEntry): Promise<void> {
    this.entries.push(entry)
  }
  async list(): Promise<PayoutLogEntry[]> {
    return [...this.entries].reverse()
  }
}

export interface SupabasePayoutLogOptions {
  url: string
  key: string
  table?: string
  fetch?: typeof fetch
}

/** Postgres-backed payout log (PostgREST over fetch). Apply {@link SUPABASE_TENDER_PAYOUTS_SCHEMA} first. */
export class SupabasePayoutLog implements PayoutLog {
  private readonly base: string
  private readonly table: string
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof fetch

  constructor(opts: SupabasePayoutLogOptions) {
    if (!opts.url) throw new Error('SupabasePayoutLog: `url` is required')
    if (!opts.key) throw new Error('SupabasePayoutLog: `key` is required')
    this.base = opts.url.replace(/\/+$/, '') + '/rest/v1'
    this.table = opts.table ?? 'shipyard_tender_payouts'
    this.fetchImpl = opts.fetch ?? fetch
    this.headers = {
      apikey: opts.key,
      authorization: `Bearer ${opts.key}`,
      'content-type': 'application/json',
    }
  }

  async record(entry: PayoutLogEntry): Promise<void> {
    const res = await this.fetchImpl(`${this.base}/${this.table}`, {
      method: 'POST',
      headers: { ...this.headers, prefer: 'return=minimal' },
      body: JSON.stringify([
        {
          account: entry.account,
          destination: entry.destination,
          amount_usd: entry.amountUsd,
          signature: entry.signature,
          credit_ids: entry.creditIds,
          at: entry.at,
        },
      ]),
    })
    if (!res.ok) throw new Error(`supabase payout record failed: ${res.status} ${await res.text().catch(() => '')}`)
  }

  async list(): Promise<PayoutLogEntry[]> {
    const res = await this.fetchImpl(
      `${this.base}/${this.table}?select=account,destination,amount_usd,signature,credit_ids,at&order=at.desc`,
      { headers: this.headers },
    )
    if (!res.ok) throw new Error(`supabase payout list failed: ${res.status}`)
    const rows = (await res.json()) as Array<{
      account: string
      destination: string
      amount_usd: number
      signature: string
      credit_ids: Array<number | string>
      at: number
    }>
    return rows.map((r) => ({
      account: r.account,
      destination: r.destination,
      amountUsd: Number(r.amount_usd),
      signature: r.signature,
      creditIds: r.credit_ids ?? [],
      at: r.at,
    }))
  }
}

/** One-time schema for the payout log. The signature is unique — a belt-and-braces guard against a duplicate insert. */
export const SUPABASE_TENDER_PAYOUTS_SCHEMA = `
create table if not exists shipyard_tender_payouts (
  id          bigint generated always as identity primary key,
  account     text   not null,
  destination text   not null,
  amount_usd  double precision not null,
  signature   text   not null unique,
  credit_ids  bigint[] not null default '{}',
  at          bigint not null
);
create index if not exists shipyard_tender_payouts_account_idx on shipyard_tender_payouts (account, at desc);
`
