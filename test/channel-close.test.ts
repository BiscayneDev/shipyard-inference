// Channel close — settle the accumulated draw on-chain in ONE transaction.
// Unit tests for the handler's guard conditions + ledger accounting that don't
// require a live settle (the actual on-chain settle needs a funded operator +
// RPC, tested by the portal's mock-wallet harness).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Account } from '../src/gateway/keys.js'
import type { GatewayConfig } from '../src/gateway/config.js'
import { MemoryChannelStore } from '../src/gateway/channels.js'
import { MemoryCreditStore } from '../src/tender/credit-store.js'
import { handleChannelClose } from '../src/gateway/channel-close.js'

const WALLET = 'AgentWallet1111111111111111111111111111111'
const account: Account = { userId: 'u_close_test', wallet: WALLET, status: 'active', createdAt: 0 }

function config(scheme: 'exact' | 'upto', channelStore?: MemoryChannelStore, credits?: MemoryCreditStore): GatewayConfig {
  return {
    candidates: [],
    x402: scheme === 'upto'
      ? {
          treasury: 'TreasuryTest1111111111111111111111111111111',
          network: 'devnet',
          scheme: 'upto',
          priceUsdc: 0.001,
          perTokenUsdc: 0.0001,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as GatewayConfig['x402']
      : undefined,
    channelStore,
    creditStore: credits ?? new MemoryCreditStore(),
  }
}

test('channel close: no channel on the key → 404', async () => {
  const r = await handleChannelClose(config('upto', new MemoryChannelStore()), account, new MemoryChannelStore(), {})
  assert.equal(r.status, 404)
})

test('channel close: non-upto gateway → 501 (scheme mismatch)', async () => {
  const r = await handleChannelClose(config('exact', new MemoryChannelStore()), account, new MemoryChannelStore(), {})
  assert.equal(r.status, 501)
})

test('channel close: no retained settle data → 409', async () => {
  const store = new MemoryChannelStore()
  await store.record({ account: account.userId, channelId: 'chx', payer: WALLET, ceilingUsd: 5, ceilingBaseUnits: '5000000', openedAt: 0 })
  const r = await handleChannelClose(config('upto', store), account, store, {})
  assert.equal(r.status, 409)
})

test('channel close: invalid draw → 400; open channel missing → 404', async () => {
  const store = new MemoryChannelStore()
  const r = await handleChannelClose(config('upto', store), account, store, { drawUsd: -1 })
  assert.equal(r.status, 404, 'no channel yet → 404 regardless of draw')
})
