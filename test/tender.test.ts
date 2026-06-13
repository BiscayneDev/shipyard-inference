import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Auction,
  AuctionLog,
  observeWaitWindow,
  matchesTargeting,
  impressionFloorUsdc,
  splitImpression,
  TENDER_DEFAULTS,
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
  buildCampaign,
  MemoryCampaignStore,
  GatewayTender,
  MemoryCreditStore,
  SupabaseCreditStore,
  sweepAll,
  totalPaid,
  reconcile,
  MemoryPayoutLog,
  SupabasePayoutLog,
  isCampaignActive,
  tenderDepositConfig,
  newPaymentReference,
  buildDepositIntent,
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

test('splitImpression: splits gross into requester + provider shares', () => {
  const even = splitImpression(0.005, 0.5, 0.5)
  assert.ok(near(even.requesterUsdc, 0.0025))
  assert.ok(near(even.providerUsdc, 0.0025))
  // Asymmetric, summing < 1.0 (a deliberate margin) is allowed.
  const skew = splitImpression(0.01, 0.6, 0.3)
  assert.ok(near(skew.requesterUsdc, 0.006))
  assert.ok(near(skew.providerUsdc, 0.003))
  // Shares summing above 1.0 are rejected.
  assert.throws(() => splitImpression(1, 0.7, 0.5), /<= 1/)
})

test('TENDER_DEFAULTS: provider share defaults to the impression remainder', () => {
  assert.equal(TENDER_DEFAULTS.PROVIDER_SHARE, 0.5)
  assert.equal(TENDER_DEFAULTS.REQUESTER_SHARE + TENDER_DEFAULTS.PROVIDER_SHARE, 1)
})

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
  assert.ok(near(ok.providerShareUsdc, 0)) // no providerAccount → no provider accrual
  assert.ok(near(led.balance('W'), 0.0025))

  const bad = accrueSettlement(signAttestation(unsigned({ userWallet: 'W', billedCostUsd: 0 }), KEY), {
    publicKeyHex: KEY.publicKeyHex, ledger: led, pricePerImpressionUsdc: 0.005, wasServed: () => true, at: 2,
  })
  assert.equal(bad.status, 'rejected')
  assert.ok(near(led.balance('W'), 0.0025), 'rejected attestation accrues nothing')
})

test('accrueSettlement: provider account accrues the provider cut alongside the requester', () => {
  const led = new CreditLedger()
  const ok = accrueSettlement(signAttestation(unsigned({ userWallet: 'W' }), KEY), {
    publicKeyHex: KEY.publicKeyHex, ledger: led, pricePerImpressionUsdc: 0.005,
    providerShare: 0.5, providerAccount: 'provider:T', wasServed: () => true, at: 1,
  })
  assert.equal(ok.status, 'accrued')
  assert.ok(near(ok.requesterShareUsdc, 0.0025))
  assert.ok(near(ok.providerShareUsdc, 0.0025))
  assert.ok(near(led.balance('W'), 0.0025))
  assert.ok(near(led.balance('provider:T'), 0.0025))

  // A rejected attestation accrues nothing to the provider either.
  const bad = accrueSettlement(signAttestation(unsigned({ userWallet: 'W', billedCostUsd: 0 }), KEY), {
    publicKeyHex: KEY.publicKeyHex, ledger: led, pricePerImpressionUsdc: 0.005,
    providerShare: 0.5, providerAccount: 'provider:T', wasServed: () => true, at: 2,
  })
  assert.equal(bad.status, 'rejected')
  assert.ok(near(bad.providerShareUsdc, 0))
  assert.ok(near(led.balance('provider:T'), 0.0025), 'rejected attestation: provider cut unchanged')
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

test('accrueClick: splits the click gross with the provider account', () => {
  const led = new CreditLedger()
  const r = accrueClick({
    ledger: led, wallet: 'W', requestId: 'r1', placementId: 'p1',
    pricePerImpressionUsdc: 0.005, clickMultiplier: 50, requesterShare: 0.5,
    providerShare: 0.5, providerAccount: 'provider:T', at: 1,
  })
  assert.ok(near(r.grossUsdc, 0.25))
  assert.ok(near(r.creditedUsd, 0.125)) // requester half
  assert.ok(near(r.providerUsd, 0.125)) // provider half
  assert.ok(near(led.balance('W'), 0.125))
  assert.ok(near(led.balance('provider:T'), 0.125))
})

// --- advertiser onboarding -------------------------------------------------

test('buildCampaign: derives impressions from budget/bid and validates input', () => {
  const c = buildCampaign({ line: 'hi', endpointUrl: 'https://x', advertiserWallet: 'Ad', usdcPerImpression: 0.005, fundedUsdc: 5 }, 1)
  assert.equal(c.remainingImpressions, 1000) // 5 / 0.005
  assert.match(c.campaignId, /^cmp_/)
  assert.match(c.placementId, /^plc_/)
  assert.throws(() => buildCampaign({ line: 'x'.repeat(81), endpointUrl: 'u', advertiserWallet: 'a', usdcPerImpression: 0.005, fundedUsdc: 5 }, 1), /<= 80/)
  assert.throws(() => buildCampaign({ line: 'x', endpointUrl: '', advertiserWallet: 'a', usdcPerImpression: 0.005, fundedUsdc: 5 }, 1), /endpointUrl/)
  assert.throws(() => buildCampaign({ line: 'x', endpointUrl: 'u', advertiserWallet: 'a', usdcPerImpression: 0.0001, fundedUsdc: 5 }, 1), /floor/)
  assert.throws(() => buildCampaign({ line: 'x', endpointUrl: 'u', advertiserWallet: 'a', usdcPerImpression: 0.005, fundedUsdc: 0 }, 1), /fundedUsdc/)
})

test('GatewayTender: settle accrues a valid billed impression + sets the durable current ad', async () => {
  let t = 1000
  const gt = new GatewayTender({ campaigns: [campaign({ campaignId: 'c1' })], minWaitMs: 800, now: () => t })
  const p = gt.serve({ requestId: 'r1', surfaceId: 'gateway', userId: 'acct1' })
  assert.ok(p, 'serves a placement')

  t = 3000
  const res = await gt.settle({ userId: 'acct1', requestId: 'r1', model: 'm', billedCostUsd: 0.0001, measuredWaitMs: 1200, placement: p!, surfaceId: 'gateway' })
  assert.equal(res.valid, true)
  assert.ok(near(res.creditedUsd, 0.0025)) // 0.5 × 0.005
  assert.ok(near(await gt.balance('acct1'), 0.0025))
  assert.equal(await gt.currentLine('acct1'), p!.line, 'current ad set on the valid impression')

  // a $0 (unbilled) request is rejected by the gate — no farming impressions
  const p2 = gt.serve({ requestId: 'r2', surfaceId: 'gateway', userId: 'acct1' })
  const res2 = await gt.settle({ userId: 'acct1', requestId: 'r2', model: 'm', billedCostUsd: 0, measuredWaitMs: 1200, placement: p2!, surfaceId: 'gateway' })
  assert.equal(res2.valid, false)
  assert.ok(near(await gt.balance('acct1'), 0.0025), 'unbilled impression accrues nothing')

  // No provider account configured → provider balance stays zero.
  assert.ok(near(await gt.providerBalance(), 0), 'no provider account → no provider cut')
})

test('GatewayTender: a configured provider account accrues the platform cut', async () => {
  let t = 1000
  const gt = new GatewayTender({
    campaigns: [campaign({ campaignId: 'c1' })], minWaitMs: 800,
    providerShare: 0.5, providerAccount: 'provider:T', now: () => t,
  })
  const p = gt.serve({ requestId: 'r1', surfaceId: 'gateway', userId: 'acct1' })
  assert.ok(p)

  t = 3000
  const res = await gt.settle({ userId: 'acct1', requestId: 'r1', model: 'm', billedCostUsd: 0.0001, measuredWaitMs: 1200, placement: p!, surfaceId: 'gateway' })
  assert.equal(res.valid, true)
  assert.ok(near(res.creditedUsd, 0.0025)) // requester half
  assert.ok(near(res.providerUsd, 0.0025)) // provider half
  assert.ok(near(await gt.balance('acct1'), 0.0025))
  assert.ok(near(await gt.providerBalance(), 0.0025))

  // A $0 (rejected) request leaves the provider cut untouched — no farming.
  const p2 = gt.serve({ requestId: 'r2', surfaceId: 'gateway', userId: 'acct1' })
  await gt.settle({ userId: 'acct1', requestId: 'r2', model: 'm', billedCostUsd: 0, measuredWaitMs: 1200, placement: p2!, surfaceId: 'gateway' })
  assert.ok(near(await gt.providerBalance(), 0.0025), 'rejected impression: provider cut unchanged')
})

test('GatewayTender: rejects a misconfigured split at construction', () => {
  assert.throws(() => new GatewayTender({ requesterShare: 0.7, providerShare: 0.5 }), /<= 1/)
})

test('SupabaseCreditStore: accrue inserts, balance sums (aggregate), latestLine reads newest', async () => {
  const rows: Array<{ account: string; amount_usd: number; line: string; at: number }> = []
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    if (init?.method === 'POST') {
      for (const r of JSON.parse(String(init.body))) rows.push(r)
      return new Response(null, { status: 201 })
    }
    const acct = u.match(/account=eq\.([^&]+)/)?.[1]
    const mine = rows.filter((r) => r.account === acct)
    if (u.includes('amount_usd.sum()')) {
      return new Response(JSON.stringify([{ sum: mine.reduce((s, r) => s + r.amount_usd, 0) }]), { status: 200 })
    }
    // latestLine: order=at.desc&limit=1
    const newest = [...mine].sort((a, b) => b.at - a.at)[0]
    return new Response(JSON.stringify(newest ? [{ line: newest.line }] : []), { status: 200 })
  }) as unknown as typeof fetch

  const store = new SupabaseCreditStore({ url: 'https://x.supabase.co', key: 'svc', fetch: fetchImpl })
  await store.accrue({ account: 'a', amountUsd: 0.002, placementId: 'p1', line: 'old ad', requestId: 'r1', at: 1 })
  await store.accrue({ account: 'a', amountUsd: 0.003, placementId: 'p2', line: 'new ad', requestId: 'r2', at: 2 })
  await store.accrue({ account: 'b', amountUsd: 9, placementId: 'p9', line: 'other', requestId: 'r9', at: 1 })
  assert.ok(near(await store.balance('a'), 0.005))
  assert.equal(await store.latestLine('a'), 'new ad')
  assert.equal(await store.balance('zzz'), 0)
})

// --- automatic payout sweep -----------------------------------------------

test('MemoryCreditStore: balance is unswept; markSwept settles; unsweptByAccount lists work', async () => {
  const s = new MemoryCreditStore()
  await s.accrue({ account: 'u1', amountUsd: 0.003, placementId: 'p1', line: 'a', requestId: 'r1', at: 10 })
  await s.accrue({ account: 'u1', amountUsd: 0.002, placementId: 'p2', line: 'b', requestId: 'r2', at: 20 })
  await s.accrue({ account: 'provider:T', amountUsd: 0.005, placementId: 'p1', line: 'a', requestId: 'r3', at: 10 })
  assert.ok(near(await s.balance('u1'), 0.005))

  // A cutoff excludes credits accrued after it (the mid-sweep idempotency guard).
  const work15 = (await s.unsweptByAccount(15)).find((w) => w.account === 'u1')
  assert.ok(near(work15?.amountUsd ?? -1, 0.003))

  // Mark only u1's credits up to the cutoff → the at=20 credit survives.
  assert.ok(near(await s.markSwept('u1', 15), 0.003))
  assert.ok(near(await s.balance('u1'), 0.002))

  // Full work-list: u1's remaining 0.002 + the provider's 0.005.
  const work = await s.unsweptByAccount()
  assert.equal(work.length, 2)
  assert.ok(near(work.find((w) => w.account === 'provider:T')?.amountUsd ?? -1, 0.005))
})

test('sweepAll: report-only computes what is owed without paying or marking', async () => {
  const s = new MemoryCreditStore()
  await s.accrue({ account: 'u1', amountUsd: 0.01, placementId: 'p', line: 'a', requestId: 'r', at: 1 })
  const res = await sweepAll(s, { resolveDestination: () => 'WalletU1', now: () => 100 })
  assert.equal(res.length, 1)
  assert.equal(res[0].status, 'reported')
  assert.equal(res[0].signature, null)
  assert.equal(res[0].destination, 'WalletU1')
  assert.ok(near(await s.balance('u1'), 0.01), 'report-only leaves the balance unswept')
})

test('sweepAll: live rail pays + marks swept, and skips dust / walletless accounts', async () => {
  const s = new MemoryCreditStore()
  await s.accrue({ account: 'u1', amountUsd: 0.02, placementId: 'p', line: 'a', requestId: 'r', at: 1 })
  await s.accrue({ account: 'u2', amountUsd: 0.001, placementId: 'p', line: 'a', requestId: 'r', at: 1 }) // dust
  await s.accrue({ account: 'u3', amountUsd: 0.05, placementId: 'p', line: 'a', requestId: 'r', at: 1 }) // no wallet
  const calls: Array<{ destination: string; amountUsd: number }> = []
  const rail = { transfer: async (a: { destination: string; amountUsd: number }) => { calls.push(a); return { signature: `SIG-${a.destination}` } } }
  const wallets: Record<string, string | undefined> = { u1: 'WalletU1', u3: undefined }
  const res = await sweepAll(s, { rail, resolveDestination: (a) => wallets[a], minPayoutUsdc: 0.01, now: () => 100 })

  const by = Object.fromEntries(res.map((r) => [r.account, r]))
  assert.equal(by.u1.status, 'paid')
  assert.equal(by.u1.signature, 'SIG-WalletU1')
  assert.equal(by.u2.status, 'skipped') // below minimum
  assert.equal(by.u3.status, 'skipped') // no payout wallet
  assert.equal(calls.length, 1, 'only the qualifying account is paid on-chain')
  assert.ok(near(await s.balance('u1'), 0), 'paid account is marked swept')
  assert.ok(near(await s.balance('u3'), 0.05), 'unpaid account is left untouched')
  assert.ok(near(totalPaid(res), 0.02))
})

test('MemoryCreditStore: claimUnswept reserves ids; release rolls the reservation back', async () => {
  const s = new MemoryCreditStore()
  await s.accrue({ account: 'u1', amountUsd: 0.01, placementId: 'p', line: 'a', requestId: 'r1', at: 1 })
  await s.accrue({ account: 'u1', amountUsd: 0.02, placementId: 'p', line: 'a', requestId: 'r2', at: 2 })
  const claim = await s.claimUnswept('u1')
  assert.equal(claim.ids.length, 2)
  assert.ok(near(claim.amountUsd, 0.03))
  assert.ok(near(await s.balance('u1'), 0), 'claimed credits leave the payable balance')
  await s.release(claim.ids)
  assert.ok(near(await s.balance('u1'), 0.03), 'release restores them for retry')
})

test('sweepAll: a failed transfer rolls back the reservation (no double-pay; retryable)', async () => {
  const s = new MemoryCreditStore()
  await s.accrue({ account: 'u1', amountUsd: 0.02, placementId: 'p', line: 'a', requestId: 'r', at: 1 })
  const failing = { transfer: async () => { throw new Error('rpc down') } }
  const res = await sweepAll(s, { rail: failing, resolveDestination: () => 'W', now: () => 100 })
  assert.equal(res[0].status, 'failed')
  assert.match(res[0].reason ?? '', /rpc down/)
  assert.ok(near(await s.balance('u1'), 0.02), 'reservation rolled back — balance intact for retry')

  // Retry with a working rail settles it exactly once.
  const ok = await sweepAll(s, { rail: { transfer: async () => ({ signature: 'SIG' }) }, resolveDestination: () => 'W', now: () => 200 })
  assert.equal(ok[0].status, 'paid')
  assert.ok(near(await s.balance('u1'), 0))
})

test('sweepAll: records a successful payout to the log with the settled credit ids', async () => {
  const s = new MemoryCreditStore()
  await s.accrue({ account: 'u1', amountUsd: 0.02, placementId: 'p', line: 'a', requestId: 'r', at: 1 })
  const log = new MemoryPayoutLog()
  const res = await sweepAll(s, {
    rail: { transfer: async () => ({ signature: 'SIG1' }) },
    resolveDestination: () => 'W1', payoutLog: log, now: () => 100,
  })
  assert.equal(res[0].status, 'paid')
  const entries = await log.list()
  assert.equal(entries.length, 1)
  assert.equal(entries[0].signature, 'SIG1')
  assert.equal(entries[0].destination, 'W1')
  assert.ok(near(entries[0].amountUsd, 0.02))
  assert.equal(entries[0].creditIds.length, 1)
})

test('SupabaseCreditStore: claimUnswept returns ids; release un-sweeps exactly those', async () => {
  let seq = 0
  const rows: Array<{ id: number; account: string; amount_usd: number; at: number; swept: boolean }> = []
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    if (init?.method === 'POST') {
      for (const r of JSON.parse(String(init.body))) rows.push({ id: ++seq, ...r, swept: false })
      return new Response(null, { status: 201 })
    }
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body))
      if (body.swept === false) {
        const ids = new Set((u.match(/id=in\.\(([^)]+)\)/)?.[1] ?? '').split(',').map(Number))
        for (const r of rows) if (ids.has(r.id)) r.swept = false
        return new Response(null, { status: 200 })
      }
      const acct = decodeURIComponent(u.match(/account=eq\.([^&]+)/)?.[1] ?? '')
      const before = u.match(/at=lte\.(\d+)/)?.[1]
      const hit = rows.filter((r) => r.account === acct && !r.swept && (before == null || r.at <= Number(before)))
      for (const r of hit) r.swept = true
      return new Response(JSON.stringify(hit.map((r) => ({ id: r.id, amount_usd: r.amount_usd }))), { status: 200 })
    }
    const acct = decodeURIComponent(u.match(/account=eq\.([^&]+)/)?.[1] ?? '')
    const unswept = rows.filter((r) => !r.swept && r.account === acct)
    return new Response(JSON.stringify([{ sum: unswept.reduce((s, r) => s + r.amount_usd, 0) }]), { status: 200 })
  }) as unknown as typeof fetch

  const store = new SupabaseCreditStore({ url: 'https://x.supabase.co', key: 'svc', fetch: fetchImpl })
  await store.accrue({ account: 'provider:T', amountUsd: 0.004, placementId: 'p', line: 'a', requestId: 'r1', at: 1 })
  await store.accrue({ account: 'provider:T', amountUsd: 0.006, placementId: 'p', line: 'a', requestId: 'r2', at: 2 })
  const claim = await store.claimUnswept('provider:T')
  assert.equal(claim.ids.length, 2)
  assert.ok(near(claim.amountUsd, 0.01))
  assert.ok(near(await store.balance('provider:T'), 0), 'claimed rows leave the balance')
  await store.release(claim.ids)
  assert.ok(near(await store.balance('provider:T'), 0.01), 'release restores the balance')
})

test('reconcile: clean after a logged sweep; flags swept-but-unlogged credits', async () => {
  const s = new MemoryCreditStore()
  await s.accrue({ account: 'u1', amountUsd: 0.02, placementId: 'p', line: 'a', requestId: 'r', at: 1 })
  const log = new MemoryPayoutLog()

  // A proper sweep logs what it settles → nothing to reconcile.
  await sweepAll(s, { rail: { transfer: async () => ({ signature: 'SIG' }) }, resolveDestination: () => 'W', payoutLog: log, now: () => 100 })
  const clean = await reconcile(s, log)
  assert.equal(clean.ok, true)
  assert.equal(clean.unreconciledCount, 0)

  // Simulate a reserve-then-crash: credits claimed (swept) but never logged.
  await s.accrue({ account: 'u2', amountUsd: 0.03, placementId: 'p', line: 'a', requestId: 'r2', at: 2 })
  await s.claimUnswept('u2') // marks swept, no payout-log entry
  const report = await reconcile(s, log)
  assert.equal(report.ok, false)
  assert.equal(report.unreconciledCount, 1)
  assert.ok(near(report.unreconciledUsd, 0.03))
  assert.equal(report.items[0].account, 'u2')
})

test('SupabasePayoutLog: record inserts; list reads newest-first', async () => {
  const rows: Array<{ account: string; destination: string; amount_usd: number; signature: string; credit_ids: number[]; at: number }> = []
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      for (const r of JSON.parse(String(init.body))) rows.push(r)
      return new Response(null, { status: 201 })
    }
    return new Response(JSON.stringify([...rows].sort((a, b) => b.at - a.at)), { status: 200 })
  }) as unknown as typeof fetch
  const log = new SupabasePayoutLog({ url: 'https://x.supabase.co', key: 'svc', fetch: fetchImpl })
  await log.record({ account: 'u1', destination: 'W1', amountUsd: 0.02, signature: 'SIG1', creditIds: [1, 2], at: 10 })
  await log.record({ account: 'u2', destination: 'W2', amountUsd: 0.05, signature: 'SIG2', creditIds: [3], at: 20 })
  const list = await log.list()
  assert.equal(list.length, 2)
  assert.equal(list[0].signature, 'SIG2') // newest first
  assert.deepEqual(list[1].creditIds, [1, 2])
})

test('SupabaseCreditStore: markSwept settles rows; unsweptByAccount groups the work-list', async () => {
  const rows: Array<{ account: string; amount_usd: number; at: number; swept: boolean }> = []
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    const rawAcct = u.match(/account=eq\.([^&]+)/)?.[1]
    const acct = rawAcct != null ? decodeURIComponent(rawAcct) : undefined
    if (init?.method === 'POST') {
      for (const r of JSON.parse(String(init.body))) rows.push({ ...r, swept: false })
      return new Response(null, { status: 201 })
    }
    if (init?.method === 'PATCH') {
      const before = u.match(/at=lte\.(\d+)/)?.[1]
      const hit = rows.filter((r) => r.account === acct && !r.swept && (before == null || r.at <= Number(before)))
      for (const r of hit) r.swept = true
      return new Response(JSON.stringify(hit.map((r) => ({ amount_usd: r.amount_usd }))), { status: 200 })
    }
    // GET: balance (account filter + sum) or grouped work-list (account + sum, no filter)
    const unswept = rows.filter((r) => !r.swept && (acct == null || r.account === acct))
    if (u.includes('select=account,amount_usd.sum()')) {
      const sums = new Map<string, number>()
      for (const r of unswept) sums.set(r.account, (sums.get(r.account) ?? 0) + r.amount_usd)
      return new Response(JSON.stringify([...sums].map(([account, sum]) => ({ account, sum }))), { status: 200 })
    }
    return new Response(JSON.stringify([{ sum: unswept.reduce((s, r) => s + r.amount_usd, 0) }]), { status: 200 })
  }) as unknown as typeof fetch

  const store = new SupabaseCreditStore({ url: 'https://x.supabase.co', key: 'svc', fetch: fetchImpl })
  await store.accrue({ account: 'u1', amountUsd: 0.003, placementId: 'p1', line: 'a', requestId: 'r1', at: 1 })
  await store.accrue({ account: 'u1', amountUsd: 0.002, placementId: 'p2', line: 'b', requestId: 'r2', at: 2 })
  await store.accrue({ account: 'provider:T', amountUsd: 0.005, placementId: 'p3', line: 'c', requestId: 'r3', at: 1 })
  assert.ok(near(await store.balance('u1'), 0.005))

  const work = await store.unsweptByAccount()
  assert.equal(work.length, 2)
  assert.ok(near(work.find((w) => w.account === 'u1')?.amountUsd ?? -1, 0.005))

  assert.ok(near(await store.markSwept('u1'), 0.005), 'markSwept returns the settled amount')
  assert.ok(near(await store.balance('u1'), 0), 'settled rows drop out of the balance')
  assert.ok(near(await store.balance('provider:T'), 0.005), 'other accounts untouched')
})

test('MemoryCampaignStore + Auction: a created campaign serves and can win the slot', async () => {
  const store = new MemoryCampaignStore()
  const c = buildCampaign({ line: 'top bid', endpointUrl: 'https://x', advertiserWallet: 'Ad', usdcPerImpression: 0.01, fundedUsdc: 1 }, 1)
  await store.create(c)
  assert.equal((await store.list()).length, 1)
  assert.equal((await store.get(c.campaignId))?.line, 'top bid')
  const a = new Auction(await store.list())
  assert.equal(a.select(ctx())?.placementId, c.placementId)
})

test('advertiser funding: a pending campaign does not serve until marked active', async () => {
  const store = new MemoryCampaignStore()
  const ref = newPaymentReference()
  const c = buildCampaign(
    { line: 'pay me first', endpointUrl: 'https://x', advertiserWallet: 'Ad', usdcPerImpression: 0.01, fundedUsdc: 1, status: 'pending', paymentReference: ref },
    1,
  )
  await store.create(c)
  assert.equal(c.status, 'pending')
  assert.equal(c.paymentReference, ref)
  assert.equal(isCampaignActive(c), false)

  // Only active campaigns are folded into the auction (mirrors ensureCampaigns).
  const live = (await store.list()).filter(isCampaignActive)
  assert.equal(live.length, 0)
  assert.equal(new Auction(live).select(ctx()), null)

  // Confirm the deposit → flip to active → it now serves.
  const updated = await store.update(c.campaignId, { status: 'active', paidSignature: 'sig123' })
  assert.equal(updated?.status, 'active')
  assert.equal(updated?.paidSignature, 'sig123')
  assert.equal(isCampaignActive(updated!), true)
  const a = new Auction((await store.list()).filter(isCampaignActive))
  assert.equal(a.select(ctx())?.placementId, c.placementId)
})

test('buildCampaign: defaults to active (back-compat) when no status given', () => {
  const c = buildCampaign({ line: 'hi', endpointUrl: 'https://x', advertiserWallet: 'Ad', usdcPerImpression: 0.005, fundedUsdc: 5 }, 1)
  assert.equal(c.status, 'active')
  assert.equal(isCampaignActive(c), true)
})

test('tenderDepositConfig: reads treasury + network from env, undefined without treasury', () => {
  assert.equal(tenderDepositConfig({}), undefined)
  const cfg = tenderDepositConfig({ TENDER_TREASURY_WALLET: 'Trez111', SHIPYARD_SETTLE_NETWORK: 'mainnet' })
  assert.equal(cfg?.treasury, 'Trez111')
  assert.equal(cfg?.network, 'mainnet')
  // defaults to devnet when network unset
  assert.equal(tenderDepositConfig({ TENDER_TREASURY_WALLET: 'T' })?.network, 'devnet')
})

test('newPaymentReference: unique base58 32-byte references', () => {
  const a = newPaymentReference()
  const b = newPaymentReference()
  assert.notEqual(a, b)
  assert.match(a, /^[1-9A-HJ-NP-Za-km-z]+$/) // base58 alphabet
})

test('buildDepositIntent: encodes a valid Solana Pay URL (amount + spl-token + reference)', () => {
  const cfg = { treasury: 'Trez111', network: 'devnet' as const }
  const intent = buildDepositIntent(cfg, { amountUsdc: 5, reference: 'Ref222', label: 'Shipyard Tender', message: 'Fund campaign cmp_x' })
  assert.equal(intent.amountUsdc, 5)
  assert.equal(intent.reference, 'Ref222')
  assert.equal(intent.network, 'devnet')
  // devnet USDC mint
  assert.equal(intent.usdcMint, '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
  assert.ok(intent.url.startsWith('solana:Trez111?'))
  const q = new URLSearchParams(intent.url.split('?')[1])
  assert.equal(q.get('amount'), '5')
  assert.equal(q.get('spl-token'), '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
  assert.equal(q.get('reference'), 'Ref222')
  assert.equal(q.get('label'), 'Shipyard Tender')
})
