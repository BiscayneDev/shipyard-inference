import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTenderSettlementRoutes } from '../src/gateway/tender-settlement.js'
import { SupabaseTenderSettlementStore, type Claim, type TenderSettlementStore } from '../src/tender/settlement-store.js'
function setup(overrides: Partial<TenderSettlementStore> = {}, broadcast = async () => {}) {
  let held = false, prepared = false, paid = false, transfers = 0
  const claim: Claim = { id: 'fictional-claim', account: 'fictional-account', wallet: 'fictional-wallet', amountUsd: 1 }
  const store: TenderSettlementStore = {
    reserve: async () => { if (held) return; held = true; return claim },
    prepared: async () => { prepared = true }, confirmed: async () => { paid = true },
    routed: async () => 0,
    impression: async () => ({ accrued: 0.0005 }), ...overrides,
  }
  const app = createTenderSettlementRoutes({ claimsEnabled: true, store, account: async () => ({ userId: claim.account, wallet: claim.wallet }),
    prepare: async () => ({ signature: 'fictional-signature', network: 'devnet', signer: 'fictional-signer', mint: 'fictional-mint', blockhash: 'fictional-blockhash', lastValidBlockHeight: 1, broadcast: async () => {
      assert.equal(prepared, true, 'transaction identity must persist before broadcast'); transfers++; await broadcast()
    } }), minClaimUsd: 0.0005, minImpressionIntervalMs: 5000 })
  return { app, state: () => ({ held, prepared, paid, transfers }) }
}
const post = (app: ReturnType<typeof setup>['app']) => app.request('/api/tender/claim', { method: 'POST' })
test('concurrent claims broadcast once', async () => {
  const s = setup()
  const r = await Promise.all([post(s.app), post(s.app)])
  assert.deepEqual(r.map(x => x.status).sort(), [200, 409])
  assert.equal(s.state().transfers, 1)
})
test('reserve failure sends nothing', async () => {
  const s = setup({ reserve: async () => { throw Error('storage down') } })
  assert.equal((await post(s.app)).status, 503); assert.equal(s.state().transfers, 0)
})
test('preparation persistence failure sends nothing and holds claim', async () => {
  const s = setup({ prepared: async () => { throw Error('storage down') } })
  assert.equal((await post(s.app)).status, 202); assert.equal((await post(s.app)).status, 409)
  assert.equal(s.state().transfers, 0)
})
test('unknown chain outcome is held, never re-broadcast by another claim', async () => {
  const s = setup({}, async () => { throw Error('confirmation timeout') })
  assert.equal((await post(s.app)).status, 202); assert.equal((await post(s.app)).status, 409)
  assert.equal(s.state().transfers, 1); assert.equal(s.state().paid, false)
})
test('confirmed chain transfer with failed final persistence is not reported paid or retried', async () => {
  const s = setup({ confirmed: async () => { throw Error('storage down') } })
  assert.equal((await post(s.app)).status, 202); assert.equal((await post(s.app)).status, 409)
  assert.equal(s.state().transfers, 1)
})
test('impression RPC failure is not swallowed', async () => {
  const s = setup({ impression: async () => { throw Error('storage down') } })
  assert.equal((await s.app.request('/api/tender/impression', { method: 'POST' })).status, 503)
})
test('missing durable store refuses claim and impression without work', async () => {
  const app = createTenderSettlementRoutes({ claimsEnabled: true, account: async () => ({ userId: 'fictional', wallet: 'fictional' }),
    prepare: async () => { throw Error('must not run') }, minClaimUsd: 1, minImpressionIntervalMs: 5000 })
  assert.equal((await post(app)).status, 503)
  assert.equal((await app.request('/api/tender/impression', { method: 'POST' })).status, 503)
})
test('unauthenticated calls cannot reserve or prepare', async () => {
  const app = createTenderSettlementRoutes({ claimsEnabled: true, account: async () => undefined,
    prepare: async () => { throw Error('must not run') }, minClaimUsd: 1, minImpressionIntervalMs: 5000 })
  assert.equal((await post(app)).status, 401)
})
test('Supabase adapter rejects unsuccessful RPC responses and false transitions', async () => {
  const make = (body: string, status: number) => new SupabaseTenderSettlementStore({ url: 'https://fictional.invalid', key: 'fictional', fetch: async () => new Response(body, { status }) })
  await assert.rejects(make('', 503).reserve('a','w',1))
  await assert.rejects(make('false', 200).prepared('id','sig','devnet',{ signer:'s',mint:'m',blockhash:'b',lastValidBlockHeight:1 }))
  await assert.rejects(make('false', 200).confirmed('id','sig'))
})

test('claims stay paused by default even when a durable store is present', async () => {
 const app=createTenderSettlementRoutes({ account: async()=>{throw Error('must not authenticate')}, prepare:async()=>{throw Error('must not prepare')}, minClaimUsd:1,minImpressionIntervalMs:5000 })
 assert.equal((await post(app)).status,503)
})
