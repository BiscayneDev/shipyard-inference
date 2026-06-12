import { createHash, randomBytes } from 'node:crypto'

// Per-user API keys for the consumer surface: a developer signs up, gets a
// `sk-shipyard-…` key, and pastes it (+ the gateway baseURL) into their IDE.
// Every request the key authenticates is attributed to that account, so routing
// savings and Tender kickbacks accrue to the right wallet — no `user` field
// needed from the IDE. Only a SHA-256 of the key is stored; the plaintext is
// shown once at issue.
//
// `resolve` is async (a persistent store hits a DB) but on the request hot path
// it's served from a short-TTL in-memory cache, so steady-state auth is local.

export interface Account {
  /** Stable account id — the attribution key (becomes `metadata.userId`). */
  userId: string
  /** Payout wallet for routing rebates + Tender kickbacks. */
  wallet?: string
  /** Human label, e.g. "cursor-laptop". */
  label?: string
  createdAt: number
}

export interface IssuedKey {
  /** The plaintext key — returned ONCE; only its hash is stored. */
  key: string
  account: Account
}

export interface ApiKeyStore {
  /** Resolve a plaintext key to its account, or undefined if unknown/revoked. */
  resolve(key: string): Promise<Account | undefined>
  /** Issue a new key for an account (creates the account). */
  issue(input: { userId?: string; wallet?: string; label?: string }, at: number): Promise<IssuedKey>
  /** Revoke a key by its plaintext value. Returns true if it existed. */
  revoke(key: string): Promise<boolean>
  /** All accounts with a live key (for an operator view). */
  listAccounts(): Promise<Account[]>
}

const KEY_PREFIX = 'sk-shipyard-'
export const hashApiKey = (key: string): string => createHash('sha256').update(key).digest('hex')

/** A fresh opaque key: `sk-shipyard-` + 24 random bytes, url-safe. */
export function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(24).toString('base64url')
}

function newUserId(): string {
  return `u_${randomBytes(8).toString('hex')}`
}

/** In-memory key store. Process-local — fine for a single long-lived server. */
export class MemoryApiKeyStore implements ApiKeyStore {
  private readonly byHash = new Map<string, Account>()

  async resolve(key: string): Promise<Account | undefined> {
    if (!key) return undefined
    return this.byHash.get(hashApiKey(key))
  }

  async issue(input: { userId?: string; wallet?: string; label?: string }, at: number): Promise<IssuedKey> {
    const key = generateApiKey()
    const account: Account = {
      userId: input.userId ?? newUserId(),
      wallet: input.wallet,
      label: input.label,
      createdAt: at,
    }
    this.byHash.set(hashApiKey(key), account)
    return { key, account }
  }

  async revoke(key: string): Promise<boolean> {
    return this.byHash.delete(hashApiKey(key))
  }

  async listAccounts(): Promise<Account[]> {
    return [...this.byHash.values()]
  }
}

export interface SupabaseApiKeyStoreOptions {
  /** Project URL, e.g. `https://abcd.supabase.co`. */
  url: string
  /** Service-role key (insert+select on the table). */
  key: string
  /** Table name. Default `api_keys`. */
  table?: string
  /** Resolve cache TTL (ms). Default 60s — keeps the auth hot path local. */
  cacheTtlMs?: number
  /** Injectable fetch (tests). Defaults to global `fetch`. */
  fetch?: typeof fetch
}

interface KeyRow {
  user_id: string
  wallet: string | null
  label: string | null
  created_at: number
}

/**
 * Postgres-backed key store for serverless (Vercel) — PostgREST over plain
 * `fetch`, no client lib. Stores only the key HASH. A short-TTL in-memory cache
 * fronts `resolve` so steady-state auth doesn't hit the DB per request. Apply
 * {@link SUPABASE_API_KEYS_SCHEMA} before use.
 */
export class SupabaseApiKeyStore implements ApiKeyStore {
  private readonly base: string
  private readonly table: string
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof fetch
  private readonly ttl: number
  private readonly cache = new Map<string, { account?: Account; at: number }>()

  constructor(opts: SupabaseApiKeyStoreOptions) {
    if (!opts.url) throw new Error('SupabaseApiKeyStore: `url` is required')
    if (!opts.key) throw new Error('SupabaseApiKeyStore: `key` is required')
    this.base = opts.url.replace(/\/+$/, '') + '/rest/v1'
    this.table = opts.table ?? 'shipyard_api_keys'
    this.ttl = opts.cacheTtlMs ?? 60_000
    this.fetchImpl = opts.fetch ?? fetch
    this.headers = {
      apikey: opts.key,
      authorization: `Bearer ${opts.key}`,
      'content-type': 'application/json',
    }
  }

  async resolve(key: string): Promise<Account | undefined> {
    if (!key) return undefined
    const h = hashApiKey(key)
    const hit = this.cache.get(h)
    const now = Date.now()
    if (hit && now - hit.at < this.ttl) return hit.account
    const url = `${this.base}/${this.table}?select=user_id,wallet,label,created_at&key_hash=eq.${h}&limit=1`
    const res = await this.fetchImpl(url, { headers: this.headers })
    if (!res.ok) throw new Error(`supabase key resolve failed: ${res.status} ${await res.text().catch(() => '')}`)
    const rows = (await res.json()) as KeyRow[]
    const row = rows[0]
    const account: Account | undefined = row
      ? { userId: row.user_id, wallet: row.wallet ?? undefined, label: row.label ?? undefined, createdAt: row.created_at }
      : undefined
    this.cache.set(h, { account, at: now })
    return account
  }

  async issue(input: { userId?: string; wallet?: string; label?: string }, at: number): Promise<IssuedKey> {
    const key = generateApiKey()
    const account: Account = {
      userId: input.userId ?? newUserId(),
      wallet: input.wallet,
      label: input.label,
      createdAt: at,
    }
    const res = await this.fetchImpl(`${this.base}/${this.table}`, {
      method: 'POST',
      headers: { ...this.headers, prefer: 'return=minimal' },
      body: JSON.stringify([
        { key_hash: hashApiKey(key), user_id: account.userId, wallet: account.wallet ?? null, label: account.label ?? null, created_at: at },
      ]),
    })
    if (!res.ok) throw new Error(`supabase key issue failed: ${res.status} ${await res.text().catch(() => '')}`)
    return { key, account }
  }

  async revoke(key: string): Promise<boolean> {
    const h = hashApiKey(key)
    const res = await this.fetchImpl(`${this.base}/${this.table}?key_hash=eq.${h}`, {
      method: 'DELETE',
      headers: { ...this.headers, prefer: 'return=minimal' },
    })
    this.cache.delete(h)
    return res.ok
  }

  async listAccounts(): Promise<Account[]> {
    const res = await this.fetchImpl(`${this.base}/${this.table}?select=user_id,wallet,label,created_at&order=created_at.desc`, {
      headers: this.headers,
    })
    if (!res.ok) throw new Error(`supabase key list failed: ${res.status}`)
    const rows = (await res.json()) as KeyRow[]
    return rows.map((r) => ({ userId: r.user_id, wallet: r.wallet ?? undefined, label: r.label ?? undefined, createdAt: r.created_at }))
  }
}

/** One-time schema for the api_keys table. Apply before using SupabaseApiKeyStore. */
export const SUPABASE_API_KEYS_SCHEMA = `
create table if not exists api_keys (
  key_hash   text   primary key,
  user_id    text   not null,
  wallet     text,
  label      text,
  created_at bigint not null
);
create index if not exists api_keys_user_idx on api_keys (user_id);
`
