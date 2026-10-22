import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connectionGate, connectionSpend, type ConnectionBudget } from '../src/gateway/connection-budget.js'

function mem(): ConnectionBudget['store'] & { m: Map<string, number> } {
  const m = new Map<string, number>()
  return {
    m,
    async spent(p, d) { return m.get(`${p}|${d}`) ?? 0 },
    async add(p, d, usd) { const k = `${p}|${d}`; const v = (m.get(k) ?? 0) + usd; m.set(k, v); return v },
  }
}

test('connection budget: $10 default is enforced per call; spend accrues only on billed calls', async () => {
  const store = mem()
  const cb: ConnectionBudget = { prefix: 'dock_', budgetUsd: 10, store }
  assert.equal(await connectionGate(cb, 'dock_abc'), undefined, 'fresh connection passes')
  await connectionSpend(cb, 'dock_abc', 9.5, true)
  assert.equal(await connectionGate(cb, 'dock_abc'), undefined, 'under budget passes')
  await connectionSpend(cb, 'dock_abc', 0.5, true)
  const body = await connectionGate(cb, 'dock_abc')
  assert.equal(body?.error, 'budget_exhausted', 'at budget refused')
  await connectionSpend(cb, 'dock_abc', 3, false)
  assert.equal(store.m.get('dock_abc|lifetime'), 10, 'unbilled call does not accrue')
})

test('connection budget: non-connection projects and disabled config are untouched', async () => {
  const store = mem()
  const cb: ConnectionBudget = { prefix: 'dock_', budgetUsd: 10, store }
  await connectionSpend(cb, 'dinghy-prod', 50, true)
  assert.equal(store.m.size, 0)
  assert.equal(await connectionGate(cb, 'dinghy-prod'), undefined)
  assert.equal(await connectionGate(undefined, 'dock_abc'), undefined)
})
