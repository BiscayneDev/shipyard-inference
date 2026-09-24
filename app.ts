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
import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Context } from 'hono'
import { waitUntil } from '@vercel/functions'
// Imported from the built SDK (./dist) via relative paths so the entrypoint
// resolves deterministically under Vercel's bundler — `npm run build` runs first.
import {
  AnthropicProvider,
  OpenAIProvider,
  createOpenRouterProvider,
  createUsePodProvider,
  createHopscotchCandidate,
  costOptimized,
  GatewayTender,
  MemoryCreditStore,
  SupabaseCreditStore,
  MemoryCampaignStore,
  SupabaseCampaignStore,
  buildCampaign,
  isCampaignActive,
  tenderDepositConfig,
  newPaymentReference,
  buildDepositIntent,
  verifyDeposit,
  createJevTierInferrer,
  createTypeSafeProvider,
  createVercelGatewayDecisionProvider,
  createOpenRouterDecisionProvider,
  createStubDecisionProvider,
  createChainedDecisionProvider,
  MemoryDecisionFeedback,
  SupabaseDecisionFeedback,
  type CampaignStore,
} from './dist/index.js'
import {
  createGatewayApp,
  resolveAuth,
  MemoryApiKeyStore,
  SupabaseApiKeyStore,
  listDevKeys,
  createDevKey,
  revokeDevKey,
  relabelDevKey,
  MemoryProjectSpendStore,
  SupabaseProjectSpendStore,
  parseProjectCaps,
  selfServeKeysOpen,
  canMintKey,
  closedPage,
  SELF_SERVE_CSS,
  SELF_SERVE_CLOSED_BODY,
  x402Config,
  type GatewayConfig,
  type ProjectSpendStore,
  type ApiKeyStore,
} from './dist/gateway/index.js'
import {
  TelemetryHub,
  SupabaseTelemetryStore,
  createInProcessReporter,
  createOperatorConsole,
} from './dist/operator/index.js'
// Landing page HTML, generated from public/index.html by scripts/build-web.mjs.
import { LANDING_HTML } from './landing.generated.js'
// Manifesto page HTML, generated from public/manifesto.html by scripts/build-web.mjs.
import { MANIFESTO_HTML } from './manifesto.generated.js'

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

// Self-serve key creation is closed unless SHIPYARD_SELF_SERVE_KEYS=on.
// Closed: no new keys without the operator token; existing keys keep working.
const SELF_SERVE_KEYS = selfServeKeysOpen(process.env)

const claudeModels = [
  { model: 'claude-haiku-4-5', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 200_000, tier: 'economy' as const, capabilities: ['tools' as const] },
  { model: 'claude-sonnet-4-5', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200_000, tier: 'standard' as const, capabilities: ['tools' as const] },
]
const gptModels = [
  // GPT-4.1 family — validated against the live OpenAI key (models endpoint).
  { model: 'gpt-4.1-nano', inputCostPerMTok: 0.1, outputCostPerMTok: 0.4, contextWindow: 1_047_576, tier: 'economy' as const, capabilities: ['tools' as const] },
  { model: 'gpt-4.1-mini', inputCostPerMTok: 0.4, outputCostPerMTok: 1.6, contextWindow: 1_047_576, tier: 'standard' as const, capabilities: ['tools' as const] },
  { model: 'gpt-4.1', inputCostPerMTok: 2, outputCostPerMTok: 8, contextWindow: 1_047_576, tier: 'frontier' as const, capabilities: ['tools' as const] },
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
  // Every configured upstream joins the same routing/failover pool.
  // UsePod remains the wallet-funded path; Hopscotch adds its multi-provider
  // catalog without displacing UsePod or any direct provider.
  const candidates: GatewayConfig['candidates'] = []
  if (process.env.USEPOD_TOKEN) {
    candidates.push({
      id: 'usepod',
      provider: createUsePodProvider({
        token: process.env.USEPOD_TOKEN,
        family: 'anthropic',
      }),
      models: claudeModels,
    })
  }
  const hopscotch = createHopscotchCandidate(process.env)
  if (hopscotch) candidates.push(hopscotch)

  // Optional escape hatch: raw provider keys, if someone wires them.
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
    const baseline = candidates.some((c) => c.id === 'usepod' || c.id === 'anthropic')
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

// Per-user API keys — the consumer surface. Developers self-issue an
// `sk-shipyard-…` key at /connect and paste it into their IDE; their traffic is
// attributed to their account for routing savings + Tender kickbacks. Persisted
// in Supabase when configured (serverless has no disk), else process-local.
const keyStore: ApiKeyStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? new SupabaseApiKeyStore({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_KEY,
        table: process.env.SUPABASE_API_KEYS_TABLE,
      })
    : new MemoryApiKeyStore()
const bootstrapAuth = !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)

// Per-project daily spend caps, e.g. SHIPYARD_PROJECT_CAPS='{"dinghy-sandbox-prod":10}'.
// Only keys whose project id has a cap are limited. Spend is kept per UTC day in
// Supabase (survives cold starts); over-cap requests get a 402 that points the
// developer at adding USDC in PayBox. No caps configured = no behavior change.
const PROJECT_CAPS = parseProjectCaps(process.env.SHIPYARD_PROJECT_CAPS)
const projectSpendStore: ProjectSpendStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? new SupabaseProjectSpendStore({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY })
    : new MemoryProjectSpendStore()

// Tender on the gateway — an agent's OWN traffic earns kickbacks: a sponsored
// line is auctioned during each request's wait and shown in the developer's
// status line, and the (real, billed) impression accrues their kickback. Seeded
// demo inventory; production also pulls campaigns from the advertiser surface.
// Set TENDER_SIGNING_KEY for a stable attestation key.
// Durable kickback ledger — survives serverless cold starts when Supabase is
// configured; in-memory otherwise (fine for a long-lived gateway).
const tenderCreditStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? new SupabaseCreditStore({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_KEY,
        table: process.env.SUPABASE_TENDER_CREDITS_TABLE,
      })
    : new MemoryCreditStore()
const gatewayTender = new GatewayTender({
  minWaitMs: Number(process.env.TENDER_MIN_WAIT_MS ?? 800),
  creditStore: tenderCreditStore,
  // Inventory is loaded from the campaign store (below) — the single source of
  // truth — rather than hardcoded, so /advertise reflects exactly what serves.
})

// House seed inventory — written to the store once if it's empty, so a fresh
// deploy has something to auction and /advertise isn't blank. After that, the
// store (advertiser self-serve at /advertise) is authoritative.
const SEED_CAMPAIGNS = [
  { campaignId: 'gw-vercel', placementId: 'gw-vercel', advertiserWallet: 'TenderHouseVercel', endpointUrl: 'https://api.shipyard.market/x402/vercel-deploy', line: '🛰️  Ship to prod — one-call Vercel deploy, pay-per-call USDC', usdcPerImpression: 0.005, remainingImpressions: 100_000, fundedUsdc: 500, targeting: {}, status: 'active' as const },
  { campaignId: 'gw-embed', placementId: 'gw-embed', advertiserWallet: 'TenderHouseEmbed', endpointUrl: 'https://api.shipyard.market/x402/nomic-embed', line: '⚡  Add semantic search — Nomic embeddings over x402', usdcPerImpression: 0.002, remainingImpressions: 100_000, fundedUsdc: 200, targeting: {}, status: 'active' as const },
]

// Advertiser funding rail: when a treasury is configured, self-serve campaigns
// are born `pending` and must be paid (USDC on Solana, verified on-chain) before
// they enter the auction. Unset → no rail, campaigns go live on creation (local
// dev / demo without a treasury).
const depositConfig = tenderDepositConfig(process.env)

// Advertiser campaign store — the persistent source of truth for self-serve
// campaigns created at /advertise. Persisted in Supabase (shipyard_campaigns)
// so they survive serverless cold starts; loaded into the live auction once per
// instance, and added immediately on the instance that creates them.
const campaignStore: CampaignStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? new SupabaseCampaignStore({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_KEY,
        table: process.env.SUPABASE_CAMPAIGNS_TABLE,
      })
    : new MemoryCampaignStore()

// Fold persisted campaigns into the gateway auction, once per instance (seeding
// house inventory first if the store is empty). Cleared on failure to retry.
let campaignsLoaded: Promise<void> | undefined
function ensureCampaigns(): Promise<void> {
  if (!campaignsLoaded) {
    campaignsLoaded = (async () => {
      let rows = await campaignStore.list()
      if (rows.length === 0) {
        for (const c of SEED_CAMPAIGNS) await campaignStore.create(c).catch(() => {})
        rows = await campaignStore.list()
      }
      // Only funded (active) campaigns serve; pending ones await their deposit.
      for (const c of rows) if (isCampaignActive(c)) gatewayTender.addCampaign(c)
    })().catch(() => {
      campaignsLoaded = undefined
    })
  }
  return campaignsLoaded
}

const { candidates, baselineModel } = buildCandidates()

// Price the baseline model (and every routed model) by id, so `request_completed`
// carries real baselineCostUsd/savedUsd — i.e. provable savings show up in the
// operator console AND each developer's /me earnings view.
const pricingOverrides = Object.fromEntries(
  candidates.flatMap((c) => (c.models ?? []).map((m) => [m.model, m])),
)

// Jev-judged routing: every `auto` request is content-judged by TypeSafe Jev
// (~$0.0001, 100-500ms) to pick the cheapest model that clears its needed
// quality tier — falling back to the structural heuristic on error/timeout/low
// confidence.
// Provider CHAIN, native TypeSafe first (the user-provided Jev API key) — the
// Vercel AI Gateway is deliberately NOT in the chain (account-verification
// blocks; we don't route Jev through Vercel). Degrades TypeSafe → OpenRouter
// → stub (neutral answers, noul 0.5 — the tier inferrer treats those as
// low-confidence and falls back to the structural heuristic), and every
// response carries `provider` saying which member answered.
const openRouterKey = process.env.OPENROUTER_API_KEY
const typesafeKey = process.env.TYPESAFE_API_KEY
const jevChain = createChainedDecisionProvider({
  providers: [
    ...(typesafeKey ? [createTypeSafeProvider({ apiKey: typesafeKey })] : []),
    ...(openRouterKey ? [createOpenRouterDecisionProvider({ apiKey: openRouterKey })] : []),
    createStubDecisionProvider(),
  ],
})
const jevDecisionProvider = typesafeKey || openRouterKey ? jevChain : undefined

// Judgment loop: joins Jev tier decisions with guardrail quality outcomes per
// request; GET /v1/decisions/feedback reports per-tier quality/confidence,
// Jev fallbacks, cache hits, and decision cost. Persisted to Supabase when
// configured (cross-instance, survives cold starts; writes kept alive with
// waitUntil), else in-memory per-instance.
const decisionFeedback =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? new SupabaseDecisionFeedback({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_KEY,
      })
    : new MemoryDecisionFeedback()

const gateway = createGatewayApp({
  candidates,
  strategy: costOptimized(),
  // Requests that name a catalog model get exactly that model; `auto` (or an
  // unknown id) routes to the cheapest model that clears the request's inferred
  // quality tier — Jev-judged when the AI Gateway key is present (content-aware:
  // topic, complexity, reasoning depth), else the structural heuristic
  // (tools/large prompts ⇒ standard, frontier work ⇒ frontier).
  autoTier: jevDecisionProvider
    ? createJevTierInferrer({
        provider: jevDecisionProvider,
        combine: 'max',
        // Reuse identical judgments for 5 min — no decision call, latency, or
        // Jev input cost for repeated/continued request states.
        cacheTtlMs: 300_000,
      })
    : true,
  // The typed-decision product surface — live Jev through the same key.
  ...(jevDecisionProvider ? { decisions: { provider: jevDecisionProvider } } : {}),
  // Observe-only output guardrails: quality + safety scored by the same Jev
  // chain after every completion, fire-and-forget. Feeds the judgment loop.
  ...(jevDecisionProvider ? { guardrails: { provider: jevChain } } : {}),
  decisionFeedback,
  baselineModel,
  pricingOverrides,
  // Advertise the full catalog plus the `auto` alias in GET /v1/models.
  models: [
    { id: 'auto', ownedBy: 'shipyard' },
    ...candidates.flatMap((c) => (c.models ?? []).map((m) => ({ id: m.model, ownedBy: c.id }))),
  ],
  apiKeys: API_KEYS,
  keyStore,
  bootstrapAuth,
  projectCaps: Object.keys(PROJECT_CAPS).length
    ? {
        caps: PROJECT_CAPS,
        store: projectSpendStore,
        topUpUrl: process.env.SHIPYARD_TOPUP_URL || undefined,
        onPending: (p) => keepAlive(p),
      }
    : undefined,
  tender: gatewayTender,
  telemetry: reporter,
  cors: { origins: '*' },

  // x402 pay-per-call: unauthenticated requests get a 402 USDC challenge; a
  // verified X-PAYMENT proof serves the request (any wallet, Paybox included).
  // Collected payments flow to the operator hub's billing panel.
  x402: x402Config(process.env),
  onX402Payment: (payment) => {
    reporter.recordSettlement({
      userId: payment.payer,
      amountUsd: payment.amountUsdc,
      status: 'settled',
      signature: payment.signature,
      network: x402Config(process.env)?.network,
    })
  },

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
  keyStore,
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
// Shared terminal-vibe design system — one source of truth for every page's
// chrome. Pages embed ${TERMINAL_FONTS} + <style>${TERMINAL_CSS}</style> and
// ${navHtml('<id>')} for the consistent top nav.
// ---------------------------------------------------------------------------
const TERMINAL_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>`

const TERMINAL_CSS = `
:root{--bg:#050a18;--bg2:#0a1226;--panel:#0a1226;--panel2:#0f1a30;--line:#16223a;--line2:#22345a;--fg:#e8eef6;--muted:#8fa3bd;--dim:#5d7089;--term:#6b9ce0;--term2:#8fb3e0;--amber:#d8c9a8;--green:#86d6a8;--serif:"Playfair Display",Georgia,serif;--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;--sans:"Inter",ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 var(--sans);-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(1000px 560px at 75% -12%,rgba(107,156,224,.10),transparent 62%),radial-gradient(700px 460px at 5% 2%,rgba(107,156,224,.06),transparent 55%)}
body::after{content:"";position:fixed;inset:-50%;z-index:40;pointer-events:none;opacity:.18;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");mix-blend-mode:overlay}
.wrap{max-width:880px;margin:0 auto;padding:0 26px 70px;position:relative;z-index:1}
a{color:var(--term);text-decoration:none}a:hover{color:var(--fg)}
.mono{font-family:var(--mono)}.muted{color:var(--muted)}.green{color:var(--green)}.hidden{display:none}
.kicker{font-family:var(--mono);font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.tnav{display:flex;align-items:center;justify-content:space-between;padding:22px 0;border-bottom:1px solid var(--line);margin-bottom:36px}
.tnav .brand{font-family:var(--mono);font-weight:500;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#cdd9e8}
.tnav .brand .sig{color:var(--term)}.tnav .brand .dim{color:var(--dim)}
.tnav .lnk{display:flex;gap:22px;align-items:center}
.tnav .lnk a{font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:var(--muted)}
.tnav .lnk a:hover{color:#fff}.tnav .lnk a.active{color:var(--term);border-bottom:1px solid var(--term);padding-bottom:3px}
@media(max-width:640px){.tnav{flex-direction:column;gap:12px;align-items:flex-start}.tnav .lnk{flex-wrap:wrap;gap:14px}}
h1{font-family:var(--serif);font-size:clamp(34px,5vw,50px);line-height:1.08;margin:0 0 14px;letter-spacing:-.015em;font-weight:600}
h1 .grad{color:var(--term);font-style:italic;font-weight:400}
h2{font-family:var(--serif);font-size:clamp(24px,3.4vw,32px);letter-spacing:-.01em;margin:0 0 8px;font-weight:600}
h2 em{font-style:italic;font-weight:400;color:var(--term)}
.sub{font-size:16.5px;color:var(--muted);margin:0 0 28px;line-height:1.65;max-width:640px}
.sub em,.sub strong{color:var(--fg);font-style:normal;font-weight:500}
.lede{color:var(--muted);margin:6px 0 0;max-width:640px}
.seclabel{display:flex;align-items:center;gap:12px;margin:30px 0 16px}.seclabel::after{content:"";flex:1;height:1px;background:var(--line)}
.pill{display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a9c4e4;border:1px solid var(--line2);background:rgba(15,26,48,.6);border-radius:999px;padding:6px 14px;margin-bottom:20px}
.pill .blip{width:7px;height:7px;border-radius:50%;background:var(--term);box-shadow:0 0 9px var(--term);animation:pulse 2.4s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.card,.panel{background:rgba(10,18,38,.6);border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin:14px 0;backdrop-filter:blur(6px)}
.panel .num{font-family:var(--mono);font-size:10.5px;letter-spacing:.24em;color:var(--term);margin-bottom:10px;text-transform:uppercase}
.panel h3,.card strong{font-size:15.5px;font-weight:600}
label{display:block;font-family:var(--mono);font-size:11px;color:var(--muted);margin:14px 0 6px;text-transform:uppercase;letter-spacing:.08em}
input,textarea{width:100%;background:#040814;border:1px solid var(--line2);border-radius:10px;color:var(--fg);padding:11px 12px;font:14px var(--mono)}
input:focus,textarea:focus{outline:none;border-color:var(--term)}
.row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}.row>div{flex:1;min-width:200px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.grid{grid-template-columns:1fr}}
button{appearance:none;border:1px solid transparent;border-radius:999px;font-family:var(--mono);font-weight:500;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;padding:14px 26px;cursor:pointer;transition:transform .2s ease,background .2s ease;margin-top:16px;background:#cfe0f2;color:#071222}
button:hover{transform:translateY(-1px);background:#fff}button:disabled{opacity:.45;cursor:default;transform:none}
a.btn{display:inline-flex;align-items:center;gap:8px;border-radius:999px;font-family:var(--mono);font-weight:500;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;padding:13px 22px;border:1px solid var(--line2);color:var(--fg);background:rgba(255,255,255,.02)}
a.btn:hover{border-color:var(--term);color:var(--term)}
a.btn.primary{background:#cfe0f2;color:#071222;border-color:transparent}
pre{background:rgba(10,18,38,.65);border:1px solid var(--line);border-radius:12px;padding:16px;overflow:auto;font:13px/1.7 var(--mono);color:#d7e2f0;margin:8px 0 0;position:relative}
code{font-family:var(--mono);color:var(--term2)}
.copy{position:absolute;top:8px;right:8px;font-family:var(--mono);font-size:11px;color:var(--muted);background:rgba(15,26,48,.9);border:1px solid var(--line2);border-radius:7px;padding:3px 9px;cursor:pointer;margin:0}.copy:hover{color:#fff;border-color:#fff}
.note{font-size:13px;color:var(--muted);margin-top:10px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}th,td{text-align:left;padding:9px;border-bottom:1px solid var(--line)}th{color:var(--dim);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-family:var(--mono)}td.mono{font-family:var(--mono)}
.term{background:var(--panel);border:1px solid var(--line2);border-radius:12px;overflow:hidden;margin-top:14px}
.term-bar{display:flex;align-items:center;gap:7px;padding:10px 14px;background:var(--panel2);border-bottom:1px solid var(--line)}
.term-bar .d{width:11px;height:11px;border-radius:50%}.d.r{background:#ff5f57}.d.y{background:#febc2e}.d.g{background:#28c840}
.term-bar .ttl{margin-left:8px;font-family:var(--mono);font-size:12px;color:var(--dim)}
.pr{color:var(--term2)}.ok{color:var(--term)}.am{color:var(--amber)}.mut{color:var(--dim)}.wh{color:var(--fg)}
footer{color:var(--muted);font-size:13px;padding:34px 0 0;border-top:1px solid var(--line);margin-top:30px;line-height:1.7}
`

const navHtml = (active: string): string => {
  const link = (href: string, id: string, label: string): string =>
    `<a href="${href}"${id === active ? ' class="active"' : ''}>${label}</a>`
  return `<header class="tnav"><a class="brand" href="/"><span class="sig">◢</span> shipyard <span class="dim">·</span> inference</a><div class="lnk">${link('/keys', 'keys', 'keys')}${link('/connect', 'connect', 'connect')}${link('/pricing', 'pricing', 'pricing')}${link('/me', 'me', 'usage')}${link('/dashboard/', 'dashboard', 'dashboard')}</div></header>`
}

// ---------------------------------------------------------------------------
// Developer keys — self-serve: create a key, then manage your project's keys
// (create, label, revoke, masked view). Holding a key is the sign-in.
// ---------------------------------------------------------------------------
const KEYS_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>API keys · Shipyard Inference</title>
${TERMINAL_FONTS}
<style>${TERMINAL_CSS}
.wrap{max-width:820px}
.k{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:18px 0 4px}
.key{color:var(--green);word-break:break-all}
.card.hero{border-color:#22345a;background:rgba(15,26,48,.6)}
.once{border-color:#2d5a45;background:rgba(20,48,36,.35)}
.tag{display:inline-block;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line2);border-radius:999px;padding:2px 9px;color:var(--muted)}
.tag.on{color:var(--green);border-color:#2d5a45}.tag.off{color:var(--dim)}.tag.you{color:var(--term2);border-color:#2a4470}
td .act{appearance:none;background:none;border:1px solid var(--line2);color:var(--muted);border-radius:999px;font:500 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;padding:5px 11px;margin:0 0 0 6px;cursor:pointer}
td .act:hover{color:#fff;border-color:#fff;transform:none;background:none}
td .act.danger:hover{color:#ff8f8f;border-color:#ff8f8f}
.err{color:#ff9a9a;font-size:13px;margin-top:10px;min-height:1em}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.bar button{margin-top:0}
.linkbtn{appearance:none;background:none;border:none;color:var(--muted);font:12px var(--mono);padding:0;margin:0;cursor:pointer;text-decoration:underline}
.linkbtn:hover{color:#fff;background:none;transform:none}
${SELF_SERVE_CSS}
</style></head><body><div class="wrap">
${navHtml('keys')}
<span class="pill ss"><span class="blip"></span> developers · self-serve</span>
<span class="pill cl"><span class="blip"></span> developers · opening soon</span>
<h1>Shipyard API keys</h1>
<p class="sub ss">Create a key in one click, then add, rename, or revoke keys whenever you need to. Works with any OpenAI or Anthropic SDK. No signup.</p>
<p class="sub cl">Self-serve keys aren't open yet. We're opening Shipyard to developers soon.</p>

<div id="start" class="card hero">
  <div class="ss">
  <strong>Create your first key</strong>
  <div class="row">
    <div><label for="label0">Name (optional)</label><input id="label0" maxlength="64" placeholder="e.g. my-agent, cursor-laptop"/></div>
    <div style="flex:0"><button id="create0">Create key</button></div>
  </div>
  </div>
  <div class="cl"><strong>Not open yet</strong><div class="note">New keys are paused while we finish the developer launch. Check back soon.</div></div>
  <div class="err" id="err0"></div>
  <div class="note">Already have a key? <button class="linkbtn" id="showpaste">Manage your keys</button></div>
  <div id="paste" class="hidden">
    <div class="row">
      <div><label for="keyin">Your API key</label><input id="keyin" type="password" autocomplete="off" placeholder="sk-shipyard-…"/></div>
      <div style="flex:0"><button id="open">Open</button></div>
    </div>
    <div class="note">Your key is only used to load your keys. It stays in this browser tab and is never shown again.</div>
  </div>
</div>

<div id="fresh" class="card once hidden">
  <strong>Your new key</strong> <span class="muted">— copy it now, it won't be shown again</span>
  <pre><span class="copy" data-copy="#freshkey">copy</span><span id="freshkey" class="key"></span></pre>
  <div class="k">Use it</div>
  <pre><span class="copy" data-copy="#snippet">copy</span><span id="snippet"></span></pre>
</div>

<div id="manage" class="card hidden">
  <div class="bar">
    <div><strong>Your keys</strong> <span class="muted" id="count"></span></div>
    <button class="linkbtn" id="signout">Close</button>
  </div>
  <div class="row ss">
    <div><label for="label1">New key name</label><input id="label1" maxlength="64" placeholder="e.g. staging"/></div>
    <div style="flex:0"><button id="create1">Create key</button></div>
  </div>
  <div class="err" id="err1"></div>
  <table><thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Status</th><th></th></tr></thead><tbody id="rows"></tbody></table>
  <div class="note">Revoking stops a key right away (allow up to a minute everywhere). Usage and daily limits are shared across the keys in your project. If you hit the limit, add USDC to your PayBox wallet to keep going.</div>
</div>

<p class="note">Next: <a href="/connect">connect your IDE</a> · <a href="/me">see usage</a> · <a href="/pricing">pricing</a></p>
<footer>Shipyard Inference · keys are stored hashed; only a short prefix and the last 4 characters are kept for display.</footer>
<script>
const $=s=>document.querySelector(s);
const base=location.origin+'/v1';
let session=sessionStorage.getItem('shipyard_dev_key')||'';
function show(el,on){el.classList.toggle('hidden',!on)}
function fmt(ms){try{return new Date(ms).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}catch(e){return ''}}
function snippet(k){return 'export OPENAI_BASE_URL='+base+'\\nexport OPENAI_API_KEY='+k+'\\n\\n# Anthropic SDK / Claude Code\\nexport ANTHROPIC_BASE_URL='+location.origin+'\\nexport ANTHROPIC_API_KEY='+k}
function showFresh(k){$('#freshkey').textContent=k;$('#snippet').textContent=snippet(k);show($('#fresh'),true);$('#fresh').scrollIntoView({behavior:'smooth',block:'nearest'})}
async function api(method,path,body){
  const r=await fetch(path,{method,headers:Object.assign({'content-type':'application/json'},session?{authorization:'Bearer '+session}:{}),body:body?JSON.stringify(body):undefined});
  let d={};try{d=await r.json()}catch(e){}
  if(!r.ok) throw new Error(d.error||('request failed ('+r.status+')'));
  return d;
}
function cell(text,cls){const td=document.createElement('td');if(cls)td.className=cls;td.textContent=text;return td}
function tag(text,cls){const s=document.createElement('span');s.className='tag '+cls;s.textContent=text;return s}
function btn(text,cls,fn){const b=document.createElement('button');b.className='act '+(cls||'');b.textContent=text;b.addEventListener('click',fn);return b}
async function load(){
  try{
    const d=await api('GET','/api/dev/keys');
    show($('#start'),false);show($('#manage'),true);
    $('#count').textContent='· '+d.activeCount+' active of '+d.maxActive;
    const tb=$('#rows');tb.textContent='';
    for(const k of d.keys){
      const tr=document.createElement('tr');
      tr.appendChild(cell(k.label||'untitled'));
      tr.appendChild(cell(k.masked,'mono'));
      tr.appendChild(cell(fmt(k.createdAt)));
      const st=document.createElement('td');st.appendChild(tag(k.status==='active'?'active':'revoked',k.status==='active'?'on':'off'));if(k.current){st.appendChild(document.createTextNode(' '));st.appendChild(tag('this key','you'))}tr.appendChild(st);
      const ac=document.createElement('td');ac.style.textAlign='right';ac.style.whiteSpace='nowrap';
      ac.appendChild(btn('Rename','',async()=>{const n=prompt('New name for this key',k.label||'');if(n===null)return;try{await api('PATCH','/api/dev/keys/'+encodeURIComponent(k.id),{label:n});load()}catch(e){$('#err1').textContent=e.message}}));
      if(k.status==='active') ac.appendChild(btn('Revoke','danger',async()=>{const msg=k.current?'This is the key you opened this page with. Revoke it? Apps using it stop working.':'Revoke "'+(k.label||k.masked)+'"? Apps using it stop working.';if(!confirm(msg))return;try{await api('POST','/api/dev/keys/'+encodeURIComponent(k.id)+'/revoke');if(k.current){signout()}else{load()}}catch(e){$('#err1').textContent=e.message}}));
      tr.appendChild(ac);tb.appendChild(tr);
    }
  }catch(e){
    sessionStorage.removeItem('shipyard_dev_key');session='';
    show($('#manage'),false);show($('#start'),true);show($('#paste'),true);$('#err0').textContent=e.message;
  }
}
function signout(){sessionStorage.removeItem('shipyard_dev_key');session='';show($('#manage'),false);show($('#fresh'),false);show($('#start'),true)}
$('#showpaste').addEventListener('click',()=>{show($('#paste'),true);$('#keyin').focus()});
$('#open').addEventListener('click',()=>{const k=$('#keyin').value.trim();if(!k){$('#err0').textContent='Paste a key first.';return}$('#err0').textContent='';session=k;sessionStorage.setItem('shipyard_dev_key',k);$('#keyin').value='';load()});
$('#create0').addEventListener('click',async()=>{
  $('#create0').disabled=true;$('#err0').textContent='';
  try{const r=await fetch('/api/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label:$('#label0').value.trim()||undefined})});const d=await r.json();if(!r.ok||!d.key)throw new Error(d.error||'could not create a key');session=d.key;sessionStorage.setItem('shipyard_dev_key',d.key);showFresh(d.key);load()}catch(e){$('#err0').textContent=e.message}
  $('#create0').disabled=false;
});
$('#create1').addEventListener('click',async()=>{
  $('#create1').disabled=true;$('#err1').textContent='';
  try{const d=await api('POST','/api/dev/keys',{label:$('#label1').value.trim()||undefined});$('#label1').value='';showFresh(d.key);load()}catch(e){$('#err1').textContent=e.message}
  $('#create1').disabled=false;
});
$('#signout').addEventListener('click',signout);
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('.copy');if(!t)return;const src=document.querySelector(t.dataset.copy);if(!src)return;navigator.clipboard.writeText(src.textContent).then(()=>{t.textContent='copied';setTimeout(()=>t.textContent='copy',1400)})});
if(session) load();
</script>
</div></body></html>`

// ---------------------------------------------------------------------------
// "Connect your IDE" — self-serve key + copy-paste config for any OpenAI-
// compatible IDE. Client-rendered so the baseURL tracks the actual deploy host.
// ---------------------------------------------------------------------------
const CONNECT_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Connect your IDE · Shipyard Inference</title>
${TERMINAL_FONTS}
<style>${TERMINAL_CSS}
.wrap{max-width:760px}
.k{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:18px 0 4px}
.key{color:var(--green);word-break:break-all}
.card.hero{border-color:#22345a;background:rgba(15,26,48,.6)}
.divider{text-align:center;margin:20px 0 6px;font-family:var(--mono);font-size:12px;color:var(--dim);letter-spacing:.03em}
${SELF_SERVE_CSS}
</style></head><body><div class="wrap">
${navHtml('connect')}
<span class="pill"><span class="blip"></span> claude code · cursor · codex · any agent</span>
<h1>Connect Shipyard to your IDE</h1>
<p class="sub">Issue a key, keep your model — and route through Shipyard for <strong>cheaper, more reliable inference</strong> with per-call USDC billing. No subscription.</p>
<div class="card hero cl">
  <strong>Not open yet</strong>
  <div class="note">Self-serve keys aren't open yet. We're opening Shipyard to developers soon. Already have a key? Manage it on the <a href="/keys">keys page</a>.</div>
</div>
<div class="card hero ss">
  <strong>Fastest — one command</strong> <span class="muted">— adds the status line, keeps your model</span>
  <pre><span class="copy" data-copy="#oneliner">copy</span><span id="oneliner" class="key"></span></pre>
  <div class="note">Issues a key and adds a live-earnings status line — <strong>your model and inference are untouched</strong>. Then run <code>claude</code>. Add <code>--wallet &lt;addr&gt;</code> for payouts, or <code>--route</code> to also route through Shipyard for savings.</div>
</div>
<div class="divider ss">— optional · route through Shipyard for cheaper inference —</div>
<div class="card ss">
  <div class="row">
    <div><label for="wallet">Payout wallet (optional)</label><input id="wallet" placeholder="Solana address — where rebates + kickbacks settle"/></div>
    <div style="flex:0"><button id="gen">Generate key</button></div>
  </div>
  <div class="note">No signup. The key is shown once — copy it now. It ties your IDE traffic to your wallet.</div>
</div>
<div id="out" class="hidden">
  <div class="k">Your API key (shown once)</div>
  <pre><span class="copy" data-copy="#keyval">copy</span><span id="keyval" class="key"></span></pre>
  <div class="k">Base URL</div>
  <pre><span class="copy" data-copy="#baseurl">copy</span><span id="baseurl"></span></pre>
  <div class="card">
    <strong>Claude Code</strong> <span class="muted">— optional · routes your model through Shipyard (Anthropic Messages API)</span>
    <pre><span class="copy" data-copy="#claude">copy</span><span id="claude"></span></pre>
  </div>
  <div class="card">
    <strong>Cursor</strong> <span class="muted">— Settings → Models → OpenAI API Key: “Override base URL”</span>
    <pre><span class="copy" data-copy="#cursor">copy</span><span id="cursor"></span></pre>
  </div>
  <div class="card">
    <strong>Continue.dev</strong> <span class="muted">— ~/.continue/config.json</span>
    <pre><span class="copy" data-copy="#cont">copy</span><span id="cont"></span></pre>
  </div>
  <div class="card">
    <strong>Any OpenAI SDK / env</strong>
    <pre><span class="copy" data-copy="#env">copy</span><span id="env"></span></pre>
  </div>
  <p class="note">Track your savings + kickbacks on the <a href="/me" id="meline">earnings page</a>.</p>
</div>
<script>
const base = location.origin + '/v1';
const $=s=>document.querySelector(s);
$('#oneliner').textContent='npx shipyard-inference connect --url '+location.origin;
$('#gen').addEventListener('click', async ()=>{
  $('#gen').disabled=true; $('#gen').textContent='Generating…';
  try{
    const r=await fetch('/api/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet:$('#wallet').value.trim()||undefined})});
    const d=await r.json();
    $('#keyval').textContent=d.key;
    $('#baseurl').textContent=base;
    $('#claude').textContent='export ANTHROPIC_BASE_URL="'+location.origin+'"\\nexport ANTHROPIC_AUTH_TOKEN="'+d.key+'"\\nclaude';
    $('#cursor').textContent='Base URL: '+base+'\\nAPI Key:  '+d.key;
    $('#cont').textContent=JSON.stringify({models:[{title:'Shipyard',provider:'openai',model:'auto',apiBase:base,apiKey:d.key}]},null,2);
    $('#env').textContent='export OPENAI_BASE_URL="'+base+'\\nexport OPENAI_API_KEY="'+d.key+'"';
    $('#meline').href='/me?key='+encodeURIComponent(d.key);
    $('#out').classList.remove('hidden');
  }catch(e){alert('Could not generate a key: '+e.message)}
  $('#gen').disabled=false; $('#gen').textContent='Generate key';
});
document.addEventListener('click',e=>{const b=e.target.closest('.copy');if(!b)return;navigator.clipboard.writeText($(b.dataset.copy).textContent);b.textContent='copied';setTimeout(()=>b.textContent='copy',1200)});
</script></div></body></html>`

// "Your earnings" — a single-developer view of routing savings (live) +
// idle-attention kickbacks, styled like the operator console. Key-authed.
const ME_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Usage &amp; ledger · Shipyard Inference</title>
${TERMINAL_FONTS}
<style>${TERMINAL_CSS}
.k{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:8px}
@media(max-width:680px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpis .card{margin:0}
.v{font:600 25px/1 var(--mono);color:var(--fg)}.v.good{color:var(--green)}.v.accent{color:var(--term2)}
.sub2{color:var(--dim);font-size:12px;margin-top:6px;font-family:var(--mono)}
.loadrow{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.loadrow input{flex:1;min-width:240px}.loadrow button{margin-top:0}
</style></head><body><div class="wrap">
${navHtml('me')}
<span class="pill"><span class="blip"></span> live · per-key</span>
<h1>Usage <em class="grad">&amp; ledger.</em></h1>
<p class="sub">Every request through your key — what it cost, what it saved vs baseline, and where it settled. Pay per call in USDC; no subscription anywhere in the loop.</p>
<div class="loadrow">
  <input id="key" placeholder="sk-shipyard-… (your API key)"/>
  <button id="load">Load</button>
</div>
<div id="out" class="hidden">
  <section class="kpis">
    <div class="card"><div class="k">Routing saved</div><div class="v good" id="saved">$0</div><div class="sub2"><span id="savedpct">0</span>% vs baseline</div></div>
    <div class="card"><div class="k">Spent</div><div class="v" id="spent">$0</div><div class="sub2">actual routed cost</div></div>
    <div class="card"><div class="k">Requests</div><div class="v" id="reqs">0</div><div class="sub2" id="win">last 24h</div></div>
    <div class="card"><div class="k">Kickbacks <span class="muted">· beta</span></div><div class="v accent" id="kick">$0</div><div class="sub2" id="kicknote">idle-time sponsored placements</div></div>
  </section>
  <div class="panel">
    <div class="k">Account</div>
    <div class="muted" id="acct"></div>
    <div class="k" style="margin-top:14px">Net inference cost</div>
    <div class="v" id="net" style="font-size:20px">$0</div>
    <div class="sub2">spent − kickbacks. Negative means your wait-time more than paid for your inference.</div>
    <div style="margin-top:16px"><button id="claim" disabled>Claim kickbacks → wallet</button></div>
    <div class="note" id="claimmsg"></div>
  </div>
</div>
<script>
const $=s=>document.querySelector(s);const f=(n)=>'$'+(Number(n)||0).toFixed(6);
const url=new URL(location.href);if(url.searchParams.get('key'))$('#key').value=url.searchParams.get('key');
async function load(){
  const key=$('#key').value.trim();if(!key)return;
  $('#load').disabled=true;
  try{
    const r=await fetch('/api/me',{headers:{authorization:'Bearer '+key}});
    if(!r.ok){alert('Could not load — is the key valid?');return}
    const d=await r.json();
    $('#saved').textContent=f(d.savedUsd);$('#savedpct').textContent=d.savedPct;
    $('#spent').textContent=f(d.spentUsd);
    $('#kick').textContent=f(d.kickbacksUsd);
    $('#reqs').textContent=d.requests;
    $('#net').textContent=f((d.spentUsd||0)-(d.kickbacksUsd||0));
    $('#acct').textContent=d.account.userId+(d.account.wallet?(' · '+d.account.wallet):' · no payout wallet set');
    if(!d.kickbacksUsd)$('#kicknote').textContent='accrues on routed, attested traffic';
    $('#claim').disabled=!(d.kickbacksUsd>0 && d.account.wallet);
    if(d.kickbacksUsd>0 && !d.account.wallet)$('#claimmsg').textContent='set a payout wallet: reconnect with --wallet <addr>';
    $('#out').classList.remove('hidden');
  }finally{$('#load').disabled=false}
}
async function claim(){
  const key=$('#key').value.trim();if(!key)return;
  $('#claim').disabled=true;$('#claimmsg').textContent='Sweeping on-chain…';
  try{
    const r=await fetch('/api/tender/claim',{method:'POST',headers:{authorization:'Bearer '+key}});
    const d=await r.json();
    if(!r.ok){$('#claimmsg').textContent='✗ '+(d.error||'failed');$('#claim').disabled=false;}
    else{$('#claimmsg').innerHTML='<span class="green">✓ Paid $'+d.amountUsdc+' USDC to '+d.wallet.slice(0,6)+'… · <a target="_blank" href="https://explorer.solana.com/tx/'+d.signature+'?cluster=devnet">view tx ↗</a></span>';load();}
  }catch(e){$('#claimmsg').textContent='✗ '+e.message;$('#claim').disabled=false;}
}
$('#claim').addEventListener('click',claim);
$('#load').addEventListener('click',load);
if($('#key').value)load();
</script></div></body></html>`

// ---------------------------------------------------------------------------
// The combined app.
// Advertiser onboarding page — symmetric to /connect. Set a line + x402
// destination + a per-block bid, and the campaign enters the live first-price
// auction immediately. Settlement is USDC on Solana (not "Stripe, coming soon").
const ADVERTISE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Advertise · Shipyard Tender</title>
${TERMINAL_FONTS}
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
<style>${TERMINAL_CSS}
.wrap{max-width:780px}
.paygrid{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px}.fields{flex:1;min-width:240px}
.qr{display:block;margin-top:12px;border-radius:10px;background:#e8edf3}
.addr{font-family:var(--mono);font-size:12px;background:#040814;border:1px solid var(--line2);border-radius:8px;padding:8px 10px;word-break:break-all;margin-bottom:6px}
.prevcap{font-family:var(--mono);font-size:11px;color:var(--muted);margin:14px 0 6px;text-transform:uppercase;letter-spacing:.08em}
.prev{background:#040814;border:1px solid var(--line2);border-radius:9px;padding:11px 13px;font:13px/1.7 var(--mono)}
.prev .pstar{color:var(--amber)}.prev .pmut{color:var(--dim)}.prev .pverb{color:var(--amber);font-weight:600}
</style></head><body><div class="wrap">
${navHtml('advertise')}
<span class="pill"><span class="blip"></span> first-price auction · USDC settlement · agentic clicks</span>
<h1>Advertise on the wait.</h1>
<p class="sub">Your line becomes the agent's <strong>spinner</strong> while it thinks — never in the prompt, never in context. Developers keep <strong>50%</strong> of every dollar. A "click" is an agent actually calling your x402 endpoint; highest bid serves first.</p>
<div class="card">
  <label for="logo">Logo <span class="muted">— a glyph/emoji that leads your line (optional)</span></label><input id="logo" maxlength="4" placeholder="🟨" style="max-width:120px"/>
  <label for="line">Creative — the sponsored line <span id="cc" class="muted"></span></label><input id="line" maxlength="80" placeholder="Try Acme Vector DB — first 1M vectors free"/>
  <div class="prevcap">Spinner preview — your line becomes the spinner while the agent thinks</div>
  <div class="prev" id="prev"><span class="pstar">✶</span> <span id="plogo" class="pverb"></span><span id="pline" class="pverb"></span><span class="pmut">… (3s · ↓ 91 tokens · thinking)</span></div>
  <label for="url">Destination — your x402 endpoint (a "click" calls it)</label><input id="url" placeholder="https://api.shipyard.market/x402/your-listing"/>
  <div class="grid">
    <div><label for="bid">Bid · USDC per 1,000 impressions</label><input id="bid" value="5"/></div>
    <div><label for="blocks">Blocks (× 1,000 impressions)</label><input id="blocks" value="1"/></div>
  </div>
  <label for="wallet">Advertiser wallet (optional · escrow source)</label><input id="wallet" placeholder="Solana address"/>
  <button id="go">Create campaign</button>
  <div class="note" id="est"></div>
  <div class="note" id="msg"></div>
</div>
<div class="card" id="pay" style="display:none">
  <strong>Fund with USDC</strong> <span class="muted">— pay the deposit and the campaign goes live automatically</span>
  <div id="paybody"></div>
</div>
<div class="card">
  <strong>Live inventory</strong> <span class="muted">— what's serving now</span>
  <table><thead><tr><th>Line</th><th>Bid /imp</th><th>Impressions left</th><th>Funded</th></tr></thead><tbody id="rows"></tbody></table>
</div>
<p class="note">Settlement is USDC on Solana via Paybox/x402 — payouts work today, no "coming soon." Consumer side: <a href="/connect">connect your IDE →</a> · <a href="/dashboard/">live dashboard →</a></p>
<script>
const $=s=>document.querySelector(s);
function esc(s){return (s||'').replace(/</g,'&lt;');}
function est(){const b=Number($('#bid').value)||0,n=Math.max(1,Math.floor(Number($('#blocks').value)||1));$('#cc').textContent=$('#line').value.length+'/80';$('#est').textContent=b>0?('= '+(n*1000).toLocaleString()+' impressions · $'+(b*n).toFixed(2)+' total · highest bid serves first'):'';var lg=$('#logo').value.trim();$('#plogo').textContent=lg?lg+' ':'';$('#pline').textContent=$('#line').value||$('#line').placeholder;}
['#bid','#blocks','#line','#logo'].forEach(s=>$(s).addEventListener('input',est));est();
function safeUrl(u){u=String(u||'');return /^https?:\/\//i.test(u)?u.replace(/"/g,'%22'):'';}
async function refresh(){const d=await(await fetch('/api/campaigns')).json();$('#rows').innerHTML=(d.campaigns||[]).map(function(c){var u=safeUrl(c.endpointUrl);var label=esc(c.line);var cell=u?('<a href="'+u+'" target="_blank" rel="noopener">'+label+' ↗</a>'):label;return '<tr><td>'+cell+'</td><td class="mono">$'+c.usdcPerImpression+'</td><td class="mono">'+(c.remainingImpressions||0).toLocaleString()+'</td><td class="mono">$'+Number(c.fundedUsdc||0).toFixed(2)+'</td></tr>';}).join('');}
let pollTimer=null;
function stopPoll(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
function poll(id){stopPoll();pollTimer=setInterval(async function(){try{const r=await fetch('/api/campaigns/'+id+'/verify',{method:'POST'});const d=await r.json();if(d.status==='active'){stopPoll();$('#paystatus').innerHTML='<span class="green">✓ Payment confirmed — campaign is live'+(d.signature?(' · tx '+d.signature.slice(0,10)+'…'):'')+'</span>';refresh();}}catch(e){}},4000);}
// Pay with WHATEVER wallet the advertiser has. Modern Solana wallets (Phantom,
// Solflare, Backpack, Glow, Coinbase, …) register via the Wallet Standard, so we
// enumerate those and show a button per wallet. Fallbacks: a legacy window.solana
// provider, and the solana: deep link + QR (mobile / no extension). The browser
// builds the USDC transfer and tags it with the campaign reference so the
// gateway's on-chain verifier finds exactly this deposit.
function rpcFor(net){return net==='mainnet'?'https://api.mainnet-beta.solana.com':'https://api.devnet.solana.com';}
async function loadSolana(){
  var web3=await import('https://esm.sh/@solana/web3.js@1.95.3');
  var spl=await import('https://esm.sh/@solana/spl-token@0.4.9?deps=@solana/web3.js@1.95.3');
  return {web3:web3,spl:spl};
}
// USDC transferChecked to the treasury (idempotent dest ATA create) + reference tag.
async function buildTransfer(web3,spl,conn,pay,payer){
  var mint=new web3.PublicKey(pay.usdcMint),treasury=new web3.PublicKey(pay.treasury),reference=new web3.PublicKey(pay.reference);
  var payerAta=await spl.getAssociatedTokenAddress(mint,payer),destAta=await spl.getAssociatedTokenAddress(mint,treasury);
  var atomic=BigInt(Math.round(Number(pay.amountUsdc)*1e6));
  var transferIx=spl.createTransferCheckedInstruction(payerAta,mint,destAta,payer,atomic,6);
  transferIx.keys.push({pubkey:reference,isSigner:false,isWritable:false});
  var bh=await conn.getLatestBlockhash();
  var msg=new web3.TransactionMessage({payerKey:payer,recentBlockhash:bh.blockhash,instructions:[spl.createAssociatedTokenAccountIdempotentInstruction(payer,destAta,treasury,mint),transferIx]}).compileToV0Message();
  return new web3.VersionedTransaction(msg);
}
async function listWallets(){
  try{var mod=await import('https://esm.sh/@wallet-standard/app@1.1.0');var ws=mod.getWallets().get();
    return ws.filter(function(w){return w.chains&&w.chains.some(function(c){return c.indexOf('solana:')===0;})&&w.features['standard:connect']&&(w.features['solana:signAndSendTransaction']||w.features['solana:signTransaction']);});}catch(e){return [];}
}
async function payWithStandard(wallet,pay){
  var s=await loadSolana();var conn=new s.web3.Connection(rpcFor(pay.network),'confirmed');
  var cr=await wallet.features['standard:connect'].connect();var acct=(cr&&cr.accounts&&cr.accounts[0])||wallet.accounts[0];
  var payer=new s.web3.PublicKey(acct.publicKey);
  var tx=await buildTransfer(s.web3,s.spl,conn,pay,payer);
  var chain='solana:'+(pay.network==='mainnet'?'mainnet':'devnet');
  var b58=(await import('https://esm.sh/bs58@5')).default;
  if(wallet.features['solana:signAndSendTransaction']){
    var out=await wallet.features['solana:signAndSendTransaction'].signAndSendTransaction({account:acct,chain:chain,transaction:tx.serialize()});
    return b58.encode(out[0].signature);
  }
  var sg=await wallet.features['solana:signTransaction'].signTransaction({account:acct,chain:chain,transaction:tx.serialize()});
  return await conn.sendRawTransaction(sg[0].signedTransaction);
}
async function payWithLegacy(pay){
  var provider=(window.phantom&&window.phantom.solana)?window.phantom.solana:window.solana;
  if(!provider||!provider.signAndSendTransaction)throw new Error('No injected wallet');
  var s=await loadSolana();var conn=new s.web3.Connection(rpcFor(pay.network),'confirmed');
  var res=await provider.connect();var pk=(res&&res.publicKey)?res.publicKey:provider.publicKey;
  var tx=await buildTransfer(s.web3,s.spl,conn,pay,new s.web3.PublicKey(pk.toString()));
  var out=await provider.signAndSendTransaction(tx);
  return (out&&out.signature)?out.signature:String(out);
}
function payButton(label,onclick){var b=document.createElement('button');b.textContent=label;b.style.cssText='margin:8px 8px 0 0';b.addEventListener('click',onclick);return b;}
async function renderWallets(pay){
  var box=$('#wallets');box.textContent='Detecting wallets…';
  var ws=await listWallets();box.innerHTML='';
  function run(p,btn){return async function(){if(btn)btn.disabled=true;$('#paystatus').textContent='Opening wallet — approve the transfer…';try{var sig=await p();$('#paystatus').innerHTML='⏳ Sent ('+String(sig).slice(0,10)+'…) — confirming on-chain…';}catch(err){$('#paystatus').innerHTML='<span style="color:#f6a36b">✗ '+esc((err&&err.message)||String(err))+'</span>';if(btn)btn.disabled=false;}};}
  if(ws.length){ws.forEach(function(w){var b=payButton('Pay with '+w.name,null);b.addEventListener('click',run(function(){return payWithStandard(w,pay);},b));box.appendChild(b);});}
  else if(window.solana||(window.phantom&&window.phantom.solana)){var b=payButton('Pay with browser wallet',null);b.addEventListener('click',run(function(){return payWithLegacy(pay);},b));box.appendChild(b);}
  else{box.innerHTML='<span class="muted">No browser wallet detected — scan the QR or send manually.</span>';}
}
function showPayment(campaign,pay){stopPoll();var amt=Number(pay.amountUsdc).toFixed(2);var h=''
  +'<div class="note">Pay <strong>'+amt+' USDC</strong> on <strong>'+pay.network+'</strong> with your wallet below, or scan the QR / send manually. Campaign <span class="mono">'+esc(campaign.campaignId)+'</span> goes live the moment the transfer confirms.</div>'
  +'<div id="wallets" class="note"></div>'
  +'<div class="paygrid"><div><a class="btn" id="open" href="'+pay.url+'">Open in wallet (mobile)</a><canvas id="qrc" class="qr" width="200" height="200"></canvas></div>'
  +'<div class="fields"><label>Treasury · USDC '+pay.network+'</label><div class="addr">'+esc(pay.treasury)+'</div>'
  +'<label>Amount</label><div class="addr">'+amt+' USDC</div>'
  +'<label>Reference (tagged on your transfer)</label><div class="addr">'+esc(pay.reference)+'</div></div></div>'
  +'<div class="note" id="paystatus">⏳ Waiting for payment…</div>';
  $('#paybody').innerHTML=h;$('#pay').style.display='block';
  try{if(typeof QRCode!=='undefined'){QRCode.toCanvas(document.getElementById('qrc'),pay.url,{width:200,margin:1});}}catch(e){}
  renderWallets(pay);
  poll(campaign.campaignId);$('#pay').scrollIntoView({behavior:'smooth'});}
$('#go').addEventListener('click',async()=>{$('#go').disabled=true;$('#msg').textContent='';try{const r=await fetch('/api/campaigns',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({line:(($('#logo').value.trim()?$('#logo').value.trim()+' ':'')+$('#line').value),endpointUrl:$('#url').value,bidPerBlockUsdc:Number($('#bid').value),blocks:Number($('#blocks').value),advertiserWallet:$('#wallet').value.trim()||undefined})});const d=await r.json();if(!r.ok){$('#msg').textContent='✗ '+(d.error||'failed')}else if(d.payment){$('#msg').innerHTML='<span class="green">✓ Campaign created — fund it below to go live.</span>';showPayment(d.campaign,d.payment);}else{$('#msg').innerHTML='<span class="green">✓ Live — '+d.campaign.remainingImpressions.toLocaleString()+' impressions at $'+d.campaign.usdcPerImpression+' /imp ('+d.campaign.campaignId+')</span>';$('#logo').value='';$('#line').value='';$('#url').value='';est();refresh();}}catch(e){$('#msg').textContent='✗ '+e.message}$('#go').disabled=false;});
refresh();
</script></div></body></html>`

// ---------------------------------------------------------------------------
// "Pricing" — pay per call, nothing else. Real rates straight from the
// gateway's candidate configs (they ARE the source of truth for routing).
// ---------------------------------------------------------------------------
const PRICING_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Pricing · Shipyard Inference</title>
${TERMINAL_FONTS}
<style>${TERMINAL_CSS}
.wrap{max-width:840px}
.big{font:600 clamp(30px,4.4vw,42px)/1.1 var(--serif);letter-spacing:-.015em;margin:0 0 8px}
.big em{font-style:italic;font-weight:400;color:var(--term)}
.feat{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}
@media(max-width:680px){.feat{grid-template-columns:1fr}}
.feat .card{margin:0;text-align:left}
.feat .fv{font:600 22px/1 var(--serif);color:var(--term);margin-bottom:6px}
.feat .fk{font-family:var(--mono);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.tier{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--line2);border-radius:999px;padding:2px 9px;color:var(--term2)}
</style></head><body><div class="wrap">
${navHtml('pricing')}
<span class="pill"><span class="blip"></span> pay per call · usdc on solana · no subscription</span>
<h1 class="big">Pay per call. <em>Nothing else.</em></h1>
<p class="sub">No seats, no tiers, no markup. Every request settles in USDC over x402 at the provider's own rate — and routing picks the cheapest capable model, so the price you see is the price after the savings.</p>
<div class="feat">
  <div class="card"><div class="fv">$0.00</div><div class="fk">subscription fee</div></div>
  <div class="card"><div class="fv">−71%</div><div class="fk">typical vs baseline</div></div>
  <div class="card"><div class="fv">0%</div><div class="fk">gateway markup</div></div>
</div>
<div class="card">
  <strong>Routed model rates</strong> <span class="muted">— per 1M tokens, live from the gateway's candidate configs. These are the exact numbers routing decisions are made on.</span>
  <table>
    <thead><tr><th>Model</th><th>Tier</th><th>Input /1M</th><th>Output /1M</th><th>Context</th></tr></thead>
    <tbody>
      <tr><td class="mono">gpt-4.1-nano</td><td><span class="tier">economy</span></td><td class="mono">$0.10</td><td class="mono">$0.40</td><td class="mono muted">1M</td></tr>
      <tr><td class="mono">claude-haiku-4-5</td><td><span class="tier">economy</span></td><td class="mono">$0.80</td><td class="mono">$4.00</td><td class="mono muted">200k</td></tr>
      <tr><td class="mono">gpt-4.1-mini</td><td><span class="tier">standard</span></td><td class="mono">$0.40</td><td class="mono">$1.60</td><td class="mono muted">1M</td></tr>
      <tr><td class="mono">gpt-4.1</td><td><span class="tier">frontier</span></td><td class="mono">$2.00</td><td class="mono">$8.00</td><td class="mono muted">1M</td></tr>
      <tr><td class="mono">claude-sonnet-4-5</td><td><span class="tier">standard</span></td><td class="mono">$3.00</td><td class="mono">$15.00</td><td class="mono muted">200k</td></tr>
      <tr><td class="mono">local / ollama</td><td><span class="tier">free</span></td><td class="mono">$0.00</td><td class="mono">$0.00</td><td class="mono muted">your hardware</td></tr>
    </tbody>
  </table>
  <p class="note">The <strong>baseline</strong> for savings is a direct call to <code>claude-sonnet-4-5</code> — what the same request would cost at provider list price, called direct. Request <code>model: auto</code> and the gateway tiers down when a cheaper model can handle the work; pin a model and it stays pinned.</p>
</div>
<div class="card">
  <strong>Spend ceilings, per key</strong> <span class="muted">— a runaway agent can't drain you</span>
  <p class="note">Every API key carries its own spend breaker. When a key's recorded spend crosses its ceiling, it returns <code>402</code> with a top-up URL instead of quietly burning budget — and zero-cost local traffic never touches the breaker at all. Give each agent its own key so one drained session can't starve the others.</p>
</div>
<div class="card">
  <strong>Settlement</strong> <span class="muted">— USDC on Solana, over x402</span>
  <p class="note">Each request settles independently — no float, no invoice, no "Stripe, coming soon." Watch every cent land in real time on the <a href="/dashboard/">operator command center</a>, or track your own key on the <a href="/me">usage &amp; ledger</a> page.</p>
</div>
<p class="note" style="opacity:.75">Coming later: earn on the wait — sponsored placements on agent idle time. <a href="/advertise">Advertiser? Get in early →</a></p>
</div></body></html>`

// ---------------------------------------------------------------------------
const app = new Hono()
app.use('*', cors({ origin: '*' }))
const x402Cfg = x402Config(process.env)
app.get('/healthz', (c) => c.json({ status: 'ok', source: SOURCE, candidates: candidates.map((c) => c.id), persistent: Boolean(store), x402: x402Cfg ? { priceUsdc: x402Cfg.priceUsdc, network: x402Cfg.network, treasury: x402Cfg.treasury } : null }))

// Landing page at `/`. Registered before the operator mount so it wins over the
// operator's static catch-all (which otherwise serves the dashboard SPA here).
// The dashboard SPA itself is served from /dashboard/ as static CDN assets.
app.get('/', (c) => c.html(LANDING_HTML))
// Manifesto page at `/manifesto` — the Death to Tokenmaxxing thesis post.
app.get('/manifesto', (c) => c.html(MANIFESTO_HTML))

// Consumer surface — the "connect your IDE" page + self-serve key issuance.
// Registered before the operator's /api/* mount so it wins, and before the
// hub.boot middleware so issuing a key doesn't replay telemetry.
app.get('/connect', (c) => c.html(closedPage(CONNECT_HTML, SELF_SERVE_KEYS)))
app.get('/pricing', (c) => c.html(PRICING_HTML))
app.get('/manifesto', (c) => c.html(MANIFESTO_HTML))
app.get('/me', (c) => c.html(ME_HTML))
app.post('/api/keys', async (c) => {
  if (!canMintKey({ open: SELF_SERVE_KEYS, operatorTokens: OPERATOR_TOKENS, authHeader: c.req.header('authorization') })) {
    return c.json(SELF_SERVE_CLOSED_BODY, 403)
  }
  const body = (await c.req.json().catch(() => ({}))) as { wallet?: unknown; label?: unknown }
  const wallet = typeof body.wallet === 'string' && body.wallet.trim() ? body.wallet.trim() : undefined
  const label = typeof body.label === 'string' ? body.label.slice(0, 64) : undefined
  const { key, account } = await keyStore.issue({ wallet, label }, Date.now())
  return c.json({
    key,
    userId: account.userId,
    wallet: account.wallet ?? null,
    createdAt: account.createdAt,
    id: account.keyId ?? null,
    label: account.label ?? null,
  })
})

// Developer key management — the bearer key is the developer's identity; every
// action is scoped to that key's project. Registered before the /api/* hub
// middleware and the operator mount so these stay fast and developer-owned.
app.get('/keys', (c) => c.html(closedPage(KEYS_HTML, SELF_SERVE_KEYS)))
const devCaller = async (c: Context) => {
  const auth = await resolveAuth({ keyStore }, c.req.header('authorization'))
  return auth.ok && auth.account ? auth.account : undefined
}
const devUnauthorized = { error: 'Paste an active Shipyard API key to manage your keys.' }
app.get('/api/dev/keys', async (c) => {
  const caller = await devCaller(c)
  if (!caller) return c.json(devUnauthorized, 401)
  const r = await listDevKeys(keyStore, caller)
  return c.json(r.body, r.status as 200)
})
app.post('/api/dev/keys', async (c) => {
  const caller = await devCaller(c)
  if (!caller) return c.json(devUnauthorized, 401)
  if (!SELF_SERVE_KEYS) return c.json(SELF_SERVE_CLOSED_BODY, 403)
  const body = (await c.req.json().catch(() => ({}))) as { label?: unknown }
  const r = await createDevKey(keyStore, caller, body)
  return c.json(r.body, r.status as 201)
})
app.post('/api/dev/keys/:id/revoke', async (c) => {
  const caller = await devCaller(c)
  if (!caller) return c.json(devUnauthorized, 401)
  const r = await revokeDevKey(keyStore, caller, c.req.param('id'))
  return c.json(r.body, r.status as 200)
})
app.patch('/api/dev/keys/:id', async (c) => {
  const caller = await devCaller(c)
  if (!caller) return c.json(devUnauthorized, 401)
  const body = (await c.req.json().catch(() => ({}))) as { label?: unknown }
  const r = await relabelDevKey(keyStore, caller, c.req.param('id'), body)
  return c.json(r.body, r.status as 200)
})

// Advertiser surface — self-serve sponsored campaigns (the other side of the
// marketplace). Symmetric to /connect. Registered before the /api/* hub-boot
// middleware so listing/creating a campaign doesn't replay telemetry.
const IMPRESSIONS_PER_BLOCK = 1000
app.get('/advertise', (c) => c.html(ADVERTISE_HTML))
// Live inventory = funded (active) campaigns only — pending ones aren't serving.
app.get('/api/campaigns', async (c) => {
  await ensureCampaigns()
  const rows = await campaignStore.list().catch(() => [])
  return c.json({ campaigns: rows.filter(isCampaignActive), paymentsEnabled: Boolean(depositConfig) })
})
app.post('/api/campaigns', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  // Blocks model (1 block = 1,000 impressions): accept a per-block bid + block
  // count, or fall back to raw per-impression price + budget.
  let usdcPerImpression = Number(body.usdcPerImpression)
  let fundedUsdc = Number(body.fundedUsdc)
  if (body.bidPerBlockUsdc != null) {
    const bidPerBlock = Number(body.bidPerBlockUsdc)
    const blocks = Math.max(1, Math.floor(Number(body.blocks) || 1))
    usdcPerImpression = bidPerBlock / IMPRESSIONS_PER_BLOCK
    fundedUsdc = bidPerBlock * blocks
  }
  let campaign
  try {
    campaign = buildCampaign(
      {
        line: typeof body.line === 'string' ? body.line : '',
        endpointUrl: typeof body.endpointUrl === 'string' ? body.endpointUrl : '',
        advertiserWallet:
          (typeof body.advertiserWallet === 'string' && body.advertiserWallet.trim()) ||
          `TenderSelfServe${randomBytes(12).toString('hex')}`,
        usdcPerImpression,
        fundedUsdc,
        targeting: body.targeting && typeof body.targeting === 'object' ? (body.targeting as Record<string, unknown>) : {},
        // With a treasury configured the campaign must be paid before it serves.
        status: depositConfig ? 'pending' : 'active',
        paymentReference: depositConfig ? newPaymentReference() : undefined,
      },
      Date.now(),
    )
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400)
  }
  await campaignStore.create(campaign).catch(() => {})

  if (depositConfig && campaign.paymentReference) {
    // Hand back the Solana Pay deposit intent; the campaign goes live only once
    // /verify confirms the USDC landed. Do NOT add it to the auction yet.
    const payment = buildDepositIntent(depositConfig, {
      amountUsdc: campaign.fundedUsdc,
      reference: campaign.paymentReference,
      label: 'Shipyard Tender',
      message: `Fund campaign ${campaign.campaignId}`,
    })
    return c.json({ campaign, payment })
  }
  gatewayTender.addCampaign(campaign) // no treasury → serve immediately
  return c.json({ campaign })
})

// Poll for an advertiser's USDC deposit. Once the on-chain transfer to the
// treasury (tagged with the campaign's reference) is confirmed, flip the
// campaign to `active` and add it to the live auction. Idempotent.
app.post('/api/campaigns/:id/verify', async (c) => {
  if (!depositConfig) return c.json({ error: 'payments not configured' }, 400)
  const id = c.req.param('id')
  const campaign = await campaignStore.get(id).catch(() => undefined)
  if (!campaign) return c.json({ error: 'campaign not found' }, 404)
  if (isCampaignActive(campaign)) return c.json({ status: 'active', campaign })
  if (!campaign.paymentReference) return c.json({ error: 'campaign has no payment reference' }, 400)

  let result
  try {
    result = await verifyDeposit(depositConfig, campaign.paymentReference, campaign.fundedUsdc)
  } catch (err) {
    return c.json({ status: 'pending', error: err instanceof Error ? err.message : String(err) }, 502)
  }
  if (!result.paid) return c.json({ status: 'pending' })

  const updated =
    (await campaignStore
      .update(id, { status: 'active', paidSignature: result.signature })
      .catch(() => undefined)) ?? { ...campaign, status: 'active' as const, paidSignature: result.signature }
  gatewayTender.addCampaign(updated) // live on this instance immediately
  return c.json({ status: 'active', campaign: updated, signature: result.signature })
})

// Gateway — ensure advertiser campaigns are loaded into the auction (so a
// request's wait can be monetized), then flush telemetry to Supabase before the
// function freezes. (The reporter also auto-flushes on its 2s timer mid-stream.)
app.use('/v1/*', async (c, next) => {
  await ensureCampaigns()
  await next()
  keepAlive(reporter.flush())
})
app.route('/', gateway)

// Dashboard API — rebuild aggregates from Supabase for each read.
app.use('/api/*', async (c, next) => {
  if (store) await hub.boot()
  await next()
})

// A developer's own earnings — routing savings (live, per-user from the hub) +
// idle-attention kickbacks. Key-authed; registered after the hub-boot middleware
// (so it has data) and before the operator mount (so it isn't swallowed).
app.get('/api/me', async (c) => {
  const auth = await resolveAuth({ keyStore }, c.req.header('authorization'))
  if (!auth.ok || !auth.account) {
    return c.json({ error: 'invalid or missing API key' }, 401)
  }
  const r6 = (n: number): number => Math.round((n + Number.EPSILON) * 1e6) / 1e6
  const windowMs = Number(c.req.query('windowMs') ?? 24 * 60 * 60 * 1000)
  // Usage is attributed to the key's project (projectId ?? userId), so every key in a
  // developer's project sees the project's shared usage.
  const usageKey = auth.account.projectId ?? auth.account.userId
  const row = hub.breakdown('user', windowMs).find((x) => x.key === usageKey)
  const spent = row?.actualCostUsd ?? 0
  const baseline = row?.baselineCostUsd ?? 0
  const saved = row?.savedUsd ?? 0
  return c.json({
    account: {
      userId: auth.account.userId,
      wallet: auth.account.wallet ?? null,
      label: auth.account.label ?? null,
    },
    windowMs,
    requests: row?.requests ?? 0,
    spentUsd: r6(spent),
    baselineUsd: r6(baseline),
    savedUsd: r6(saved),
    savedPct: baseline > 0 ? Math.round((saved / baseline) * 100) : 0,
    // Kickbacks accrued on this account's own (billed, attested) traffic, and the
    // sponsored line currently served to it — rendered in the status line. Durable.
    kickbacksUsd: r6(await gatewayTender.balance(auth.account.userId)),
    sponsoredLine: (await gatewayTender.currentLine(auth.account.userId)) ?? null,
  })
})

// Sweep accrued kickbacks on-chain to the account's wallet as USDC. Records a
// matching debit so the ledger balance nets out (no double-claim). Payout is
// signed by the gateway's dedicated payout keypair — lazily imported so
// @solana/web3.js never touches the boot path.
// Report a spinner impression — the ad was shown during a wait. Accrues the
// requester's 50% against the served (top-bid) campaign's funded budget, WITHOUT
// routing inference: the impression happens in the IDE's spinner regardless of
// where inference runs. Anti-abuse: per-account rate limit + the advertiser
// budget cap (payouts can never exceed funded inventory). Softer than the routed
// attestation, which stays as a stronger signal when a user does route.
const IMPRESSION_MIN_MS = Number(process.env.TENDER_IMPRESSION_MIN_MS ?? 5000)
const REQUESTER_SHARE = 0.5
const lastImpressionAt = new Map<string, number>()
app.post('/api/tender/impression', async (c) => {
  const auth = await resolveAuth({ keyStore }, c.req.header('authorization'))
  if (!auth.ok || !auth.account) return c.json({ error: 'unauthorized' }, 401)
  const acct = auth.account.userId
  const now = Date.now()
  if (now - (lastImpressionAt.get(acct) ?? 0) < IMPRESSION_MIN_MS) return c.json({ accrued: 0, throttled: true })
  await ensureCampaigns()
  const live = (await campaignStore.list().catch(() => []))
    .filter(isCampaignActive)
    .filter((x) => (x.remainingImpressions ?? 0) > 0)
    .sort((a, b) => b.usdcPerImpression - a.usdcPerImpression) // first-price: highest bid serves
  const camp = live[0]
  if (!camp) return c.json({ accrued: 0, reason: 'no funded inventory' })
  lastImpressionAt.set(acct, now)
  const share = camp.usdcPerImpression * REQUESTER_SHARE
  await tenderCreditStore
    .accrue({ account: acct, amountUsd: share, placementId: camp.placementId, line: camp.line, requestId: `imp_${now}`, at: now })
    .catch(() => {})
  // Draw down the advertiser's funded budget (the hard cap on total payouts).
  await campaignStore
    .update(camp.campaignId, {
      remainingImpressions: (camp.remainingImpressions ?? 1) - 1,
      fundedUsdc: Math.max(0, (camp.fundedUsdc ?? 0) - camp.usdcPerImpression),
    })
    .catch(() => {})
  const r6i = (n: number): number => Math.round((n + Number.EPSILON) * 1e6) / 1e6
  return c.json({ accrued: r6i(share), line: camp.line, campaignId: camp.campaignId })
})

const MIN_CLAIM_USDC = Number(process.env.TENDER_MIN_CLAIM_USDC ?? 0.0005)
app.post('/api/tender/claim', async (c) => {
  const r6 = (n: number): number => Math.round((n + Number.EPSILON) * 1e6) / 1e6
  const auth = await resolveAuth({ keyStore }, c.req.header('authorization'))
  if (!auth.ok || !auth.account) return c.json({ error: 'unauthorized' }, 401)
  const wallet = auth.account.wallet
  if (!wallet) return c.json({ error: 'no payout wallet on this key — reconnect with --wallet <addr>' }, 400)
  const balanceUsd = await gatewayTender.balance(auth.account.userId)
  if (!(balanceUsd >= MIN_CLAIM_USDC)) return c.json({ error: 'nothing to claim yet', balanceUsd: r6(balanceUsd) }, 400)

  let result
  try {
    const payout = await import('./dist/tender/payout.js')
    const cfg = payout.loadPayoutConfig(process.env)
    if (!cfg) return c.json({ error: 'payouts not configured on this gateway' }, 503)
    result = await payout.payoutUsdc(cfg, wallet, balanceUsd)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502)
  }

  // Debit the swept amount (negative accrual) so balance() nets to ~0.
  await tenderCreditStore
    .accrue({ account: auth.account.userId, amountUsd: -balanceUsd, placementId: 'payout', line: `payout ${result.signature}`, requestId: result.signature, at: Date.now() })
    .catch(() => {})

  return c.json({ paid: true, amountUsdc: r6(balanceUsd), wallet, signature: result.signature })
})

// ---------------------------------------------------------------------------
// Chat portal — the Paybox-wallet chat UI, mounted at /portal. It's a plain
// .mjs Hono app (examples/chat-portal/server.mjs); import it lazily inside a
// sub-app so the TS bundler treats it as a runtime import, and the heavy
// portal deps (pay-kit, @paybox-sh/sdk) only load when /portal is hit.
// ---------------------------------------------------------------------------
import { Hono as _Hono } from 'hono'
const portalMount = new _Hono()
// /portal (no trailing slash) → /portal/, so the page's relative asset and
// API paths resolve under the mount instead of the site root.
portalMount.get('/', (c) => c.redirect('/portal/'))
portalMount.all('*', async (c) => {
  // Plain-JS portal app outside src/ — the bundler resolves and traces this
  // fine at build time; only bare 'tsc app.ts' (framework preset's type
  // check, script mode without a tsconfig) cannot, hence the ignore.
  // @ts-ignore -- runtime .mjs import, bundled by Vercel's esbuild
  // ('./examples' resolves from the repo root locally AND from the bundled
  // function root on Vercel, where build-web copies the portal tree.)
  const { portalApp } = await import('./examples/chat-portal/server.mjs')
  // The portal sees clean paths: strip the /portal mount prefix from the
  // request URL (Hono hands us the raw Request with the full path), and
  // re-add it to any Location redirects so OAuth round-trips stay under /portal.
  const url = new URL(c.req.url)
  const path = url.pathname.replace(/^\/portal/, '') || '/'
  const req = new Request(new URL(path + url.search, url.origin), c.req.raw)
  // Tell the portal it's mounted (OAuth redirect URIs need the /portal prefix)
  req.headers.set('x-portal-prefix', '/portal')
  const res = await portalApp.fetch(req)
  const location = res.headers.get('location')
  if (location && location.startsWith('/')) {
    const headers = new Headers(res.headers)
    headers.set('location', '/portal' + location)
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }
  return res
})
app.route('/portal', portalMount)

app.route('/', operator)



export default app
