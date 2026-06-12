import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Auction,
  AuctionLog,
  observeWaitWindow,
  matchesTargeting,
  impressionFloorUsdc,
  loadAttestationKey,
  generateAttestationSeedHex,
  signAttestation,
  verifyAttestation,
  assertValidAttestation,
  CreditLedger,
  accrueSettlement,
  accrueClick,
  sweepCredits,
  usdcToAtomic,
  type Campaign,
  type Placement,
  type TenderRequestContext,
  type UsageAttestation,
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

// --- attestation (the moat) ------------------------------------------------

const KEY = loadAttestationKey({ seedHex: generateAttestationSeedHex() })
const unsigned = (over: Partial<UsageAttestation> = {}): Omit<UsageAttestation, 'sig'> => ({
  requestId: 'r1',
  model: 'claude-haiku-4-5',
  billedCostUsd: 0.0001,
  measuredWaitMs: 1000,
  surfaceId: 'portal-ide',
  userWallet: 'Wallet1',
  placementId: 'p1',
  issuedAt: 1_700_000_000_000,
  ...over,
})
const served = (rid: string, pid: string) => rid === 'r1' && pid === 'p1'

test('attestation: sign → verify roundtrip; tamper breaks it', () => {
  const att = signAttestation(unsigned(), KEY)
  assert.equal(att.sig.length, 128, 'ed25519 sig is 64 bytes / 128 hex')
  assert.equal(verifyAttestation(att, KEY.publicKeyHex), true)
  assert.equal(verifyAttestation({ ...att, billedCostUsd: 9.99 }, KEY.publicKeyHex), false)
  const other = loadAttestationKey({ seedHex: generateAttestationSeedHex() })
  assert.equal(verifyAttestation(att, other.publicKeyHex), false, 'wrong key must not verify')
})

test('attestation: a 32-byte seed is deterministic', () => {
  const seed = generateAttestationSeedHex()
  assert.equal(loadAttestationKey({ seedHex: seed }).publicKeyHex, loadAttestationKey({ seedHex: seed }).publicKeyHex)
})

test('gate: passes only a signed, billed, waited, served attestation', () => {
  const att = signAttestation(unsigned(), KEY)
  assert.deepEqual(assertValidAttestation(att, { publicKeyHex: KEY.publicKeyHex, wasServed: served }), { ok: true })
})

test('gate: rejects $0 inference (the anti-fraud bind)', () => {
  const att = signAttestation(unsigned({ billedCostUsd: 0 }), KEY)
  const r = assertValidAttestation(att, { publicKeyHex: KEY.publicKeyHex, wasServed: served })
  assert.equal(r.ok, false)
  assert.match(r.reason ?? '', /billedCostUsd/)
})

test('gate: rejects sub-threshold wait, not-served, and forged sig', () => {
  const short = signAttestation(unsigned({ measuredWaitMs: 100 }), KEY)
  assert.equal(assertValidAttestation(short, { publicKeyHex: KEY.publicKeyHex, minWaitMs: 800 }).ok, false)

  const att = signAttestation(unsigned(), KEY)
  assert.equal(assertValidAttestation(att, { publicKeyHex: KEY.publicKeyHex, wasServed: () => false }).ok, false)

  const forged: UsageAttestation = { ...unsigned(), sig: 'deadbeef'.repeat(16) }
  assert.equal(assertValidAttestation(forged, { publicKeyHex: KEY.publicKeyHex }).ok, false)
})

test('auction log: records served placement for the gate cross-check', () => {
  const log = new AuctionLog()
  const p: Placement = {
    placementId: 'p1', requestId: 'r1', line: 'x', endpointUrl: 'https://x',
    advertiserWallet: 'Ad', usdcPerImpression: 0.005,
  }
  log.record(p, 1_700_000_000_000)
  assert.equal(log.wasServed('r1', 'p1'), true)
  assert.equal(log.wasServed('r1', 'pX'), false)
  assert.equal(log.wasServed('rX', 'p1'), false)
})

// --- settlement + credit loop (step 4) -------------------------------------

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

test('credit ledger: accrue, balance, partial consume, sweep', () => {
  const led = new CreditLedger()
  led.creditInference('W', 0.003, { requestId: 'r1', placementId: 'p1' }, 1)
  led.creditInference('W', 0.002, { requestId: 'r2', placementId: 'p1' }, 2)
  led.creditInference('X', 0.009, { requestId: 'r3', placementId: 'p1' }, 3)
  assert.ok(near(led.balance('W'), 0.005))
  assert.ok(near(led.total(), 0.014))
  assert.ok(near(led.consume('W', 0.004), 0.004)) // spans both W entries (partial 2nd)
  assert.ok(near(led.balance('W'), 0.001))
  assert.ok(near(led.markSwept('W'), 0.001))
  assert.equal(led.balance('W'), 0)
  assert.ok(near(led.balance('X'), 0.009), 'other wallets untouched')
})

test('accrueSettlement: valid → accrues REQUESTER_SHARE; invalid → nothing', () => {
  const led = new CreditLedger()
  const ok = accrueSettlement(signAttestation(unsigned({ userWallet: 'W' }), KEY), {
    publicKeyHex: KEY.publicKeyHex, ledger: led, pricePerImpressionUsdc: 0.005, wasServed: () => true, at: 1,
  })
  assert.equal(ok.status, 'accrued')
  assert.ok(near(ok.requesterShareUsdc, 0.0025)) // 0.5 × 0.005
  assert.ok(near(led.balance('W'), 0.0025))

  const bad = accrueSettlement(signAttestation(unsigned({ userWallet: 'W', billedCostUsd: 0 }), KEY), {
    publicKeyHex: KEY.publicKeyHex, ledger: led, pricePerImpressionUsdc: 0.005, wasServed: () => true, at: 2,
  })
  assert.equal(bad.status, 'rejected')
  assert.ok(near(led.balance('W'), 0.0025), 'rejected attestation accrues nothing')
})

test('sweepCredits: batches the balance through the settle rail, then marks swept', async () => {
  const led = new CreditLedger()
  led.creditInference('W', 0.0025, { requestId: 'r1', placementId: 'p1' }, 1)
  const calls: Array<{ amount: string; treasury: string }> = []
  const res = await sweepCredits(led, 'W', {
    settle: async (a) => { calls.push(a); return { signature: 'SIG' } },
    treasury: 'T', network: 'devnet',
  })
  assert.equal(res?.signature, 'SIG')
  assert.ok(near(res?.amountUsd ?? -1, 0.0025))
  assert.equal(calls[0]?.amount, '2500') // 0.0025 USDC → atomic
  assert.equal(led.balance('W'), 0)
  assert.equal(await sweepCredits(led, 'W', { settle: async () => ({ signature: 'X' }), treasury: 'T' }), null)
})

test('usdcToAtomic: 6-decimal atomic units', () => {
  assert.equal(usdcToAtomic(0.0025), '2500')
  assert.equal(usdcToAtomic(1), '1000000')
})

test('accrueClick: bills CLICK_MULTIPLIER × impression, credits the share', () => {
  const led = new CreditLedger()
  const r = accrueClick({
    ledger: led, wallet: 'W', requestId: 'r1', placementId: 'p1',
    pricePerImpressionUsdc: 0.005, clickMultiplier: 50, requesterShare: 0.5, at: 1,
  })
  assert.ok(near(r.grossUsdc, 0.25)) // 0.005 × 50
  assert.ok(near(r.creditedUsd, 0.125)) // 0.25 × 0.50
  assert.ok(near(led.balance('W'), 0.125))
})
