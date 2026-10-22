import { connectionBudgetStatus } from './oauth.js'

/**
 * Lifetime per-connection budget (dock_ connections).
 *
 * Per billed call the gateway does, in order:
 *   1. reserve  — atomic check-and-hold (`shipyard_connection_debit`). Refused → 402.
 *                 Store failure → 503 (call is never served, nothing charged).
 *   2. serve    — the upstream call.
 *   3. settle   — awaited; converts the hold into spend + ONE ledger row
 *                 (`shipyard_connection_settle`), idempotent on the same key.
 *   4. release  — for unbilled (BYO) or failed calls: frees the hold, no charge.
 *
 * Idempotency key = `conn:<keyId>:<requestId>`, so a retried request cannot
 * double-reserve or double-settle.
 */

export interface ConnectionReserveInput {
  keyId: string
  idempotencyKey: string
  amountUsd: number
  budgetUsd: number
}
export interface ConnectionSettleInput {
  idempotencyKey: string
  costUsd: number
  requestId: string
  workspaceRef?: string
  model?: string
  provider?: string
}
export interface ConnectionDrift {
  keyId: string
  spent: number
  ledgerSum: number
  drift: number
  reserved: number
}

/** Store contract. The Supabase implementation is the production path; memory is for local dev only. */
export interface ConnectionLedgerStore {
  reserve(input: ConnectionReserveInput): Promise<{ allowed: boolean; spent: number; budget: number }>
  settle(input: ConnectionSettleInput): Promise<{ spent: number; budget: number }>
  release(idempotencyKey: string): Promise<void>
  drift(keyId: string): Promise<ConnectionDrift | undefined>
}

export interface ConnectionBudget {
  prefix: string
  budgetUsd: number
  /** Amount held per call before serving. Actual cost above this is still settled (see README note). */
  holdUsd: number
  store: ConnectionLedgerStore
}

/** A reservation taken for one call; carried through to settle/release. */
export interface ConnectionHold {
  keyId: string
  idempotencyKey: string
  /** Set once settle is attempted. A hold whose settle failed is never released (no free serve). */
  settleAttempted?: boolean
}

export const DEFAULT_CONNECTION_HOLD_USD = 0.05

const onConnection = (cb: ConnectionBudget | undefined, projectId: string | undefined): projectId is string =>
  !!cb && !!projectId && projectId.startsWith(cb.prefix)

export function connectionIdempotencyKey(keyId: string, requestId: string): string {
  return `conn:${keyId}:${requestId}`
}

/**
 * Atomic reserve before serving. Returns `{ hold }` when the call may proceed,
 * `{ refused }` with a 402 body when the budget cannot cover the hold, or `{}`
 * when the call is not on a connection. Throws on store failure (caller → 503).
 */
export async function connectionReserve(
  cb: ConnectionBudget | undefined,
  projectId: string | undefined,
  requestId: string,
): Promise<{ hold?: ConnectionHold; refused?: Record<string, unknown> }> {
  if (!cb || !onConnection(cb, projectId)) return {}
  const idempotencyKey = connectionIdempotencyKey(projectId, requestId)
  const r = await cb.store.reserve({ keyId: projectId, idempotencyKey, amountUsd: cb.holdUsd, budgetUsd: cb.budgetUsd })
  if (!r.allowed) return { refused: connectionBudgetStatus(cb.budgetUsd, cb.budgetUsd).body }
  return { hold: { keyId: projectId, idempotencyKey } }
}

/**
 * Awaited settle for a billed call. Retries once on store error; a second
 * failure throws, and the caller must refuse the response (503). The hold
 * stays reserved, so the budget stays conservative until reconciled.
 */
export async function connectionSettle(
  cb: ConnectionBudget | undefined,
  hold: ConnectionHold | undefined,
  requestId: string,
  costUsd: number | undefined,
  billed: boolean | undefined,
  meta: { workspaceRef?: string; model?: string; provider?: string } = {},
): Promise<void> {
  if (!cb || !hold) return
  if (billed === false) return connectionRelease(cb, hold)
  hold.settleAttempted = true
  const input: ConnectionSettleInput = {
    idempotencyKey: hold.idempotencyKey,
    costUsd: costUsd && costUsd > 0 ? costUsd : 0,
    requestId,
    ...meta,
  }
  try {
    await cb.store.settle(input)
  } catch {
    await cb.store.settle(input)
  }
}

/** Frees a hold without charging (unbilled, failed, or refused-after-reserve). Best effort; hold expiry is the backstop. */
export async function connectionRelease(cb: ConnectionBudget | undefined, hold: ConnectionHold | undefined): Promise<void> {
  if (!cb || !hold || hold.settleAttempted) return
  try {
    await cb.store.release(hold.idempotencyKey)
  } catch {
    // A failed release leaves the hold reserved: fail-closed for the connection, never a free call.
  }
}

/** Reconciliation: spent counter vs sum of ledger rows. Zero drift is the invariant. */
export async function connectionDrift(cb: ConnectionBudget | undefined, keyId: string): Promise<ConnectionDrift | undefined> {
  if (!cb) return undefined
  return cb.store.drift(keyId)
}

// ---------------------------------------------------------------------------
// Memory store — LOCAL DEV / TESTS ONLY. Node is single-threaded, so each
// method body runs without interleaving; the semantics mirror the SQL functions.
// ---------------------------------------------------------------------------
/** Money in the memory store is rounded to 1e-10 so float drift matches Postgres numeric exactly. */
const money = (x: number): number => Math.round(x * 1e10) / 1e10 + 0 // + 0 normalises -0

export class MemoryConnectionLedgerStore implements ConnectionLedgerStore {
  readonly budgets = new Map<string, { budget: number; spent: number; reserved: number }>()
  readonly holds = new Map<string, { keyId: string; amount: number; status: 'held' | 'settled' | 'released' }>()
  readonly ledger: Array<ConnectionSettleInput & { keyId: string }> = []
  /** Test hook: make the next N settle calls throw (simulates a ledger write failure). */
  failSettles = 0

  async reserve(i: ConnectionReserveInput) {
    const b = this.budgets.get(i.keyId) ?? { budget: i.budgetUsd, spent: 0, reserved: 0 }
    this.budgets.set(i.keyId, b)
    if (this.holds.has(i.idempotencyKey)) return { allowed: true, spent: b.spent, budget: b.budget }
    if (money(b.spent + b.reserved + i.amountUsd) > b.budget) return { allowed: false, spent: b.spent, budget: b.budget }
    b.reserved = money(b.reserved + i.amountUsd)
    this.holds.set(i.idempotencyKey, { keyId: i.keyId, amount: i.amountUsd, status: 'held' })
    return { allowed: true, spent: b.spent, budget: b.budget }
  }

  async settle(i: ConnectionSettleInput) {
    if (this.failSettles > 0) {
      this.failSettles--
      throw new Error('ledger write failed')
    }
    const h = this.holds.get(i.idempotencyKey)
    if (!h) throw new Error(`no hold for ${i.idempotencyKey}`)
    const b = this.budgets.get(h.keyId)!
    if (h.status === 'released') throw new Error('hold released')
    if (h.status === 'held') {
      b.reserved = Math.max(money(b.reserved - h.amount), 0)
      b.spent = money(b.spent + i.costUsd)
      this.ledger.push({ ...i, keyId: h.keyId })
      h.status = 'settled'
    }
    return { spent: b.spent, budget: b.budget }
  }

  async release(idempotencyKey: string) {
    const h = this.holds.get(idempotencyKey)
    if (!h || h.status !== 'held') return
    const b = this.budgets.get(h.keyId)!
    b.reserved = Math.max(money(b.reserved - h.amount), 0)
    h.status = 'released'
  }

  async drift(keyId: string): Promise<ConnectionDrift | undefined> {
    const b = this.budgets.get(keyId)
    if (!b) return undefined
    const ledgerSum = this.ledger.filter((r) => r.keyId === keyId).reduce((s, r) => s + r.costUsd, 0)
    return { keyId, spent: b.spent, ledgerSum: money(ledgerSum), drift: money(b.spent - ledgerSum), reserved: b.reserved }
  }
}

// ---------------------------------------------------------------------------
// Supabase store — production. Calls the SQL functions in
// scripts/shipyard-gateway-tables.sql (service role only).
// ---------------------------------------------------------------------------
export class SupabaseConnectionLedgerStore implements ConnectionLedgerStore {
  private readonly base: string
  private readonly headers: Record<string, string>
  private readonly f: typeof fetch

  constructor(opts: { url: string; key: string; fetch?: typeof fetch }) {
    if (!opts.url) throw new Error('SupabaseConnectionLedgerStore: `url` is required')
    if (!opts.key) throw new Error('SupabaseConnectionLedgerStore: `key` is required')
    this.base = opts.url.replace(/\/+$/, '') + '/rest/v1'
    this.f = opts.fetch ?? fetch
    this.headers = { apikey: opts.key, authorization: `Bearer ${opts.key}`, 'content-type': 'application/json' }
  }

  private async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.f(`${this.base}/rpc/${name}`, { method: 'POST', headers: this.headers, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`connection ledger ${name} failed: ${res.status}`)
    return (await res.json()) as T
  }

  async reserve(i: ConnectionReserveInput) {
    const rows = await this.rpc<Array<{ allowed: boolean; spent: number | string; budget: number | string }>>(
      'shipyard_connection_debit',
      { p_key_id: i.keyId, p_amount_usd: i.amountUsd, p_idempotency_key: i.idempotencyKey, p_budget_usd: i.budgetUsd },
    )
    const r = rows[0]
    if (!r) throw new Error('connection ledger debit returned no row')
    return { allowed: r.allowed === true, spent: Number(r.spent), budget: Number(r.budget) }
  }

  async settle(i: ConnectionSettleInput) {
    const rows = await this.rpc<Array<{ spent: number | string; budget: number | string }>>('shipyard_connection_settle', {
      p_idempotency_key: i.idempotencyKey,
      p_cost_usd: i.costUsd,
      p_request_id: i.requestId,
      p_workspace_ref: i.workspaceRef ?? null,
      p_model: i.model ?? null,
      p_provider: i.provider ?? null,
    })
    const r = rows[0]
    return { spent: Number(r?.spent ?? 0), budget: Number(r?.budget ?? 0) }
  }

  async release(idempotencyKey: string) {
    await this.rpc('shipyard_connection_release', { p_idempotency_key: idempotencyKey })
  }

  async drift(keyId: string): Promise<ConnectionDrift | undefined> {
    const rows = await this.rpc<Array<{ key_id: string; spent: number | string; ledger_sum: number | string; drift: number | string; reserved: number | string }>>(
      'shipyard_connection_drift',
      { p_key_id: keyId },
    )
    const r = rows[0]
    if (!r) return undefined
    return { keyId: r.key_id, spent: Number(r.spent), ledgerSum: Number(r.ledger_sum), drift: Number(r.drift), reserved: Number(r.reserved) }
  }
}
