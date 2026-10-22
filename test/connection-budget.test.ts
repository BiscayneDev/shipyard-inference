import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MemoryConnectionLedgerStore,
  connectionDrift,
  connectionIdempotencyKey,
  connectionRelease,
  connectionReserve,
  connectionSettle,
  type ConnectionBudget,
} from '../src/gateway/connection-budget.js'
import { createGatewayApp, MemoryApiKeyStore } from '../src/gateway/index.js'
import { candidate, mockProvider, model } from './helpers.js'

const KEY = 'dock_conn_test'

function budget(store: MemoryConnectionLedgerStore, budgetUsd = 1, holdUsd = 0.05): ConnectionBudget {
  return { prefix: 'dock_', budgetUsd, holdUsd, store }
}

test('non-connection projects and disabled config are untouched', async () => {
  const store = new MemoryConnectionLedgerStore()
  const cb = budget(store)
  assert.deepEqual(await connectionReserve(cb, 'dinghy-prod', 'r1'), {})
  assert.deepEqual(await connectionReserve(undefined, KEY, 'r1'), {})
  assert.equal(store.budgets.size, 0)
})

test('reserve refuses once spent + held would exceed the budget; settle converts hold to spend', async () => {
  const store = new MemoryConnectionLedgerStore()
  const cb = budget(store, 0.1, 0.05)
  const a = await connectionReserve(cb, KEY, 'a')
  const b = await connectionReserve(cb, KEY, 'b')
  const c = await connectionReserve(cb, KEY, 'c')
  assert.ok(a.hold && b.hold, 'first two fit')
  assert.equal(c.hold, undefined)
  assert.equal(c.refused?.code, 'budget_exhausted')
  await connectionSettle(cb, a.hold, 'a', 0.03, true, { model: 'm', provider: 'p' })
  await connectionSettle(cb, b.hold, 'b', 0.05, true)
  const d = await connectionDrift(cb, KEY)
  assert.equal(d?.spent, 0.08)
  assert.equal(d?.reserved, 0)
  assert.equal(d?.drift, 0)
  assert.equal(store.ledger.length, 2)
})

test('retried request with the same idempotency key does not double-reserve or double-debit', async () => {
  const store = new MemoryConnectionLedgerStore()
  const cb = budget(store, 1, 0.05)
  const first = await connectionReserve(cb, KEY, 'req-1')
  const retry = await connectionReserve(cb, KEY, 'req-1')
  assert.equal(first.hold?.idempotencyKey, connectionIdempotencyKey(KEY, 'req-1'))
  assert.equal(retry.hold?.idempotencyKey, first.hold?.idempotencyKey)
  assert.equal(store.budgets.get(KEY)?.reserved, 0.05, 'one hold, not two')
  await connectionSettle(cb, first.hold, 'req-1', 0.02, true)
  // Retried settle (e.g. a client/host retry) must not add a second ledger row or spend.
  await connectionSettle(cb, retry.hold, 'req-1', 0.02, true)
  assert.equal(store.ledger.length, 1)
  assert.equal(store.budgets.get(KEY)?.spent, 0.02)
  assert.equal((await connectionDrift(cb, KEY))?.drift, 0)
})

test('unbilled (BYO) and released holds free the reservation without a charge', async () => {
  const store = new MemoryConnectionLedgerStore()
  const cb = budget(store, 1, 0.05)
  const h = await connectionReserve(cb, KEY, 'byo')
  await connectionSettle(cb, h.hold, 'byo', 0.5, false)
  assert.equal(store.budgets.get(KEY)?.reserved, 0)
  assert.equal(store.budgets.get(KEY)?.spent, 0)
  assert.equal(store.ledger.length, 0)
  const r = await connectionReserve(cb, KEY, 'failed')
  await connectionRelease(cb, r.hold)
  assert.equal(store.budgets.get(KEY)?.reserved, 0)
})

test('failed ledger write: settle throws, nothing is charged, and the hold is never released for free', async () => {
  const store = new MemoryConnectionLedgerStore()
  const cb = budget(store, 1, 0.05)
  const h = await connectionReserve(cb, KEY, 'lw')
  store.failSettles = 2 // first attempt and the single retry both fail
  await assert.rejects(connectionSettle(cb, h.hold, 'lw', 0.05, true))
  await connectionRelease(cb, h.hold) // must be a no-op once settle was attempted
  assert.equal(store.budgets.get(KEY)?.spent, 0, 'no charge recorded')
  assert.equal(store.ledger.length, 0, 'no ledger row without the write')
  assert.equal(store.budgets.get(KEY)?.reserved, 0.05, 'hold stays reserved (conservative, reconcilable)')
})

// ---------------------------------------------------------------------------
// HTTP-level: the real gateway app with a dock_ connection.
// Test model pricing is $1/M in + $1/M out, so 50_000 input tokens = $0.05.
// ---------------------------------------------------------------------------

function connectionApp(store: MemoryConnectionLedgerStore, budgetUsd = 1, keyStore = new MemoryApiKeyStore()) {
  const app = createGatewayApp({
    candidates: [
      candidate(
        'c',
        mockProvider(() => ({ content: 'hi', toolCalls: [], stopReason: 'end_turn', usage: { inputTokens: 50_000, outputTokens: 0 } })),
        [model('m')],
      ),
    ],
    keyStore,
    connectionBudget: budget(store, budgetUsd, 0.05),
  })
  return { app, keyStore }
}

async function issueConnectionKey(keyStore: MemoryApiKeyStore): Promise<string> {
  return (await keyStore.issue({ projectId: KEY }, Date.now())).key
}

test('50 concurrent calls against a $1 connection budget at $0.05 each never overshoot', async () => {
  const store = new MemoryConnectionLedgerStore()
  const { app, keyStore } = connectionApp(store, 1)
  const key = await issueConnectionKey(keyStore)
  const post = () =>
    app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    })
  const responses = await Promise.all(Array.from({ length: 50 }, post))
  const statuses = responses.map((r) => r.status)
  const served = statuses.filter((s) => s === 200).length
  const refused = statuses.filter((s) => s === 402).length
  assert.equal(served + refused, 50, `unexpected statuses: ${[...new Set(statuses)]}`)
  assert.equal(served, 20, 'exactly budget / hold calls are served')
  const b = store.budgets.get(KEY)!
  assert.ok(b.spent <= 1 + 1e-9, `spent ${b.spent} overshot $1`)
  assert.equal(b.spent, 1, 'spent equals the budget at $0.05 x 20')
  assert.equal(b.reserved, 0, 'no leaked holds')
  const d = await connectionDrift({ prefix: 'dock_', budgetUsd: 1, holdUsd: 0.05, store }, KEY)
  assert.equal(d?.drift, 0, 'counter reconciles with ledger rows after the concurrent test')
  assert.equal(d?.ledgerSum, 1)
  assert.equal(store.ledger.length, 20)
})

test('ledger write failure refuses with 503 and charges nothing', async () => {
  const store = new MemoryConnectionLedgerStore()
  const { app, keyStore } = connectionApp(store, 1)
  const key = await issueConnectionKey(keyStore)
  store.failSettles = 2
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 503)
  const body = (await res.json()) as { error: { code: string } }
  assert.equal(body.error.code, 'connection_ledger_unavailable')
  assert.equal(store.budgets.get(KEY)?.spent, 0)
  assert.equal(store.ledger.length, 0)
})

test('reserve store failure refuses before serving (503, provider never called)', async () => {
  let called = 0
  const failing = new MemoryConnectionLedgerStore()
  failing.reserve = async () => {
    throw new Error('db down')
  }
  const keyStore = new MemoryApiKeyStore()
  const app = createGatewayApp({
    candidates: [
      candidate(
        'c',
        mockProvider(() => {
          called++
          return { content: 'hi', toolCalls: [], stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } }
        }),
        [model('m')],
      ),
    ],
    keyStore,
    connectionBudget: budget(failing),
  })
  const key = await issueConnectionKey(keyStore)
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 503)
  assert.equal(called, 0)
})

test('/v1/messages shares the same connection budget (sequential: 2 served, 3rd refused)', async () => {
  const store = new MemoryConnectionLedgerStore()
  const keyStore = new MemoryApiKeyStore()
  const app = createGatewayApp({
    candidates: [
      candidate(
        'c',
        mockProvider(() => ({ content: 'hi', toolCalls: [], stopReason: 'end_turn', usage: { inputTokens: 50_000, outputTokens: 0 } })),
        [model('m')],
      ),
    ],
    keyStore,
    connectionBudget: budget(store, 0.1, 0.05),
  })
  const key = await issueConnectionKey(keyStore)
  const statuses: number[] = []
  for (let i = 0; i < 3; i++) {
    const r = await app.request('/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }),
    })
    statuses.push(r.status)
  }
  assert.deepEqual(statuses, [200, 200, 402])
  assert.equal(store.budgets.get(KEY)?.spent, 0.1)
})
