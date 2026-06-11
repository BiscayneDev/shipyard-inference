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
  payboxSigner,
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
  // Mode C — x402: pay per request from a Solana wallet against a true x402
  // inference endpoint. The connected wallet (Paybox/keypair) IS the funding.
  if (process.env.SHIPYARD_X402_URL && process.env.PAYBOX_CREDENTIAL_ID) {
    const models = [
      { model: 'shipyard-economy', inputCostPerMTok: 0.6, outputCostPerMTok: 1.2, contextWindow: 128000, tier: 'economy', capabilities: ['tools'] },
      { model: 'shipyard-standard', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200000, tier: 'standard', capabilities: ['tools'] },
    ]
    const signer = await payboxSigner({ credentialId: process.env.PAYBOX_CREDENTIAL_ID })
    const wi = await createWalletInference({
      signer,
      baseURL: process.env.SHIPYARD_X402_URL,
      network: process.env.SHIPYARD_SETTLE_NETWORK === 'mainnet' ? 'mainnet' : 'devnet',
      family: process.env.SHIPYARD_X402_FAMILY === 'anthropic' ? 'anthropic' : 'openai',
      models,
    })
    return {
      mode: 'x402',
      candidates: [{ id: 'x402', provider: wi.provider, models }],
      baselineModel: 'shipyard-standard',
      close: wi.close,
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

const router = new Router({
  candidates: inference.candidates,
  strategy: costOptimized(),
  baselineModel: BASELINE_MODEL,
  pricingOverrides,
  onEvent: (event) => {
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

function newAddress() {
  const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let s = ''
  for (const byte of randomBytes(32)) s += b58[byte % b58.length]
  return (inference.mode === 'demo' ? 'Demo' : '') + s.slice(0, 40)
}

const round6 = (n) => Math.round((n + Number.EPSILON) * 1e6) / 1e6

function walletSnapshot(session) {
  return {
    sessionId: session.id,
    address: session.address,
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
  c.json({ models: modelCatalog, baselineModel: BASELINE_MODEL, mode: inference.mode }),
)

app.post('/api/wallet/connect', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  let session = body.sessionId ? sessions.get(body.sessionId) : undefined
  if (!session) {
    const id = randomBytes(12).toString('hex')
    session = {
      id,
      address: newAddress(),
      mode: inference.mode,
      balanceUsd: DEMO_BALANCE,
      pendingUsd: 0,
      spentUsd: 0,
      savedUsd: 0,
      messages: 0,
      settlements: [],
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

  // Demo path moves metered spend pending → settled. The real path settles via
  // the wallet: UsePod debits its USDC balance per request; x402/Paybox would
  // call payboxSettle(...) to a treasury here (see README).
  session.balanceUsd = Math.max(0, session.balanceUsd - amount)
  session.spentUsd += amount
  session.pendingUsd = 0
  session.settlements.push({ amountUsd: amount, at: new Date().toISOString(), mode: session.mode })

  return c.json({ settled: amount, wallet: walletSnapshot(session) })
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
  x402: 'wallet-funded · per-request x402 USDC',
}
serve({ fetch: app.fetch, port: PORT })
console.log(`shipyard chat-portal → http://localhost:${PORT}`)
console.log(`  inference: ${inference.mode}  (${MODE_NOTE[inference.mode] ?? ''})`)
console.log(`  baseline:  ${BASELINE_MODEL} · margin: ${(MARGIN * 100).toFixed(0)}%`)
