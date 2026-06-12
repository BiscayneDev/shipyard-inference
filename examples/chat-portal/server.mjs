// shipyard-inference chat portal — a Claude-like web UI in front of the Router.
//
//   npm run build                       # the portal imports the built SDK from ./dist
//   node examples/chat-portal/server.mjs
//   → open http://localhost:8788
//
// Inference is paid THROUGH Shipyard from a wallet — there is no provider API
// key here. Three modes, auto-detected from env:
//
//   • demo   (default)   built-in mock model — runs with zero config / zero keys
//   • usepod USEPOD_TOKEN → prepaid USDC balance proxy (createUsePodProvider)
//   • x402   SHIPYARD_X402_URL + a wallet → per-request USDC (createWalletInference)
//
// Pick a model (or "Auto — cheapest capable"), chat with streaming, and watch
// live per-message cost / baseline / savings, all metered + settled from the
// connected wallet.
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serve } from '@hono/node-server'
import {
  Router,
  costOptimized,
  createUsePodProvider,
  createWalletInference,
  createTelemetryReporter,
  payboxSigner,
  payboxSettle,
  registerUsePod,
  depositUsdcWithSigner,
  buildUsePodDepositTx,
  submitSolanaTransaction,
  usePodBalance,
  observeWaitWindow,
  Auction,
  AuctionLog,
  CreditLedger,
  loadAttestationKey,
  signAttestation,
  accrueSettlement,
  accrueClick,
} from 'shipyard-inference'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 8788)
const MARGIN = Number(process.env.PORTAL_MARGIN_PCT ?? 15) / 100
const DEMO_BALANCE = Number(process.env.PORTAL_DEMO_BALANCE_USD ?? 5)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Mode A — demo: a built-in mock LLMProvider so the portal runs with no keys
// and no network. Streams a canned reply and reports realistic token usage so
// the Router can price it (and the savings panel has real numbers to show).
// ---------------------------------------------------------------------------
const estTokens = (s) => Math.max(1, Math.ceil((s || '').length / 4))

function mockReply(params) {
  const last = [...params.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  return (
    `You're talking to the Shipyard demo model — a built-in stub, so no real ` +
    `provider was billed. In a live deployment this request would be paid from ` +
    `your connected wallet (UsePod balance or x402 USDC), routed to the cheapest ` +
    `capable model, and metered to the token.\n\n` +
    `You said: "${last.slice(0, 280)}"\n\n` +
    `Notice the chips under this reply: which model ran, the token count, what it ` +
    `cost, and what you saved versus calling the baseline model direct.`
  )
}

function mockProvider() {
  const usageFor = (params, text) => ({
    inputTokens: params.messages.reduce((n, m) => n + estTokens(m.content), 0) + estTokens(params.system),
    outputTokens: estTokens(text),
  })
  return {
    async chat(params) {
      const content = mockReply(params)
      return { content, toolCalls: [], stopReason: 'end_turn', usage: usageFor(params, content) }
    },
    async *chatStream(params) {
      const content = mockReply(params)
      for (const tok of content.match(/\s+|\S+/g) ?? []) {
        yield { type: 'text_delta', text: tok }
        await sleep(12)
      }
      yield { type: 'done', response: { content, toolCalls: [], stopReason: 'end_turn', usage: usageFor(params, content) } }
    },
  }
}

// ---------------------------------------------------------------------------
// Resolve the inference backend. Each mode yields routable candidates with
// pricing metadata (what `costOptimized` ranks on and the savings baseline is
// priced against) — but never a raw provider key. Wallet-funded, end to end.
// ---------------------------------------------------------------------------
async function buildProductionInference() {
  // Mode — Paybox x402 (advanced): pay for inference *per request* over x402,
  // from a non-custodial Paybox wallet, against a true x402 inference endpoint.
  // This is the ONLY mode that needs an x402 endpoint — most setups don't. The
  // far simpler real path is UsePod inference + Paybox *settlement* (below), which
  // is how Dock runs and needs no endpoint at all. Only entered when an endpoint
  // is actually configured; otherwise Paybox is used purely for settlement.
  const x402Url = process.env.SHIPYARD_X402_URL ?? process.env.USEPOD_X402_URL
  if (x402Url && process.env.PAYBOX_CREDENTIAL_ID) {
    const baseURL = x402Url
    const network = process.env.SHIPYARD_SETTLE_NETWORK === 'devnet' ? 'devnet' : 'mainnet'
    const family = process.env.SHIPYARD_X402_FAMILY === 'openai' ? 'openai' : 'anthropic'
    const models = [
      { model: 'claude-haiku-4-5', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 200000, tier: 'economy', capabilities: ['tools'] },
      { model: 'claude-sonnet-4-5', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200000, tier: 'standard', capabilities: ['tools'] },
    ]
    const signer = await payboxSigner({ credentialId: process.env.PAYBOX_CREDENTIAL_ID, network })
    const wi = await createWalletInference({ signer, baseURL, network, family, models })
    return {
      mode: 'paybox',
      candidates: [{ id: 'paybox', provider: wi.provider, models }],
      baselineModel: 'claude-sonnet-4-5',
      payer: signer.publicKey,
      network,
      close: wi.close,
    }
  }

  // Mode — Paybox-funded UsePod: a funded, non-custodial Paybox wallet provisions
  // a UsePod token and tops it up on-chain (depositUsdcWithSigner — no raw key,
  // no x402 endpoint). Inference then runs off that prepaid USDC balance. This is
  // the "a funded Paybox account powers the UsePod side" path. Opt in with
  // PAYBOX_FUND_USEPOD=1. UsePod's deposit program is mainnet — real USDC.
  if (process.env.PAYBOX_CREDENTIAL_ID && process.env.PAYBOX_FUND_USEPOD && !process.env.USEPOD_TOKEN) {
    const network = process.env.SHIPYARD_SETTLE_NETWORK === 'devnet' ? 'devnet' : 'mainnet'
    const signer = await payboxSigner({ credentialId: process.env.PAYBOX_CREDENTIAL_ID, network })
    const account = await registerUsePod() // { token, depositCode } — funds via Paybox on Top up
    const models = [
      { model: 'claude-haiku-4-5', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 200000, tier: 'economy', capabilities: ['tools'] },
      { model: 'claude-sonnet-4-5', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200000, tier: 'standard', capabilities: ['tools'] },
    ]
    const provider = createUsePodProvider({ token: account.token, family: 'anthropic' })
    return {
      mode: 'usepod',
      candidates: [{ id: 'usepod', provider, models }],
      baselineModel: 'claude-sonnet-4-5',
      payer: signer.publicKey,
      network,
      // Funding handle: Top up deposits real USDC from Paybox → this UsePod token.
      funding: { signer, token: account.token, depositCode: account.depositCode, network },
      close: async () => {},
    }
  }

  // Mode B — usepod: a prepaid USDC token-balance proxy. No API key — auth is
  // the funded token in the URL; UsePod's marketplace routes to the cheapest
  // provider, and `maxPrice*` caps per-request spend.
  if (process.env.USEPOD_TOKEN) {
    const models = [
      { model: 'claude-haiku-4-5', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 200000, tier: 'economy', capabilities: ['tools'] },
      { model: 'claude-sonnet-4-5', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200000, tier: 'standard', capabilities: ['tools'] },
    ]
    const provider = createUsePodProvider({ token: process.env.USEPOD_TOKEN, family: 'anthropic' })
    return {
      mode: 'usepod',
      candidates: [{ id: 'usepod', provider, models }],
      baselineModel: 'claude-sonnet-4-5',
      close: async () => {},
    }
  }

  // No production backend configured (no x402 endpoint, no Paybox-funded UsePod,
  // no USEPOD_TOKEN). The portal still runs — Demo mode is always available.
  return null
}

// Mode A — demo: a built-in mock provider, two tiers so routing + savings have
// something to show. Recognizably a stub; bills nothing. ALWAYS available, so the
// portal can offer a Demo ⇄ Production toggle (default Demo — no real spend until
// you flip).
function buildDemoInference() {
  const models = [
    { model: 'shipyard-economy', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 128000, tier: 'economy', capabilities: ['tools'] },
    { model: 'shipyard-standard', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200000, tier: 'standard', capabilities: ['tools'] },
  ]
  const provider = mockProvider()
  return {
    mode: 'demo',
    candidates: [{ id: 'demo', provider, models }],
    baselineModel: 'shipyard-standard',
    close: async () => {},
  }
}

// Build BOTH inference backends so the portal can switch at runtime: a mock demo
// backend (always) and the real production backend (when env configures one). The
// UI toggles per request; default is Demo — no real spend until you flip. The
// `inference` alias is the production backing for funding/settlement/network.
const prodInference = await buildProductionInference()
const demoInference = buildDemoInference()
const productionAvailable = Boolean(prodInference)
const inference = prodInference ?? demoInference

// Per-request telemetry capture (model/provider/cost/savings) without a global
// race — mirrors the gateway's AsyncLocalStorage approach.
const als = new AsyncLocalStorage()

// Optional: report every request to a Shipyard Operator command center. Set
// OPERATOR_URL (+ OPERATOR_TOKEN) and this portal shows up as a `chat-portal`
// source in the operator dashboard — the one-line drop-in any integration uses.
const reporter = process.env.OPERATOR_URL
  ? createTelemetryReporter({
      url: process.env.OPERATOR_URL,
      token: process.env.OPERATOR_TOKEN,
      source: process.env.OPERATOR_SOURCE ?? 'chat-portal',
    })
  : undefined

// Telemetry capture shared by the default router and any per-session router.
function routerOnEvent(event) {
  reporter?.onEvent(event)
  const ctx = als.getStore()
  if (!ctx) return
  if (event.type === 'route_selected' || event.type === 'route_success') {
    ctx.provider = event.candidateId
    if (event.model) ctx.model = event.model
  } else if (event.type === 'request_completed') {
    ctx.provider = event.candidateId
    if (event.model) ctx.model = event.model
    ctx.actualCostUsd = event.actualCostUsd
    ctx.baselineCostUsd = event.baselineCostUsd
    ctx.savedUsd = event.savedUsd
    ctx.usage = event.usage
  }
}

// One self-contained runtime per backend: its router, the catalog the picker
// renders, pricing for the savings baseline, and the model→candidate pin map.
function buildRuntime(inf) {
  const baselineModel = process.env.PORTAL_BASELINE_MODEL ?? inf.baselineModel
  const modelToCandidate = new Map()
  for (const c of inf.candidates) for (const m of c.models ?? []) modelToCandidate.set(m.model, c.id)
  const modelCatalog = [
    { id: 'auto', label: 'Auto — cheapest capable', provider: 'shipyard', tier: 'auto' },
    ...inf.candidates.flatMap((c) =>
      (c.models ?? []).map((m) => ({
        id: m.model,
        label: m.model,
        provider: c.id,
        tier: m.tier,
        inputCostPerMTok: m.inputCostPerMTok,
        outputCostPerMTok: m.outputCostPerMTok,
      })),
    ),
  ]
  const pricingOverrides = Object.fromEntries(
    inf.candidates.flatMap((c) => (c.models ?? []).map((m) => [m.model, m])),
  )
  const router = new Router({
    candidates: inf.candidates,
    strategy: costOptimized(),
    baselineModel,
    pricingOverrides,
    onEvent: routerOnEvent,
  })
  return { mode: inf.mode, baselineModel, modelToCandidate, modelCatalog, router }
}

const demoRT = buildRuntime(demoInference)
const prodRT = prodInference ? buildRuntime(prodInference) : null
// Map the UI toggle ('demo' | 'production') to a runtime; default Demo.
const runtimeFor = (m) => (m === 'production' && prodRT ? prodRT : demoRT)

// Catalog of models a per-session UsePod token serves (bring-your-own-wallet).
const USEPOD_SESSION_MODELS = [
  { model: 'claude-haiku-4-5', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 200000, tier: 'economy', capabilities: ['tools'] },
  { model: 'claude-sonnet-4-5', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200000, tier: 'standard', capabilities: ['tools'] },
]

// A Router bound to one user's own UsePod token — inference is paid from the
// balance THAT user funds from THEIR connected wallet (Phantom). Bring-your-own.
function buildSessionRouter(token) {
  const provider = createUsePodProvider({ token, family: 'anthropic' })
  return new Router({
    candidates: [{ id: 'usepod', provider, models: USEPOD_SESSION_MODELS }],
    strategy: costOptimized(),
    baselineModel: 'claude-sonnet-4-5',
    pricingOverrides: Object.fromEntries(USEPOD_SESSION_MODELS.map((m) => [m.model, m])),
    onEvent: routerOnEvent,
  })
}

// ---------------------------------------------------------------------------
// Wallet sessions. The connected wallet is the funding source — in demo mode an
// in-memory USDC balance, in usepod/x402 mode the local mirror of real spend.
// Either way it meters spend as `pendingUsd` and only moves the balance on
// settle — the meter-then-settle shape Shipyard uses for real Paybox USDC.
// ---------------------------------------------------------------------------
const sessions = new Map()

// Address shaped to the chosen wallet: MetaMask is EVM (0x-hex), Paybox and
// Phantom are Solana (base58). Demo sessions mint a throwaway one.
function newAddress(wallet) {
  if (wallet === 'metamask') {
    return '0x' + randomBytes(20).toString('hex')
  }
  const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let s = ''
  for (const byte of randomBytes(32)) s += b58[byte % b58.length]
  return s.slice(0, 44)
}

const round6 = (n) => Math.round((n + Number.EPSILON) * 1e6) / 1e6

// Settlement runs on the same Solana cluster as the Paybox inference wallet
// (mainnet in paybox mode), else honours SHIPYARD_SETTLE_NETWORK (devnet-safe).
const SETTLE_NETWORK =
  inference.network ?? (process.env.SHIPYARD_SETTLE_NETWORK === 'mainnet' ? 'mainnet' : 'devnet')

// Real meter-then-settle (Dock's proven path): when a treasury + Paybox wallet
// are configured, /api/settle moves the metered USDC on-chain from the Paybox
// wallet to the treasury via payboxSettle(). Signing is in-process and hands-off
// when a `pbxk1` signing key is configured (PAYBOX_SIGNING_KEY / `paybox login`).
// Without a treasury we fall back to a simulated receipt (demo).
const TREASURY = process.env.SHIPYARD_TREASURY_WALLET
let settlementSigner
if (TREASURY && process.env.PAYBOX_CREDENTIAL_ID) {
  settlementSigner = await payboxSigner({
    credentialId: process.env.PAYBOX_CREDENTIAL_ID,
    network: SETTLE_NETWORK,
  })
  console.log(`  settle:    REAL · ${settlementSigner.publicKey} → ${TREASURY} (${SETTLE_NETWORK})`)
}

// A base58 string shaped like a Solana tx signature (~88 chars). In x402 mode a
// real settlement returns the on-chain signature; in demo/usepod we mint a
// realistic stand-in so the receipt UI has a tx hash + explorer link to show.
function mockSignature() {
  const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let s = ''
  for (const byte of randomBytes(64)) s += b58[byte % b58.length]
  return s.slice(0, 88)
}

const explorerUrl = (sig, network) =>
  `https://explorer.solana.com/tx/${sig}${network === 'mainnet' ? '' : `?cluster=${network}`}`

function walletSnapshot(session) {
  return {
    sessionId: session.id,
    address: session.address,
    wallet: session.wallet,
    mode: session.mode,
    balanceUsd: round6(session.balanceUsd),
    pendingUsd: round6(session.pendingUsd),
    spentUsd: round6(session.spentUsd),
    savedUsd: round6(session.savedUsd),
    // Tender idle-attention credit accrued to this wallet, and what's actually
    // owed after netting it against the inference bill.
    tenderCreditUsd: round6(creditLedger.balance(session.address)),
    netOwedUsd: round6(Math.max(0, session.pendingUsd - creditLedger.balance(session.address))),
    messages: session.messages,
    settlements: session.settlements.length,
    realInference: !!session.realInference,
    usepodToken: session.usepod ? `${session.usepod.token.slice(0, 6)}…` : undefined,
  }
}

// ---------------------------------------------------------------------------
const app = new Hono()
app.use('/api/*', cors())

app.get('/api/models', (c) => {
  // The picker + savings baseline are per inference mode (?mode=demo|production).
  const wantProd = c.req.query('mode') === 'production' && prodRT
  const rt = wantProd ? prodRT : demoRT
  return c.json({
    models: rt.modelCatalog,
    baselineModel: rt.baselineModel,
    inferenceMode: wantProd ? 'production' : 'demo', // the toggle state served
    backend: rt.mode, // demo | usepod | paybox — what actually serves
    productionAvailable,
    network: inference.network,
    payer: inference.payer,
  })
})

app.post('/api/wallet/connect', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  let session = body.sessionId ? sessions.get(body.sessionId) : undefined
  if (!session) {
    const id = randomBytes(12).toString('hex')
    const wallet = ['paybox', 'phantom', 'metamask'].includes(body.wallet) ? body.wallet : 'paybox'
    // A real non-custodial wallet hands us its actual on-chain address.
    const realAddress = typeof body.address === 'string' && body.address.length >= 32 ? body.address : null
    session = {
      id,
      address: realAddress ?? newAddress(wallet),
      wallet,
      mode: inference.mode,
      balanceUsd: DEMO_BALANCE,
      pendingUsd: 0,
      spentUsd: 0,
      savedUsd: 0,
      messages: 0,
      settlements: [],
      realInference: false,
    }

    // Bring-your-own wallet (Phantom): provision THIS user a UsePod token they
    // fund from their own wallet. Inference for the session routes through it,
    // and the balance is the real remaining UsePod balance (0 until Top up).
    if (wallet === 'phantom' && realAddress) {
      try {
        const account = await registerUsePod()
        session.usepod = { token: account.token, depositCode: account.depositCode, router: buildSessionRouter(account.token) }
        session.mode = 'usepod'
        session.realInference = true
        session.balanceUsd = (await usePodBalance(account.token).catch(() => ({ usdc: 0 }))).usdc
      } catch (err) {
        // UsePod unreachable — connect anyway (UI works), but inference stays mock.
        console.warn('phantom connect: UsePod provisioning failed —', err?.message ?? err)
      }
    } else if (inference.funding) {
      // Operator Paybox-funded UsePod: balance is the real remaining balance.
      try {
        session.balanceUsd = (await usePodBalance(inference.funding.token)).usdc
        session.realInference = true
      } catch { /* keep demo balance if the balance API is unreachable */ }
    }
    sessions.set(id, session)
  }
  return c.json(walletSnapshot(session))
})

app.get('/api/wallet/:sessionId', (c) => {
  const session = sessions.get(c.req.param('sessionId'))
  if (!session) return c.json({ error: 'unknown session' }, 404)
  return c.json(walletSnapshot(session))
})

app.post('/api/settle', async (c) => {
  const { sessionId } = await c.req.json().catch(() => ({}))
  const session = sessions.get(sessionId)
  if (!session) return c.json({ error: 'unknown session' }, 404)

  // Net the idle-attention credit against the inference bill — the user settles
  // only what's left after Tender revenue. If credit covers it, nothing moves
  // on-chain (the "never top up your agent" effect).
  const pending = session.pendingUsd
  const creditApplied = Math.min(pending, creditLedger.balance(session.address))
  const amount = round6(Math.max(0, pending - creditApplied))
  if (amount <= 0) {
    if (creditApplied > 0) creditLedger.consume(session.address, creditApplied)
    session.pendingUsd = 0
    return c.json({ settled: 0, creditApplied: round6(creditApplied), wallet: walletSnapshot(session) })
  }

  // Real meter-then-settle (Dock's proven path): move the metered USDC on-chain
  // from the Paybox wallet to the treasury. Only on success do we clear pending
  // and debit the balance — a settle failure leaves spend pending (never
  // double-charges; it retries next turn). Without a treasury we simulate it.
  let signature
  let simulated
  if (settlementSigner) {
    const atomicUsdc = String(Math.round(amount * 1_000_000)) // USDC has 6 decimals
    try {
      const res = await payboxSettle({
        signer: settlementSigner,
        treasury: TREASURY,
        amount: atomicUsdc,
        network: SETTLE_NETWORK,
        rpcUrl: process.env.SHIPYARD_SETTLE_RPC_URL,
        usdcMint: process.env.SHIPYARD_SETTLE_USDC_MINT,
      })
      signature = res.signature
      simulated = false
    } catch (err) {
      // Leave pendingUsd intact — the next /api/settle retries this amount.
      return c.json(
        { error: `settlement failed: ${err instanceof Error ? err.message : String(err)}`, wallet: walletSnapshot(session) },
        502,
      )
    }
  } else {
    signature = mockSignature()
    simulated = true
  }

  if (creditApplied > 0) creditLedger.consume(session.address, creditApplied)
  session.balanceUsd = Math.max(0, session.balanceUsd - amount)
  session.spentUsd += amount
  session.pendingUsd = 0
  session.settlements.push({ amountUsd: amount, at: new Date().toISOString(), mode: session.mode, signature })

  // Report the settlement to the operator command center (real USDC collected).
  reporter?.recordSettlement({
    userId: session.id,
    amountUsd: amount,
    status: 'settled',
    network: SETTLE_NETWORK,
  })

  // The receipt: a USDC micropayment on Solana. In x402 mode `signature` is the
  // real on-chain tx; in demo/usepod it's a realistic stand-in (`simulated`).
  return c.json({
    settled: amount,
    signature,
    network: SETTLE_NETWORK,
    explorerUrl: explorerUrl(signature, SETTLE_NETWORK),
    simulated,
    wallet: walletSnapshot(session),
  })
})

// Top up the inference balance. In Paybox-funded UsePod mode this is a REAL
// on-chain deposit: depositUsdcWithSigner moves USDC from the Paybox wallet into
// the UsePod token, then we read the live balance back. Otherwise (demo) it just
// credits the in-memory balance.
app.post('/api/wallet/topup', async (c) => {
  const { sessionId, amountUsd } = await c.req.json().catch(() => ({}))
  const session = sessions.get(sessionId)
  if (!session) return c.json({ error: 'unknown session' }, 404)
  const amount = round6(Math.max(0, Math.min(Number(amountUsd) || 0, 1000)))
  if (amount <= 0) return c.json({ error: 'amount must be > 0' }, 400)

  if (inference.funding) {
    try {
      const signature = await depositUsdcWithSigner({
        signer: inference.funding.signer,
        depositCode: inference.funding.depositCode,
        amountUsdc: amount,
        network: inference.funding.network,
        rpcUrl: process.env.USEPOD_RPC_URL,
        usdcMint: process.env.USEPOD_USDC_MINT,
      })
      session.balanceUsd = (await usePodBalance(inference.funding.token)).usdc
      return c.json({
        deposited: amount,
        signature,
        explorerUrl: explorerUrl(signature, inference.funding.network),
        wallet: walletSnapshot(session),
      })
    } catch (err) {
      return c.json({ error: `deposit failed: ${err instanceof Error ? err.message : String(err)}`, wallet: walletSnapshot(session) }, 502)
    }
  }

  session.balanceUsd += amount
  return c.json({ deposited: amount, wallet: walletSnapshot(session) })
})

// Bring-your-own-wallet funding (Phantom). Two steps so the user's wallet signs
// in the browser, with the key never leaving it:
//   1) /deposit/build — server builds the UNSIGNED UsePod-deposit tx for the
//      session's wallet (Anchor IDL → correct accounts), returns base64.
//   2) browser signs it with Phantom and posts it back…
//   3) /deposit/submit — server broadcasts + confirms, then reads the live balance.
const usepodNetwork = () => (process.env.SHIPYARD_SETTLE_NETWORK === 'devnet' ? 'devnet' : 'mainnet')

app.post('/api/wallet/deposit/build', async (c) => {
  const { sessionId, amountUsd } = await c.req.json().catch(() => ({}))
  const session = sessions.get(sessionId)
  if (!session) return c.json({ error: 'unknown session' }, 404)
  if (!session.usepod) return c.json({ error: 'session has no UsePod token to fund' }, 400)
  const amount = round6(Math.max(0, Math.min(Number(amountUsd) || 0, 1000)))
  if (amount <= 0) return c.json({ error: 'amount must be > 0' }, 400)
  try {
    const built = await buildUsePodDepositTx({
      payer: session.address,
      depositCode: session.usepod.depositCode,
      amountUsdc: amount,
      network: usepodNetwork(),
      rpcUrl: process.env.USEPOD_RPC_URL,
      usdcMint: process.env.USEPOD_USDC_MINT,
    })
    return c.json({ transactionBase64: built.transactionBase64, amountUsd: amount })
  } catch (err) {
    return c.json({ error: `build failed: ${err instanceof Error ? err.message : String(err)}` }, 502)
  }
})

app.post('/api/wallet/deposit/submit', async (c) => {
  const { sessionId, signedTransactionBase64 } = await c.req.json().catch(() => ({}))
  const session = sessions.get(sessionId)
  if (!session) return c.json({ error: 'unknown session' }, 404)
  if (!session.usepod) return c.json({ error: 'session has no UsePod token to fund' }, 400)
  if (!signedTransactionBase64) return c.json({ error: 'signedTransactionBase64 is required' }, 400)
  const network = usepodNetwork()
  try {
    const signature = await submitSolanaTransaction({
      signedTransactionBase64,
      network,
      rpcUrl: process.env.USEPOD_RPC_URL,
    })
    // Let UsePod credit the deposit, then reflect the real balance.
    session.balanceUsd = (await usePodBalance(session.usepod.token).catch(() => ({ usdc: session.balanceUsd }))).usdc
    return c.json({
      signature,
      explorerUrl: explorerUrl(signature, network),
      wallet: walletSnapshot(session),
    })
  } catch (err) {
    return c.json({ error: `submit failed: ${err instanceof Error ? err.message : String(err)}`, wallet: walletSnapshot(session) }, 502)
  }
})

// ── Tender — idle-attention placements on the request wait state ─────────────
// Seeded campaigns (config-first; no self-serve dashboard in v1). Each line is a
// marketplace x402 listing; a "click" = the agent actually calling endpointUrl.
const tenderAuction = new Auction([
  {
    campaignId: 'demo-vercel',
    placementId: 'vercel-deploy',
    advertiserWallet: 'TenderAdVerce1111111111111111111111111111111',
    endpointUrl: 'https://api.shipyard.market/x402/vercel-deploy',
    line: '🛰️  Ship this to prod — one-call Vercel deploy on Shipyard Market',
    usdcPerImpression: 0.005,
    remainingImpressions: 1000,
    fundedUsdc: 5,
    targeting: {},
  },
  {
    campaignId: 'demo-embed',
    placementId: 'nomic-embed',
    advertiserWallet: 'TenderAdEmbed22222222222222222222222222222222',
    endpointUrl: 'https://api.shipyard.market/x402/nomic-embed',
    line: '⚡  Add semantic search — Nomic embeddings, pay-per-call USDC',
    usdcPerImpression: 0.002,
    remainingImpressions: 1000,
    fundedUsdc: 2,
    targeting: {},
  },
])
const TENDER_MIN_WAIT_MS = Number(process.env.TENDER_MIN_WAIT_MS ?? 800)
// The gateway's dedicated attestation key + the auction log the release gate
// cross-checks. Set TENDER_SIGNING_KEY (32-byte hex) for a stable, verifiable key.
const tenderKey = loadAttestationKey()
const auctionLog = new AuctionLog()
// The credit ledger Tender writes into — idle-attention revenue, netted against
// each wallet's inference bill. REQUESTER_SHARE of the impression price accrues.
const creditLedger = new CreditLedger()
const REQUESTER_SHARE = Number(process.env.TENDER_REQUESTER_SHARE ?? 0.5)
const CLICK_MULTIPLIER = Number(process.env.TENDER_CLICK_MULTIPLIER ?? 50)

// Click = call: when the agent/user actually invokes the sponsored x402 endpoint,
// bill it at CLICK_MULTIPLIER × the impression rate and accrue REQUESTER_SHARE to
// the request's wallet. The ad and the transaction are the same call (section 6).
app.post('/api/tender/click', async (c) => {
  const { sessionId, requestId, placementId } = await c.req.json().catch(() => ({}))
  const served = auctionLog.get(requestId)
  if (!served || served.placementId !== placementId) {
    return c.json({ error: 'no served placement for this request' }, 400)
  }
  const session = sessionId ? sessions.get(sessionId) : undefined
  const { creditedUsd, grossUsdc } = accrueClick({
    ledger: creditLedger,
    wallet: session?.address ?? '',
    requestId,
    placementId,
    pricePerImpressionUsdc: served.usdcPerImpression,
    clickMultiplier: CLICK_MULTIPLIER,
    requesterShare: REQUESTER_SHARE,
    at: Date.now(),
  })
  return c.json({
    creditedUsd: round6(creditedUsd),
    grossUsdc: round6(grossUsdc),
    endpointUrl: served.endpointUrl,
    wallet: session ? walletSnapshot(session) : undefined,
  })
})

app.post('/api/chat', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || !Array.isArray(body.messages)) {
    return c.json({ error: '`messages` is required' }, 400)
  }

  // Inference mode toggle (default Demo). Production routes to the real backend
  // when one is configured; otherwise it falls back to Demo.
  const wantProd = body.mode === 'production' && prodRT
  const rt = wantProd ? prodRT : demoRT
  const params = toChatParams(body, rt.modelToCandidate)
  const session = body.sessionId ? sessions.get(body.sessionId) : undefined
  if (session) params.metadata = { userId: session.id }
  // Production bring-your-own-wallet sessions route through the user's own UsePod
  // token; otherwise the selected mode's shared router.
  const activeRouter = wantProd ? (session?.usepod?.router ?? rt.router) : rt.router

  return streamSSE(c, async (stream) => {
    const controller = new AbortController()
    stream.onAbort(() => controller.abort())
    const ctx = {}
    let servedPlacement // the placement shown for this request, if any
    let measuredWaitMs // the real wait (ms) the placement was metered against

    // Tender — a thin portal surface. It paints a won placement into UI chrome
    // via a side-channel SSE event; it is NEVER spliced into the `delta` stream
    // (the placement invariant). The wait observer below holds no stream writer.
    const requestId = `req-${randomBytes(8).toString('hex')}`
    const surface = {
      id: 'portal-ide',
      async render(placement) {
        await stream.writeSSE({ event: 'placement', data: JSON.stringify(placement) })
      },
      async clear(rid) {
        await stream.writeSSE({ event: 'placement_clear', data: JSON.stringify({ requestId: rid }) })
      },
    }
    const tenderCtx = {
      requestId,
      surfaceId: surface.id,
      model: body.model && body.model !== 'auto' ? body.model : undefined,
      agentic: Array.isArray(body.tools) && body.tools.length > 0,
      userWallet: session?.address,
      userId: session?.id,
    }

    try {
      await als.run(ctx, async () => {
        const observed = observeWaitWindow(
          activeRouter.chatStream(params, { signal: controller.signal }),
          {
            onWaitWindow: async () => {
              const placement = tenderAuction.select(tenderCtx)
              if (!placement) return
              servedPlacement = placement
              auctionLog.record(placement, Date.now()) // for the gate's served cross-check
              await surface.render(placement, tenderCtx)
            },
            // meter() — the gateway's measured wait the payout scales to.
            onFirstToken: (ms) => {
              measuredWaitMs = ms
            },
          },
          { minWaitMs: TENDER_MIN_WAIT_MS },
        )
        for await (const event of observed) {
          if (event.type === 'text_delta') {
            await stream.writeSSE({ event: 'delta', data: JSON.stringify({ text: event.text }) })
          }
        }
      })

      const actual = ctx.actualCostUsd
      const baseline = ctx.baselineCostUsd
      const saved = ctx.savedUsd
      // Charge actual + margin, capped at the baseline the user would have paid
      // direct (Dock's M2 rule). Falls back to actual if pricing is unknown.
      const charged =
        actual === undefined
          ? undefined
          : baseline !== undefined
            ? Math.min(actual * (1 + MARGIN), baseline)
            : actual * (1 + MARGIN)

      if (session && charged !== undefined) {
        session.pendingUsd += charged
        session.savedUsd += saved ?? 0
        session.messages += 1
      }

      // Tender attestation + credit accrual. Built before `meta` so the wallet
      // snapshot reflects the new credit. accrueSettlement runs the release gate
      // (the moat) and, only on a valid attestation, accrues REQUESTER_SHARE of
      // the impression price to the request's wallet as an inference credit.
      let attEvent
      if (servedPlacement) {
        const attestation = signAttestation(
          {
            requestId,
            model: ctx.model ?? rt.mode,
            billedCostUsd: actual ?? 0,
            measuredWaitMs: measuredWaitMs ?? 0,
            surfaceId: surface.id,
            userWallet: session?.address ?? '',
            placementId: servedPlacement.placementId,
            issuedAt: Date.now(),
          },
          tenderKey,
        )
        const settlement = accrueSettlement(attestation, {
          publicKeyHex: tenderKey.publicKeyHex,
          ledger: creditLedger,
          pricePerImpressionUsdc: servedPlacement.usdcPerImpression,
          requesterShare: REQUESTER_SHARE,
          minWaitMs: TENDER_MIN_WAIT_MS,
          wasServed: (rid, pid) => auctionLog.wasServed(rid, pid),
          at: Date.now(),
        })
        attEvent = {
          attestation,
          valid: settlement.status === 'accrued',
          reason: settlement.reason,
          creditedUsd: settlement.requesterShareUsdc,
        }
      }

      await stream.writeSSE({
        event: 'meta',
        data: JSON.stringify({
          model: ctx.model,
          provider: ctx.provider,
          actualCostUsd: actual,
          baselineCostUsd: baseline,
          savedUsd: saved,
          chargedUsd: charged === undefined ? undefined : round6(charged),
          usage: ctx.usage,
          wallet: session ? walletSnapshot(session) : undefined,
        }),
      })

      // The signed attestation rides the side channel (proof-of-impression + the
      // credit it earned). This is what settlement released against.
      if (attEvent) {
        await stream.writeSSE({ event: 'attestation', data: JSON.stringify(attEvent) })
      }

      await stream.writeSSE({ event: 'done', data: '[DONE]' })
    } catch (err) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ message: err instanceof Error ? err.message : String(err) }),
      })
      await stream.writeSSE({ event: 'done', data: '[DONE]' })
    }
  })
})

// Convert the browser's OpenAI-ish payload into LLMChatParams. System messages
// fold into `system`; a non-"auto" model pins to the candidate that serves it.
function toChatParams(body, modelToCandidate) {
  const system = []
  const messages = []
  for (const m of body.messages) {
    if (m.role === 'system') {
      if (m.content) system.push(m.content)
    } else {
      messages.push({ role: m.role, content: m.content ?? '' })
    }
  }

  const params = {
    system: system.join('\n\n'),
    messages,
    tools: [],
    maxTokens: Number(body.maxTokens ?? 1024),
  }

  if (body.model && body.model !== 'auto') {
    const provider = modelToCandidate.get(body.model)
    params.routingHints = { pin: provider ? { provider, model: body.model } : { model: body.model } }
    params.model = body.model
  }
  return params
}

// ---------------------------------------------------------------------------
// Static SPA — read straight off disk so the server runs from any cwd.
// ---------------------------------------------------------------------------
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/wallet-bundle.js': ['wallet-bundle.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
}

app.get('*', async (c) => {
  const entry = STATIC[new URL(c.req.url).pathname]
  if (!entry) return c.notFound()
  const [file, type] = entry
  try {
    const buf = await readFile(join(HERE, 'public', file))
    return c.body(buf, 200, { 'content-type': type })
  } catch {
    return c.notFound()
  }
})

const MODE_NOTE = {
  demo: 'built-in mock — no real inference',
  usepod: 'wallet-funded · UsePod prepaid USDC',
  paybox: 'REAL inference · Paybox wallet pays per-request USDC over x402',
}
serve({ fetch: app.fetch, port: PORT })
console.log(`shipyard chat-portal → http://localhost:${PORT}`)
console.log(
  `  inference: demo (mock)` +
    (productionAvailable
      ? ` ⇄ ${prodInference.mode} (production) — UI toggle, default demo`
      : ` only — production not configured`),
)
if (productionAvailable) console.log(`             production: ${MODE_NOTE[prodInference.mode] ?? ''}`)
if (prodInference?.mode === 'paybox') {
  console.log(`  paybox:    ${prodInference.payer} · ${prodInference.network}`)
}
console.log(`  baseline:  ${demoRT.baselineModel} (demo) · margin: ${(MARGIN * 100).toFixed(0)}%`)
console.log(
  `  tender:    attest key ${tenderKey.publicKeyHex.slice(0, 16)}…` +
    (tenderKey.ephemeral ? '  ⚠ ephemeral — set TENDER_SIGNING_KEY for a stable key' : ''),
)
