import { connectionBudgetStatus } from './oauth.js'

/** Lifetime per-connection budget: spend ledger keyed by projectId under the 'lifetime' bucket. */
export interface ConnectionBudget {
  prefix: string
  budgetUsd: number
  store: { spent(p: string, day: string): Promise<number>; add(p: string, day: string, usd: number): Promise<number> }
}

const onConnection = (cb: ConnectionBudget | undefined, projectId: string | undefined): projectId is string =>
  !!cb && !!projectId && projectId.startsWith(cb.prefix)

/** Returns the 402 body when a connection has used its budget; undefined otherwise. */
export async function connectionGate(cb: ConnectionBudget | undefined, projectId: string | undefined): Promise<Record<string, unknown> | undefined> {
  if (!cb || !onConnection(cb, projectId)) return undefined
  const gate = connectionBudgetStatus(await cb.store.spent(projectId, 'lifetime'), cb.budgetUsd)
  return gate.ok ? undefined : gate.body
}

/** Debit actual cost to the connection's lifetime ledger. Never for unbilled or $0 requests. */
export async function connectionSpend(cb: ConnectionBudget | undefined, projectId: string | undefined, costUsd: number | undefined, billed: boolean | undefined): Promise<void> {
  if (!cb || !onConnection(cb, projectId) || billed === false || !(costUsd && costUsd > 0)) return
  await cb.store.add(projectId, 'lifetime', costUsd)
}
