import { createHash, randomBytes } from 'node:crypto'

// Per-user API keys for the consumer surface: a developer signs up, gets a
// `sk-shipyard-…` key, and pastes it (+ the gateway baseURL) into their IDE.
// Every request the key authenticates is attributed to that account, so routing
// savings and Tender kickbacks accrue to the right wallet — no `user` field
// needed from the IDE. Only a SHA-256 of the key is stored; the plaintext is
// shown once at issue.

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
  resolve(key: string): Account | undefined
  /** Issue a new key for an account (creates the account). */
  issue(input: { userId?: string; wallet?: string; label?: string }, at: number): IssuedKey
  /** Revoke a key by its plaintext value. Returns true if it existed. */
  revoke(key: string): boolean
  /** All accounts with a live key (for an operator view). */
  listAccounts(): Account[]
}

const KEY_PREFIX = 'sk-shipyard-'
const hashKey = (key: string): string => createHash('sha256').update(key).digest('hex')

/** A fresh opaque key: `sk-shipyard-` + 24 random bytes, url-safe. */
export function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(24).toString('base64url')
}

/** In-memory key store. Swap for a persistent (e.g. Supabase) impl in prod. */
export class MemoryApiKeyStore implements ApiKeyStore {
  private readonly byHash = new Map<string, Account>()

  resolve(key: string): Account | undefined {
    if (!key) return undefined
    return this.byHash.get(hashKey(key))
  }

  issue(input: { userId?: string; wallet?: string; label?: string }, at: number): IssuedKey {
    const key = generateApiKey()
    const account: Account = {
      userId: input.userId ?? `u_${randomBytes(8).toString('hex')}`,
      wallet: input.wallet,
      label: input.label,
      createdAt: at,
    }
    this.byHash.set(hashKey(key), account)
    return { key, account }
  }

  revoke(key: string): boolean {
    return this.byHash.delete(hashKey(key))
  }

  listAccounts(): Account[] {
    return [...this.byHash.values()]
  }
}
