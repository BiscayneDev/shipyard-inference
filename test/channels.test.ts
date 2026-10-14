// Payment-channel registry (upto): binds an on-chain channel to a key so its
// balance is provably backed by escrow. Unit test for the store + the /v1/topup
// response surfacing the channel id after a verified channel open.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryChannelStore } from '../src/gateway/channels.js'

test('channel store: records and surfaces the active channel per account', async () => {
  const store = new MemoryChannelStore()
  assert.equal(await store.active('u_one'), undefined, 'no channel before any open')

  await store.record({
    account: 'u_one',
    channelId: 'chJx9wXu4QzCiHjooksJXKQw2qbH4JTh6PHPcLS1Bf2u',
    payer: 'P4ayaWallet111111111111111111111111111111',
    ceilingUsd: 5,
    ceilingBaseUnits: '5000000',
    openedAt: 1_720_000_000_000,
  })

  const ch = await store.active('u_one')
  assert.ok(ch, 'channel recorded')
  assert.equal(ch!.channelId, 'chJx9wXu4QzCiHjooksJXKQw2qbH4JTh6PHPcLS1Bf2u')
  assert.equal(ch!.ceilingUsd, 5)
  assert.equal(ch!.ceilingBaseUnits, '5000000')
  assert.equal(ch!.payer, 'P4ayaWallet111111111111111111111111111111')

  assert.equal(await store.active('u_other'), undefined, 'channels are per-account')
  assert.equal(store.size, 1)
})

test('channel store: a re-open replaces the prior channel (one active per account)', async () => {
  const store = new MemoryChannelStore()
  await store.record({ account: 'u_a', channelId: 'chOld11111111111111111111111111111111111', payer: 'p1', ceilingUsd: 1, ceilingBaseUnits: '1000000', openedAt: 1 })
  await store.record({ account: 'u_a', channelId: 'chNew11111111111111111111111111111111111', payer: 'p2', ceilingUsd: 2, ceilingBaseUnits: '2000000', openedAt: 2 })
  const ch = await store.active('u_a')
  assert.equal(ch!.channelId, 'chNew11111111111111111111111111111111111')
  assert.equal(ch!.ceilingUsd, 2)
  assert.equal(store.size, 1)
})
