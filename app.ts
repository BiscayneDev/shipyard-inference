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
import { waitUntil } from '@vercel/functions'
// Imported from the built SDK (./dist) via relative paths so the entrypoint
// resolves deterministically under Vercel's bundler — `npm run build` runs first.
import {
  AnthropicProvider,
  OpenAIProvider,
  createOpenRouterProvider,
  createUsePodProvider,
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
  type CampaignStore,
} from './dist/index.js'
import {
  createGatewayApp,
  resolveAuth,
  MemoryApiKeyStore,
  SupabaseApiKeyStore,
  type GatewayConfig,
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

const gateway = createGatewayApp({
  candidates,
  strategy: costOptimized(),
  baselineModel,
  pricingOverrides,
  apiKeys: API_KEYS,
  keyStore,
  tender: gatewayTender,
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
// Shared terminal-vibe design system — one source of truth for every page's
// chrome. Pages embed ${TERMINAL_FONTS} + <style>${TERMINAL_CSS}</style> and
// ${navHtml('<id>')} for the consistent top nav.
// ---------------------------------------------------------------------------
const TERMINAL_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>`

const TERMINAL_CSS = `
:root{--bg:#06080c;--bg2:#0a0e15;--panel:#0c1117;--panel2:#10161f;--line:#1a232f;--line2:#283544;--fg:#e9eef5;--muted:#8a97a8;--dim:#586676;--term:#4fe3c1;--term2:#7c9cff;--amber:#f0a868;--green:#5fe0ac;--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;--sans:"Inter",ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 var(--sans);-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(900px 520px at 80% -10%,rgba(79,227,193,.09),transparent 60%),radial-gradient(700px 460px at 6% 2%,rgba(124,156,255,.07),transparent 55%),linear-gradient(transparent 0 2px,rgba(255,255,255,.012) 2px 3px);background-size:auto,auto,100% 3px}
.wrap{max-width:880px;margin:0 auto;padding:0 26px 70px;position:relative;z-index:1}
a{color:var(--term);text-decoration:none}a:hover{color:var(--fg)}
.mono{font-family:var(--mono)}.muted{color:var(--muted)}.green{color:var(--green)}.hidden{display:none}
.kicker{font-family:var(--mono);font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.tnav{display:flex;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:1px solid var(--line);margin-bottom:30px}
.tnav .brand{font-family:var(--mono);font-weight:500;font-size:15px;color:var(--fg)}
.tnav .brand .sig{color:var(--term)}.tnav .brand .dim{color:var(--dim)}
.tnav .lnk{display:flex;gap:20px;align-items:center}
.tnav .lnk a{font-family:var(--mono);font-size:13px;color:var(--muted)}
.tnav .lnk a:hover{color:var(--term)}.tnav .lnk a.active{color:var(--term)}
@media(max-width:640px){.tnav{flex-direction:column;gap:12px;align-items:flex-start}.tnav .lnk{flex-wrap:wrap;gap:14px}}
h1{font-size:clamp(28px,4.5vw,38px);line-height:1.08;margin:0 0 10px;letter-spacing:-.03em;font-weight:700}
h1 .grad{color:var(--term)}
h2{font-size:clamp(20px,3vw,25px);letter-spacing:-.02em;margin:0 0 6px;font-weight:600}
.sub{font-size:16.5px;color:var(--muted);margin:0 0 24px;line-height:1.6;max-width:640px}
.sub em,.sub strong{color:var(--fg);font-style:normal;font-weight:600}
.lede{color:var(--muted);margin:6px 0 0;max-width:640px}
.seclabel{display:flex;align-items:center;gap:12px;margin:30px 0 16px}.seclabel::after{content:"";flex:1;height:1px;background:var(--line)}
.pill{display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);font-size:11.5px;letter-spacing:.04em;color:var(--term);border:1px solid #1f3a36;background:#0b1714;border-radius:999px;padding:5px 13px;margin-bottom:18px}
.pill .blip{width:7px;height:7px;border-radius:50%;background:var(--term);box-shadow:0 0 9px var(--term);animation:pulse 2.4s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.card,.panel{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:18px 20px;margin:14px 0}
.panel .num{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;color:var(--term);margin-bottom:10px}
.panel h3,.card strong{font-size:15.5px;font-weight:600}
label{display:block;font-family:var(--mono);font-size:11px;color:var(--muted);margin:14px 0 6px;text-transform:uppercase;letter-spacing:.08em}
input,textarea{width:100%;background:#04060a;border:1px solid var(--line2);border-radius:9px;color:var(--fg);padding:11px 12px;font:14px var(--mono)}
input:focus,textarea:focus{outline:none;border-color:var(--term)}
.row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}.row>div{flex:1;min-width:200px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.grid{grid-template-columns:1fr}}
button{appearance:none;border:1px solid transparent;border-radius:10px;font-family:var(--mono);font-weight:500;font-size:13.5px;padding:12px 18px;cursor:pointer;transition:transform .12s ease,border-color .12s ease;margin-top:16px;background:var(--term);color:#032019;box-shadow:0 0 0 1px rgba(79,227,193,.3)}
button:hover{transform:translateY(-1px)}button:disabled{opacity:.45;cursor:default;transform:none;box-shadow:none}
a.btn{display:inline-flex;align-items:center;gap:8px;border-radius:10px;font-family:var(--mono);font-weight:500;font-size:13.5px;padding:11px 17px;border:1px solid var(--line2);color:var(--fg);background:rgba(255,255,255,.02)}
a.btn:hover{border-color:var(--term);color:var(--term)}
a.btn.primary{background:var(--term);color:#032019;border-color:transparent}
pre{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:14px;overflow:auto;font:13px/1.6 var(--mono);color:var(--fg);margin:8px 0 0;position:relative}
code{font-family:var(--mono);color:var(--term)}
.copy{position:absolute;top:8px;right:8px;font-family:var(--mono);font-size:11px;color:var(--muted);background:var(--panel2);border:1px solid var(--line2);border-radius:7px;padding:3px 9px;cursor:pointer;margin:0}.copy:hover{color:var(--term);border-color:var(--term)}
.note{font-size:13px;color:var(--muted);margin-top:10px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line)}th{color:var(--dim);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-family:var(--mono)}td.mono{font-family:var(--mono)}
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
  return `<header class="tnav"><a class="brand" href="/"><span class="sig">◢</span> shipyard <span class="dim">·</span> inference</a><div class="lnk">${link('/connect', 'connect', 'connect')}${link('/advertise', 'advertise', 'advertise')}${link('/me', 'me', 'earnings')}${link('/dashboard/', 'dashboard', 'dashboard')}</div></header>`
}

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
.card.hero{border-color:#1f3a36;background:#0b1714}
.divider{text-align:center;margin:20px 0 6px;font-family:var(--mono);font-size:12px;color:var(--dim);letter-spacing:.03em}
</style></head><body><div class="wrap">
${navHtml('connect')}
<span class="pill"><span class="blip"></span> claude code · cursor · codex · any agent</span>
<h1>Connect Shipyard to your IDE</h1>
<p class="sub">Your idle wait-time earns USDC kickbacks to your wallet — and <strong>your model stays yours</strong>. Routing through Shipyard for cheaper calls is optional.</p>
<div class="card hero">
  <strong>Fastest — one command</strong> <span class="muted">— adds the status line, keeps your model</span>
  <pre><span class="copy" data-copy="#oneliner">copy</span><span id="oneliner" class="key"></span></pre>
  <div class="note">Issues a key and adds a live-earnings status line — <strong>your model and inference are untouched</strong>. Then run <code>claude</code>. Add <code>--wallet &lt;addr&gt;</code> for payouts, or <code>--route</code> to also route through Shipyard for savings.</div>
</div>
<div class="divider">— optional · route through Shipyard for cheaper inference —</div>
<div class="card">
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
  <p class="note">Track your savings + kickbacks on the <a href="/dashboard/">dashboard</a>.</p>
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
    $('#env').textContent='export OPENAI_BASE_URL="'+base+'"\\nexport OPENAI_API_KEY="'+d.key+'"';
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
<title>Your earnings · Shipyard Inference</title>
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
<h1>Your earnings</h1>
<p class="sub">Routing savings on every call, plus idle-attention kickbacks — credited to your wallet.</p>
<div class="loadrow">
  <input id="key" placeholder="sk-shipyard-… (your API key)"/>
  <button id="load">Load</button>
</div>
<div id="out" class="hidden">
  <section class="kpis">
    <div class="card"><div class="k">Routing saved</div><div class="v good" id="saved">$0</div><div class="sub2"><span id="savedpct">0</span>% vs baseline</div></div>
    <div class="card"><div class="k">Spent</div><div class="v" id="spent">$0</div><div class="sub2">actual routed cost</div></div>
    <div class="card"><div class="k">Idle-attention kickbacks</div><div class="v accent" id="kick">$0</div><div class="sub2" id="kicknote">accrues as you work</div></div>
    <div class="card"><div class="k">Requests</div><div class="v" id="reqs">0</div><div class="sub2" id="win">last 24h</div></div>
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
.addr{font-family:var(--mono);font-size:12px;background:#04060a;border:1px solid var(--line2);border-radius:8px;padding:8px 10px;word-break:break-all;margin-bottom:6px}
.prevcap{font-family:var(--mono);font-size:11px;color:var(--muted);margin:14px 0 6px;text-transform:uppercase;letter-spacing:.08em}
.prev{background:#04060a;border:1px solid var(--line2);border-radius:9px;padding:11px 13px;font:13px/1.7 var(--mono)}
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
async function refresh(){const d=await(await fetch('/api/campaigns')).json();$('#rows').innerHTML=(d.campaigns||[]).map(c=>'<tr><td>'+esc(c.line)+'</td><td class="mono">$'+c.usdcPerImpression+'</td><td class="mono">'+(c.remainingImpressions||0).toLocaleString()+'</td><td class="mono">$'+Number(c.fundedUsdc||0).toFixed(2)+'</td></tr>').join('');}
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
const app = new Hono()
app.use('*', cors({ origin: '*' }))
app.get('/healthz', (c) => c.json({ status: 'ok', source: SOURCE, candidates: candidates.map((c) => c.id), persistent: Boolean(store) }))

// Landing page at `/`. Registered before the operator mount so it wins over the
// operator's static catch-all (which otherwise serves the dashboard SPA here).
// The dashboard SPA itself is served from /dashboard/ as static CDN assets.
app.get('/', (c) => c.html(LANDING_HTML))

// Consumer surface — the "connect your IDE" page + self-serve key issuance.
// Registered before the operator's /api/* mount so it wins, and before the
// hub.boot middleware so issuing a key doesn't replay telemetry.
app.get('/connect', (c) => c.html(CONNECT_HTML))
app.get('/me', (c) => c.html(ME_HTML))
app.post('/api/keys', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { wallet?: unknown; label?: unknown }
  const wallet = typeof body.wallet === 'string' && body.wallet.trim() ? body.wallet.trim() : undefined
  const label = typeof body.label === 'string' ? body.label.slice(0, 64) : undefined
  const { key, account } = await keyStore.issue({ wallet, label }, Date.now())
  return c.json({ key, userId: account.userId, wallet: account.wallet ?? null, createdAt: account.createdAt })
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
  const row = hub.breakdown('user', windowMs).find((x) => x.key === auth.account!.userId)
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

app.route('/', operator)

export default app
