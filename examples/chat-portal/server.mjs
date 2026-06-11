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
  usePodBalance,
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
async function buildInference() {
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

  // Mode A — demo (default): mock provider, two tiers so routing + savings have
  // something to show. Recognizably a stub; bills nothing.
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

const inference = await buildInference()
const BASELINE_MODEL = process.env.PORTAL_BASELINE_MODEL ?? inference.baselineModel

// model id -> candidate id, so a pinned pick routes to the provider that serves it.
const modelToCandidate = new Map()
for (const c of inference.candidates) {
  for (const m of c.models ?? []) modelToCandidate.set(m.model, c.id)
}

// The flat catalog the picker renders (plus the synthetic "auto" entry).
const modelCatalog = [
  { id: 'auto', label: 'Auto — cheapest capable', provider: 'shipyard', tier: 'auto' },
  ...inference.candidates.flatMap((c) =>
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

// Pricing the Router can look up by model id. The baseline is priced via this
// table (not the candidate `models[]`), so the savings model must live here too.
const pricingOverrides = Object.fromEntries(
  inference.candidates.flatMap((c) => (c.models ?? []).map((m) => [m.model, m])),
)

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

const router = new Router({
  candidates: inference.candidates,
  strategy: costOptimized(),
  baselineModel: BASELINE_MODEL,
  pricingOverrides,
  onEvent: (event) => {
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
  },
})

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
    messages: session.messages,
    settlements: session.settlements.length,
  }
}

// ---------------------------------------------------------------------------
const app = new Hono()
app.use('/api/*', cors())

app.get('/api/models', (c) =>
  c.json({
    models: modelCatalog,
    baselineModel: BASELINE_MODEL,
    mode: inference.mode,
    network: inference.network,
    payer: inference.payer,
  }),
)

app.post('/api/wallet/connect', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  let session = body.sessionId ? sessions.get(body.sessionId) : undefined
  if (!session) {
    const id = randomBytes(12).toString('hex')
    const wallet = ['paybox', 'phantom', 'metamask'].includes(body.wallet) ? body.wallet : 'paybox'
    session = {
      id,
      address: newAddress(wallet),
      wallet,
      mode: inference.mode,
      balanceUsd: DEMO_BALANCE,
      pendingUsd: 0,
      spentUsd: 0,
      savedUsd: 0,
      messages: 0,
      settlements: [],
    }
    // In Paybox-funded UsePod mode the balance is the real remaining UsePod
    // balance (0 until the first Top up), not a demo figure.
    if (inference.funding) {
      try {
        session.balanceUsd = (await usePodBalance(inference.funding.token)).usdc
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

  const amount = round6(session.pendingUsd)
  if (amount <= 0) return c.json({ settled: 0, wallet: walletSnapshot(session) })

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

app.post('/api/chat', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || !Array.isArray(body.messages)) {
    return c.json({ error: '`messages` is required' }, 400)
  }

  const params = toChatParams(body)
  const session = body.sessionId ? sessions.get(body.sessionId) : undefined
  if (session) params.metadata = { userId: session.id }

  return streamSSE(c, async (stream) => {
    const controller = new AbortController()
    stream.onAbort(() => controller.abort())
    const ctx = {}

    try {
      await als.run(ctx, async () => {
        for await (const event of router.chatStream(params, { signal: controller.signal })) {
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
function toChatParams(body) {
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
console.log(`  inference: ${inference.mode}  (${MODE_NOTE[inference.mode] ?? ''})`)
if (inference.mode === 'paybox') {
  console.log(`  paybox:    ${inference.payer} · ${inference.network}`)
}
console.log(`  baseline:  ${BASELINE_MODEL} · margin: ${(MARGIN * 100).toFixed(0)}%`)
