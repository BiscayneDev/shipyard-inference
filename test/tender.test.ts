import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Auction,
  observeWaitWindow,
  matchesTargeting,
  impressionFloorUsdc,
  type Campaign,
  type TenderRequestContext,
} from '../src/index.js'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function campaign(over: Partial<Campaign> & Pick<Campaign, 'campaignId'>): Campaign {
  return {
    placementId: over.campaignId,
    advertiserWallet: 'AdWallet',
    endpointUrl: `https://x402/${over.campaignId}`,
    line: `promo ${over.campaignId}`,
    usdcPerImpression: 0.005,
    remainingImpressions: 1000,
    fundedUsdc: 5,
    targeting: {},
    ...over,
  }
}

const ctx = (over: Partial<TenderRequestContext> = {}): TenderRequestContext => ({
  requestId: 'r1',
  surfaceId: 'portal-ide',
  ...over,
})

test('auction: first-price — highest bid wins the slot', () => {
  const a = new Auction([
    campaign({ campaignId: 'low', usdcPerImpression: 0.002 }),
    campaign({ campaignId: 'high', usdcPerImpression: 0.005 }),
  ])
  const p = a.select(ctx())
  assert.equal(p?.placementId, 'high')
  assert.equal(p?.requestId, 'r1')
})

test('auction: returns null when no funded, matching bid clears the floor', () => {
  const floor = impressionFloorUsdc() // 1 / 1000 = 0.001
  const a = new Auction([campaign({ campaignId: 'tooLow', usdcPerImpression: floor / 2 })])
  assert.equal(a.select(ctx()), null)
})

test('auction: targeting filters by request context only', () => {
  const a = new Auction([
    campaign({ campaignId: 'agentOnly', targeting: { agentic: true } }),
    campaign({ campaignId: 'codeOnly', usdcPerImpression: 0.009, targeting: { taskTypes: ['code'] } }),
  ])
  // Non-agentic chat request: agentOnly excluded; codeOnly excluded (taskType mismatch).
  assert.equal(a.select(ctx({ agentic: false, taskType: 'chat' })), null)
  // Agentic code request: codeOnly wins (higher bid) — both match.
  assert.equal(a.select(ctx({ agentic: true, taskType: 'code' }))?.placementId, 'codeOnly')
})

test('auction: decrements impressions and skips exhausted campaigns', () => {
  const a = new Auction([campaign({ campaignId: 'one', remainingImpressions: 1 })])
  assert.equal(a.select(ctx())?.placementId, 'one')
  assert.equal(a.select(ctx()), null) // exhausted
})

test('matchesTargeting: empty spec matches anything', () => {
  assert.equal(matchesTargeting({}, ctx({ agentic: true, taskType: 'code' })), true)
  assert.equal(matchesTargeting({ modelClasses: ['frontier'] }, ctx({ modelClass: 'small' })), false)
})

test('observeWaitWindow: sub-perceptual flash does not open a window', async () => {
  async function* fast() {
    yield { type: 'text_delta', text: 'hi' }
    yield { type: 'done', response: { text: 'hi' } } as never
  }
  let opened = 0
  let metered = -1
  const out: string[] = []
  for await (const ev of observeWaitWindow(fast(), {
    onWaitWindow: () => { opened++ },
    onFirstToken: (ms) => { metered = ms },
  }, { minWaitMs: 50 })) {
    out.push(ev.type)
  }
  assert.equal(opened, 0, 'fast first token must not open a window')
  assert.equal(metered, -1)
  assert.deepEqual(out, ['text_delta', 'done'], 'all events pass through unchanged')
})

test('observeWaitWindow: a real wait opens the window and meters it', async () => {
  async function* slow() {
    await sleep(40)
    yield { type: 'text_delta', text: 'hi' }
    yield { type: 'done', response: { text: 'hi' } } as never
  }
  let opened = 0
  let metered = -1
  const out: string[] = []
  for await (const ev of observeWaitWindow(slow(), {
    onWaitWindow: () => { opened++ },
    onFirstToken: (ms) => { metered = ms },
  }, { minWaitMs: 10 })) {
    out.push(ev.type)
  }
  assert.equal(opened, 1, 'idle past minWaitMs opens exactly one window')
  assert.ok(metered >= 10, `measured wait ${metered}ms should be >= minWaitMs`)
  assert.deepEqual(out, ['text_delta', 'done'])
})
