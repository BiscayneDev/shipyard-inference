// shipyard-inference — combined Vercel entrypoint.
//
// One Hono app, two surfaces, deployed as a single Vercel Function (Node
// runtime, streaming-capable):
//
//   • /v1/*   — the OpenAI-compatible inference gateway (cost-aware routing,
//               failover, streaming). Point any OpenAI SDK at it by URL.
//   • /api/*  — the operator command-center JSON API (live usage telemetry).
//
// The dashboard SPA and landing page are served as static assets from /public
// by Vercel's CDN; this function only handles the two dynamic surfaces.
//
// Telemetry is durable in Supabase (SupabaseTelemetryStore) instead of local
// JSONL, because serverless has no persistent disk. Gateway requests flush
// their telemetry within the invocation via `waitUntil`; dashboard requests
// rebuild aggregates by replaying the recent window from Supabase.
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { waitUntil } from '@vercel/functions'
// Imported from the built SDK (./dist) via relative paths so the entrypoint
// resolves deterministically under Vercel's bundler — `npm run build` runs first.
import {
  AnthropicProvider,
  OpenAIProvider,
  createOpenRouterProvider,
  createUsePodProvider,
  costOptimized,
} from './dist/index.js'
import { createGatewayApp, type GatewayConfig } from './dist/gateway/index.js'
import {
  TelemetryHub,
  SupabaseTelemetryStore,
  createInProcessReporter,
  createOperatorConsole,
} from './dist/operator/index.js'
// Landing page HTML, generated from public/index.html by scripts/build-web.mjs.
import { LANDING_HTML } from './landing.generated.js'

// ---------------------------------------------------------------------------
// Config from the environment (set in the Vercel project).
// ---------------------------------------------------------------------------
const SOURCE = process.env.SHIPYARD_GATEWAY_SOURCE ?? 'gateway-prod'
const MARGIN_PCT = Number(process.env.SHIPYARD_MARGIN_PCT ?? 15)
const API_KEYS = (process.env.SHIPYARD_API_KEYS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const OPERATOR_TOKENS = (process.env.SHIPYARD_OPERATOR_TOKEN ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const claudeModels = [
  { model: 'claude-haiku-4-5', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 200_000, tier: 'economy' as const, capabilities: ['tools' as const] },
  { model: 'claude-sonnet-4-5', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200_000, tier: 'standard' as const, capabilities: ['tools' as const] },
]
const gptModels = [
  { model: 'gpt-4o-mini', inputCostPerMTok: 0.15, outputCostPerMTok: 0.6, contextWindow: 128_000, tier: 'economy' as const, capabilities: ['tools' as const] },
  { model: 'gpt-4o', inputCostPerMTok: 2.5, outputCostPerMTok: 10, contextWindow: 128_000, tier: 'standard' as const, capabilities: ['tools' as const] },
]

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const estTokens = (s: string): number => Math.max(1, Math.ceil((s || '').length / 4))

/**
 * A zero-cost, zero-key mock provider so the public endpoint always answers —
 * a partner can `curl` it the moment they land, and real telemetry flows to the
 * dashboard, without exposing a real provider key or spending a cent. Real keys
 * (below) take over the moment they're configured.
 */
function demoProvider() {
  const reply = (params: { messages: { role: string; content: string }[] }): string => {
    const last = [...params.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    return (
      `You're talking to the Shipyard demo model — a built-in stub, so no real ` +
      `provider was billed. In production, Shipyard routes this to the cheapest ` +
      `capable model and (optionally) settles it per-request in USDC over x402.\n\n` +
      `You said: "${last.slice(0, 280)}"`
    )
  }
  const usageFor = (params: { messages: { content: string }[]; system?: string }, text: string) => ({
    inputTokens:
      params.messages.reduce((n, m) => n + estTokens(m.content), 0) + estTokens(params.system ?? ''),
    outputTokens: estTokens(text),
  })
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async chat(params: any) {
      const content = reply(params)
      return { content, toolCalls: [], stopReason: 'end_turn' as const, usage: usageFor(params, content) }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async *chatStream(params: any) {
      const content = reply(params)
      for (const tok of content.match(/\s+|\S+/g) ?? []) {
        yield { type: 'text_delta' as const, text: tok }
        await sleep(10)
      }
      yield { type: 'done' as const, response: { content, toolCalls: [], stopReason: 'end_turn' as const, usage: usageFor(params, content) } }
    },
  }
}

/**
 * Build routable candidates. The intended production path is **Shipyard-funded
 * inference**: real models paid per request in USDC from a prepaid UsePod token
 * (`USEPOD_TOKEN`) — no raw provider key, and the open endpoint's blast radius is
 * bounded by the loaded balance. Raw provider keys are an optional escape hatch;
 * with neither, an always-on free demo model keeps the endpoint live.
 */
function buildCandidates(): { candidates: GatewayConfig['candidates']; baselineModel: string } {
  // Primary: wallet-funded inference through Shipyard's own rails (UsePod USDC).
  if (process.env.USEPOD_TOKEN) {
    return {
      candidates: [
        {
          id: 'usepod',
          provider: createUsePodProvider({
            token: process.env.USEPOD_TOKEN,
            family: 'anthropic',
          }),
          models: claudeModels,
        },
      ],
      baselineModel: 'claude-sonnet-4-5',
    }
  }

  // Optional escape hatch: raw provider keys, if someone wires them.
  const candidates: GatewayConfig['candidates'] = []
  if (process.env.ANTHROPIC_API_KEY) {
    candidates.push({ id: 'anthropic', provider: new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }), models: claudeModels })
  }
  if (process.env.OPENAI_API_KEY) {
    candidates.push({ id: 'openai', provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }), models: gptModels })
  }
  if (process.env.OPENROUTER_API_KEY) {
    candidates.push({ id: 'openrouter', provider: createOpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY }), models: claudeModels })
  }
  if (candidates.length > 0) {
    const baseline = candidates.some((c) => c.id === 'anthropic')
      ? 'claude-sonnet-4-5'
      : (candidates[0].models?.[1]?.model ?? candidates[0].models![0].model)
    return { candidates, baselineModel: baseline }
  }

  // Fallback → always-on demo model (open, free, safe).
  const demoModels = [
    { model: 'shipyard-economy', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 128_000, tier: 'economy' as const, capabilities: ['tools' as const] },
    { model: 'shipyard-standard', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200_000, tier: 'standard' as const, capabilities: ['tools' as const] },
  ]
  return {
    candidates: [{ id: 'demo', provider: demoProvider(), models: demoModels }],
    baselineModel: 'shipyard-standard',
  }
}

// ---------------------------------------------------------------------------
// Durable telemetry: Supabase if configured, else an ephemeral in-memory hub
// (so a misconfigured deploy still serves inference — it just won't persist).
// ---------------------------------------------------------------------------
const store =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? new SupabaseTelemetryStore({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_KEY,
        table: process.env.SUPABASE_TELEMETRY_TABLE,
      })
    : undefined

const hub = new TelemetryHub({ store, marginPct: MARGIN_PCT })
const reporter = createInProcessReporter(hub, SOURCE)

const { candidates, baselineModel } = buildCandidates()

const gateway = createGatewayApp({
  candidates,
  strategy: costOptimized(),
  baselineModel,
  apiKeys: API_KEYS,
  telemetry: reporter,
  cors: { origins: '*' },
  // The terminal event for a request fires *inside* the (still-alive) streaming
  // invocation — flush then, so a stream's `request_completed` reaches Supabase
  // before the function freezes. (Post-`next()` flush below covers non-streams.)
  onEvent: (event) => {
    if (event.type === 'request_completed' || event.type === 'route_error') {
      keepAlive(reporter.flush())
    }
  },
})

const operator = createOperatorConsole({
  hub,
  operatorTokens: OPERATOR_TOKENS,
  cors: { origins: '*' },
})

/** Keep the invocation alive until a promise settles, when running on Vercel. */
function keepAlive(p: Promise<unknown>): void {
  try {
    waitUntil(p)
  } catch {
    void p // not in a Vercel request context (e.g. local Node smoke test)
  }
}

// ---------------------------------------------------------------------------
// The combined app.
// ---------------------------------------------------------------------------
const app = new Hono()
app.use('*', cors({ origin: '*' }))
app.get('/healthz', (c) => c.json({ status: 'ok', source: SOURCE, candidates: candidates.map((c) => c.id), persistent: Boolean(store) }))

// Landing page at `/`. Registered before the operator mount so it wins over the
// operator's static catch-all (which otherwise serves the dashboard SPA here).
// The dashboard SPA itself is served from /dashboard/ as static CDN assets.
app.get('/', (c) => c.html(LANDING_HTML))

// Gateway — flush this request's telemetry to Supabase before the function
// freezes. (The reporter also auto-flushes on its 2s timer during streaming.)
app.use('/v1/*', async (c, next) => {
  await next()
  keepAlive(reporter.flush())
})
app.route('/', gateway)

// Dashboard API — rebuild aggregates from Supabase for each read.
app.use('/api/*', async (c, next) => {
  if (store) await hub.boot()
  await next()
})
app.route('/', operator)

export default app
