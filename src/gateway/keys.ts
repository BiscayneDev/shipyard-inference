import { createHash, randomBytes } from 'node:crypto'

// API keys for the hosted control plane: each key resolves to a tenant/project
// identity, and the plaintext secret is shown only once at issue time. Only a
// SHA-256 of the key is stored.
//
// `resolve` is async (a persistent store hits a DB) but on the request hot path
// it's served from a short-TTL in-memory cache, so steady-state auth is local.

export interface Account {
  /** Stable identity for the API key (used as a fallback `metadata.userId`). */
  userId: string
  /** Owning tenant for the key. */
  tenantId?: string
  /** Project scoped under the tenant. */
  projectId?: string
  /** Optional external wallet for billing / kickbacks. */
  wallet?: string
  /** Human label, e.g. "cursor-laptop". */
  label?: string
  /** Optional scopes used by the operator/admin view. */
  scopes?: string[]
  /** `active` keys resolve; `revoked` keys remain listed but fail auth. */
  status: 'active' | 'revoked'
  /** Unix-ms creation time. */
  createdAt: number
  /** Unix-ms revocation time, when revoked. */
  revokedAt?: number
}

export interface IssuedKey {
  /** The plaintext key — returned ONCE; only its hash is stored. */
  key: string
  account: Account
}

export interface ApiKeyIssueInput {
  tenantId?: string
  projectId?: string
  userId?: string
  wallet?: string
  label?: string
  scopes?: string[]
}

export interface ApiKeyStore {
  /** Resolve a plaintext key to its account, or undefined if unknown/revoked. */
  resolve(key: string): Promise<Account | undefined>
  /** Issue a new key for an account (creates the account). */
  issue(input: ApiKeyIssueInput, at: number): Promise<IssuedKey>
  /** Revoke a key by its plaintext value. Returns true if it existed. */
  revoke(key: string, at?: number): Promise<boolean>
  /** All known accounts (live + revoked) for an operator view. */
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

function normalizeIssueInput(input: ApiKeyIssueInput): Account {
  const fallbackId = input.projectId ?? input.tenantId ?? input.userId ?? newUserId()
  return {
    userId: input.userId ?? fallbackId,
    tenantId: input.tenantId,
    projectId: input.projectId,
    wallet: input.wallet,
    label: input.label,
    scopes: input.scopes,
    status: 'active',
    createdAt: 0,
  }
}

/** In-memory key store. Process-local — fine for a single long-lived server. */
export class MemoryApiKeyStore implements ApiKeyStore {
  private readonly byHash = new Map<string, { key: string; account: Account }>()

  async resolve(key: string): Promise<Account | undefined> {
    if (!key) return undefined
    const record = this.byHash.get(hashApiKey(key))
    if (!record || record.account.status !== 'active') return undefined
    return record.account
  }

  async issue(input: ApiKeyIssueInput, at: number): Promise<IssuedKey> {
    const key = generateApiKey()
    const account = { ...normalizeIssueInput(input), createdAt: at }
    this.byHash.set(hashApiKey(key), { key, account })
    return { key, account }
  }

  async revoke(key: string, at = Date.now()): Promise<boolean> {
    const record = this.byHash.get(hashApiKey(key))
    if (!record || record.account.status === 'revoked') return false
    record.account = { ...record.account, status: 'revoked', revokedAt: at }
    return true
  }

  async listAccounts(): Promise<Account[]> {
    return [...this.byHash.values()].map((r) => ({ ...r.account }))
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
  key_hash: string
  user_id: string
  tenant_id: string | null
  project_id: string | null
  wallet: string | null
  label: string | null
  scopes: string[] | null
  status: 'active' | 'revoked'
  created_at: number
  revoked_at: number | null
}

function rowToAccount(row: KeyRow): Account {
  return {
    userId: row.user_id,
    tenantId: row.tenant_id ?? undefined,
    projectId: row.project_id ?? undefined,
    wallet: row.wallet ?? undefined,
    label: row.label ?? undefined,
    scopes: row.scopes ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    revokedAt: row.revoked_at ?? undefined,
  }
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
    const url =
      `${this.base}/${this.table}?select=key_hash,user_id,tenant_id,project_id,wallet,label,scopes,status,created_at,revoked_at` +
      `&key_hash=eq.${h}&status=eq.active&revoked_at=is.null&limit=1`
    const res = await this.fetchImpl(url, { headers: this.headers })
    if (!res.ok) throw new Error(`supabase key resolve failed: ${res.status} ${await res.text().catch(() => '')}`)
    const rows = (await res.json()) as KeyRow[]
    const row = rows[0]
    const account: Account | undefined = row ? rowToAccount(row) : undefined
    this.cache.set(h, { account, at: now })
    return account
  }

  async issue(input: ApiKeyIssueInput, at: number): Promise<IssuedKey> {
    const key = generateApiKey()
    const account: Account = { ...normalizeIssueInput(input), createdAt: at }
    const res = await this.fetchImpl(`${this.base}/${this.table}`, {
      method: 'POST',
      headers: { ...this.headers, prefer: 'return=minimal' },
      body: JSON.stringify([
        {
          key_hash: hashApiKey(key),
          user_id: account.userId,
          tenant_id: account.tenantId ?? null,
          project_id: account.projectId ?? null,
          wallet: account.wallet ?? null,
          label: account.label ?? null,
          scopes: account.scopes ?? null,
          status: 'active',
          created_at: at,
          revoked_at: null,
        },
      ]),
    })
    if (!res.ok) throw new Error(`supabase key issue failed: ${res.status} ${await res.text().catch(() => '')}`)
    return { key, account }
  }

  async revoke(key: string, at = Date.now()): Promise<boolean> {
    const h = hashApiKey(key)
    const res = await this.fetchImpl(`${this.base}/${this.table}?key_hash=eq.${h}&status=eq.active`, {
      method: 'PATCH',
      headers: { ...this.headers, prefer: 'return=representation' },
      body: JSON.stringify({ status: 'revoked', revoked_at: at }),
    })
    this.cache.delete(h)
    if (!res.ok) return false
    const rows = (await res.json().catch(() => [])) as KeyRow[]
    return rows.length > 0
  }

  async listAccounts(): Promise<Account[]> {
    const res = await this.fetchImpl(
      `${this.base}/${this.table}?select=key_hash,user_id,tenant_id,project_id,wallet,label,scopes,status,created_at,revoked_at&order=created_at.desc`,
      { headers: this.headers },
    )
    if (!res.ok) throw new Error(`supabase key list failed: ${res.status}`)
    const rows = (await res.json()) as KeyRow[]
    return rows.map(rowToAccount)
  }
}

/** One-time schema for the api_keys table. Apply before using SupabaseApiKeyStore. */
export const SUPABASE_API_KEYS_SCHEMA = `
create table if not exists api_keys (
  key_hash   text   primary key,
  user_id    text   not null,
  tenant_id  text,
  project_id text,
  wallet     text,
  label      text,
  scopes     jsonb,
  status     text   not null default 'active',
  created_at bigint not null,
  revoked_at bigint
);
create index if not exists api_keys_user_idx on api_keys (user_id);
create index if not exists api_keys_tenant_idx on api_keys (tenant_id, project_id);
create index if not exists api_keys_status_idx on api_keys (status, revoked_at);
`
