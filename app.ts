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
import {
  createGatewayApp,
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

const { candidates, baselineModel } = buildCandidates()

const gateway = createGatewayApp({
  candidates,
  strategy: costOptimized(),
  baselineModel,
  apiKeys: API_KEYS,
  keyStore,
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
// "Connect your IDE" — self-serve key + copy-paste config for any OpenAI-
// compatible IDE. Client-rendered so the baseURL tracks the actual deploy host.
// ---------------------------------------------------------------------------
const CONNECT_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Connect your IDE · Shipyard Inference</title>
<style>
:root{--bg:#06070a;--panel:#0c0e14;--hair:rgba(255,255,255,.10);--text:#f3f5fa;--muted:#99a1b3;--accent:#5b8cff;--green:#2fe0ac;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:48px 22px 80px}
h1{font-size:30px;margin:0 0 6px}.sub{color:var(--muted);margin:0 0 28px}
.card{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:18px 20px;margin:16px 0}
label{display:block;font-size:12px;color:var(--muted);margin:0 0 6px;text-transform:uppercase;letter-spacing:.5px}
input{width:100%;background:#04050a;border:1px solid var(--hair);border-radius:9px;color:var(--text);padding:11px 12px;font:14px var(--mono)}
button{appearance:none;border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:650;padding:11px 18px;cursor:pointer;font-size:15px}
button:hover{filter:brightness(1.08)}button:disabled{opacity:.5;cursor:default}
.row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}.row>div{flex:1;min-width:200px}
pre{background:#04050a;border:1px solid var(--hair);border-radius:10px;padding:13px 14px;overflow:auto;font:13px/1.5 var(--mono);color:#d7def0;margin:8px 0 0;position:relative}
.k{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin:18px 0 4px}
.key{color:var(--green)}.muted{color:var(--muted)}.hidden{display:none}
.copy{position:absolute;top:8px;right:8px;background:rgba(255,255,255,.07);color:var(--muted);font-size:11px;padding:3px 8px;border-radius:6px}
.note{font-size:13px;color:var(--muted);margin-top:10px}a{color:var(--accent)}
</style></head><body><div class="wrap">
<h1>Connect Shipyard to your IDE</h1>
<p class="sub">One OpenAI-compatible endpoint. Routes every request to the cheapest capable model, and your idle wait-time earns kickbacks — both credited to your wallet.</p>
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
$('#gen').addEventListener('click', async ()=>{
  $('#gen').disabled=true; $('#gen').textContent='Generating…';
  try{
    const r=await fetch('/api/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet:$('#wallet').value.trim()||undefined})});
    const d=await r.json();
    $('#keyval').textContent=d.key;
    $('#baseurl').textContent=base;
    $('#cursor').textContent='Base URL: '+base+'\\nAPI Key:  '+d.key;
    $('#cont').textContent=JSON.stringify({models:[{title:'Shipyard',provider:'openai',model:'auto',apiBase:base,apiKey:d.key}]},null,2);
    $('#env').textContent='export OPENAI_BASE_URL="'+base+'"\\nexport OPENAI_API_KEY="'+d.key+'"';
    $('#out').classList.remove('hidden');
  }catch(e){alert('Could not generate a key: '+e.message)}
  $('#gen').disabled=false; $('#gen').textContent='Generate key';
});
document.addEventListener('click',e=>{const b=e.target.closest('.copy');if(!b)return;navigator.clipboard.writeText($(b.dataset.copy).textContent);b.textContent='copied';setTimeout(()=>b.textContent='copy',1200)});
</script></div></body></html>`

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

// Consumer surface — the "connect your IDE" page + self-serve key issuance.
// Registered before the operator's /api/* mount so it wins, and before the
// hub.boot middleware so issuing a key doesn't replay telemetry.
app.get('/connect', (c) => c.html(CONNECT_HTML))
app.post('/api/keys', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { wallet?: unknown; label?: unknown }
  const wallet = typeof body.wallet === 'string' && body.wallet.trim() ? body.wallet.trim() : undefined
  const label = typeof body.label === 'string' ? body.label.slice(0, 64) : undefined
  const { key, account } = await keyStore.issue({ wallet, label }, Date.now())
  return c.json({ key, userId: account.userId, wallet: account.wallet ?? null, createdAt: account.createdAt })
})

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
