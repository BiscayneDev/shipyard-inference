# shipyard-inference

**A smart middleman between your app and the AI models it uses.** Your app talks
to shipyard-inference instead of to Claude, GPT, or Hermes directly — and it
makes that cheaper, more reliable, and easier to pay for. Like a travel-booking
site, but for AI requests: you say what you need, it finds the best option and
handles payment, instead of you wiring up each provider yourself.

**What it does:**

1. **Routes to the cheapest capable model.** Simple requests go to a cheap model,
   hard ones to a premium model — same result, smaller bill.
2. **Never leaves your app stranded.** If a provider is down, rate-limited, or
   deprecates a model, it automatically fails over to another.
3. **Lets the app pay per request, in crypto.** Settle each call with USDC on
   Solana (the x402 standard) — no API-key juggling or monthly bills. Ideal for
   autonomous agents that buy their own compute.
4. **Shows you exactly what you spent.** Every request reports real token usage
   and real dollar cost, so savings are measured, not guessed.

**Why plug it in:** it streams (word-by-word, like any chat UI) and speaks the
**standard OpenAI format**, so any app in any language can adopt it by changing
**one setting — the URL** — no rewrite. That's how products like
[Hermes Agent](https://github.com/nousresearch/hermes-agent) can use it instantly.

> Built for the [Shipyard](https://openshipyard.xyz) agent stack, but framework-
> and language-agnostic by design. Wraps Anthropic, OpenAI, [UsePod](https://usepod.ai),
> and [Nous/Hermes](https://portal.nousresearch.com) behind one interface.

## Status

**Alpha — v0.11.0.** Provable savings (baseline-vs-actual cost + per-user
attribution) and provider-native prompt caching, wallet-funded inference (UsePod
prepaid + `createWalletInference` for x402 endpoints), providers, cost-aware
routing (failover + retry-with-jitter),
x402-on-Solana payments (with the full Paybox surface and MPP session settlement),
streaming + usage telemetry, the OpenAI-compatible gateway, semantic caching +
compression, and OpenRouter are all ready.

| Component                              | Status        |
| -------------------------------------- | ------------- |
| `AnthropicProvider` / `OpenAIProvider` | ✅ Ready       |
| `createUsePodProvider()`               | ✅ Ready       |
| `createUsePodCandidate()` (auto catalog) | ✅ Ready     |
| `createNousProvider()` (Hermes)        | ✅ Ready       |
| `createOpenRouterProvider()`           | ✅ Ready       |
| `Router` / `costOptimized()`           | ✅ Ready       |
| `withFailover()` / retry-with-jitter   | ✅ Ready       |
| Streaming (`chatStream`)               | ✅ Ready       |
| Usage/$ telemetry + `MemoryUsageRecorder` | ✅ Ready    |
| Savings engine (`baselineModel` → saved $/%) | ✅ Ready |
| Prompt caching (Anthropic `cache_control`) | ✅ Ready    |
| `createPayingFetch()` (x402)           | ✅ Ready       |
| `createSolanaPayProvider()`            | ✅ Ready       |
| MPP sessions (`openSession`)           | ✅ Ready       |
| `createPayboxPaymentProvider()`        | ✅ Ready       |
| `payboxSigner()` / `payboxSecret()`    | ✅ Ready       |
| `payboxSettle()` (USDC settlement)     | ✅ Ready       |
| `shipyard-gateway` (OpenAI-compatible) | ✅ Ready       |
| `createWalletInference()` (x402 turnkey) | ✅ Ready     |
| UsePod register / deposit / balance    | ✅ Ready       |
| `SemanticCacheStore` + compression     | ✅ Ready       |

## Two ways to use it

- **Run the gateway** ([below](#the-gateway--drop-in-for-any-app)) — the drop-in
  path. Point any OpenAI-compatible app at one URL; works from any language, no
  code changes. Best for adding it to an existing product.
- **Import the SDK** ([Install](#install)) — for TypeScript/Node apps that want
  the `Router`, providers, and payment primitives directly in-process.

## The gateway — drop-in for any app

Run an OpenAI-compatible HTTP server in front of the Router. Any app or framework
that speaks OpenAI (including [Hermes Agent](./examples/hermes-agent)) points its
`baseURL` at it and gets cost-routing + payments + telemetry — **no code changes,
any language.**

```bash
npm i shipyard-inference hono @hono/node-server
npx shipyard-gateway --config ./examples/hermes-agent/gateway.config.mjs
# → POST http://localhost:8787/v1/chat/completions  (stream + non-stream)
#   GET  http://localhost:8787/v1/models
```

Point any OpenAI client at it:

```ts
import OpenAI from 'openai'
const client = new OpenAI({ baseURL: 'http://localhost:8787/v1', apiKey: 'your-gateway-key' })
await client.chat.completions.create({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hello!' }],
})
```

Responses carry `x-shipyard-model` / `x-shipyard-provider` / `x-shipyard-cost-usd`
(and an `x_shipyard` trailer event on streams) so callers see exactly what ran
and what it cost. `hono` + `@hono/node-server` are optional peers — `import { Router }`
pulls no server code. See [`examples/hermes-agent`](./examples/hermes-agent) for
the Hermes Agent + Nous/Hermes setup.

## Operator command center

One **central dashboard for everything happening with Shipyard inference**, across
every place it's integrated — your own home, outside any one consumer app. It's two
parts: a drop-in **reporter** every deployment wires in, and a **hub** that ingests,
persists to disk, aggregates, and serves the operator SPA.

**Wire it in (one line per integration):** pass `reporter.onEvent` to any `Router` or
gateway. Every routing decision, failover, retry, error, cache lookup, and completed
request — with real tokens, cost, baseline, and savings — flows to the hub, tagged with
a `source`.

```ts
import { Router, createTelemetryReporter } from 'shipyard-inference'

const reporter = createTelemetryReporter({
  url: process.env.OPERATOR_URL!,        // the hub
  token: process.env.SHIPYARD_TELEMETRY_TOKEN,
  source: 'dock-prod',                    // which deployment this is
})

const router = new Router({ candidates, baselineModel, onEvent: reporter.onEvent })
// billing side (outside the Router): report real USDC collected
reporter.recordSettlement({ userId, amountUsd, status: 'settled', signature, network: 'mainnet' })
```

It's fire-and-forget — a bounded queue and best-effort delivery, so it can never block,
throw into, or slow the inference hot path. For an in-process gateway, skip the HTTP with
`createInProcessReporter(hub, 'gateway')`.

**Capture every app automatically (no per-app wiring).** Most apps reach Shipyard through
the OpenAI-compatible gateway, so the gateway captures all of it centrally — just point it
at the hub with env vars and every request through it is reported:

```bash
SHIPYARD_OPERATOR_URL=http://localhost:8799 \
SHIPYARD_TELEMETRY_TOKEN=ingest \
SHIPYARD_GATEWAY_SOURCE=gateway-prod \
npx shipyard-gateway --config ./gateway.config.mjs
```

Per-end-user attribution comes for free: the standard OpenAI `user` field on a request is
mapped to `userId`, so the hub breaks cost/savings down per person across every app. To wire
telemetry programmatically instead, pass a reporter on the gateway config:
`createGatewayApp({ candidates, telemetry: createTelemetryReporter({ url, source }) })`.

**Run the hub** (its own home — `shipyard-inference/operator` keeps the root import
server-free):

```bash
SHIPYARD_OPERATOR_TOKEN=secret SHIPYARD_TELEMETRY_TOKEN=ingest npx shipyard-operator
# → http://localhost:8799  (enter the operator token to unlock)
```

The command center tracks requests/RPM, success & error rates, tokens/TPM, **actual vs
baseline vs saved $ (+ savings %)**, modeled **revenue vs provider cost → gross margin**,
cache hit / failover / retry rates, latency p50/p95/p99, a time series, per-model /
provider / user / source / error breakdowns, routing health, a live request feed, SLO
alert chips, and **billing & settlement** (settled/owed/stuck + live treasury USDC
balance with explorer links). Revenue is modeled in the hub from `SHIPYARD_MARGIN_PCT`
(`min(actual·(1+margin), baseline)`, Dock's M2 rule) so consumers need zero billing
wiring; settlements report the real money. Telemetry persists to disk
(`SHIPYARD_OPERATOR_DATA_DIR`, append-only JSONL) and the hub replays the recent window
on restart. Set `SHIPYARD_TREASURY_WALLET` (+ `SHIPYARD_SETTLE_NETWORK`/`_RPC_URL`) to
light up the treasury panel. Mount it onto an existing server with
`createOperatorConsole({ hub })`. See [`examples/chat-portal`](./examples/chat-portal)
for a working source (`OPERATOR_URL=… node server.mjs`).

## Fund a wallet → cheap inference

Two shapes, depending on how the endpoint takes payment.

### UsePod (prepaid balance, on-chain funded) — recommended

[UsePod](https://usepod.ai) is a **prepaid token-balance proxy**: fund a token's
USDC balance once (on-chain or by card), then every Anthropic/OpenAI call is
debited from it, and UsePod's marketplace routes to the cheapest provider. No
per-call signing.

```ts
import { registerUsePod, depositUsdc, usePodBalance, createUsePodProvider, Router, costOptimized } from 'shipyard-inference'

const { token, depositCode } = await registerUsePod()
await depositUsdc({ secretKey: process.env.SOLANA_SECRET!, depositCode, amountUsdc: 10 }) // on-chain USDC
console.log(await usePodBalance(token))

const router = new Router({
  candidates: [{ id: 'usepod', provider: createUsePodProvider({ token, family: 'openai', maxPriceInput: 400_000, maxPriceOutput: 600_000 }) }],
  strategy: costOptimized(),
})
await router.chat({ system: 'You are helpful.', messages: [{ role: 'user', content: 'Hi' }], tools: [] })
```

`maxPrice*` set per-request ceilings (USDC microunits / 1M tokens). `depositUsdc`
requires the optional peer `@coral-xyz/anchor`.

#### Let the Router pick the right UsePod model

The snippet above gives UsePod no model catalog, so `costOptimized`/`autoTier`
can't rank it — it only works via a pinned model or as a failover target.
**`createUsePodCandidate()`** fixes that: it reads UsePod's live catalog from
`GET /v1/models`, selects the **best model per tier** (economy / standard /
frontier) across the marketplace — open-weight commodities (Llama, Qwen,
DeepSeek, Mistral, GLM) *and* frontier (`gpt-5.5`, Claude, Gemini) — and returns
a ready `ProviderCandidate`. If the listing can't be read (an unfunded token, an
outage) it falls back to a curated best-per-tier catalog, so the candidate is
always routable.

```ts
import { createUsePodCandidate, Router, costOptimized } from 'shipyard-inference'

// Discovers /v1/models, classifies into tiers, picks the best per tier.
const usepod = await createUsePodCandidate({ token: process.env.USEPOD_TOKEN })

const router = new Router({
  candidates: [usepod],
  strategy: costOptimized(),
  autoTier: true, // cheapest model that's *good enough* per request
})
await router.chat({ system: 'You are helpful.', messages: [{ role: 'user', content: 'Hi' }], tools: [] })
```

A trivial prompt routes to the economy open-weight model; a large or
tool-heavy one auto-tiers up to standard/frontier. Override the per-tier choice
with `prefer` (e.g. `{ frontier: ['claude-opus-4-5'] }`), pin an explicit
`models[]` to skip discovery, or set `discover: false` to use the curated
catalog only. Prices attached to each model are the *centralized cap* — the
marketplace only ever charges less — so cost-ranking is conservative and honest.

> ⚠️ `depositUsdc` follows UsePod's documented Anchor flow but is **unverified
> against mainnet** here — do a small real deposit and confirm it credits before
> relying on it. (Funding from a Paybox-custodied wallet is a follow-up.)

### True x402 endpoints (per-call payment)

For endpoints that actually speak x402 (pay.sh skills, RelAI, the x402 bazaar),
`createWalletInference` is the one-call path — signer → Solana payment (+ optional
MPP session) → endpoint → `costOptimized` Router:

```ts
import { createWalletInference, payboxSigner } from 'shipyard-inference'

const { router, close } = await createWalletInference({
  signer: await payboxSigner({ credentialId: process.env.PAYBOX_WALLET_ID! }), // or keypairSigner(...)
  baseURL: process.env.X402_ENDPOINT!,     // a *true* x402 endpoint (NOT UsePod)
  sessionBudget: '5000000',                // optional MPP session (atomic USDC)
  spendCap: { perRequest: '50000' },
})
await router.chat({ system: 'You are helpful.', messages: [{ role: 'user', content: 'Hi' }], tools: [] })
await close()
```

> The x402 payment wire is exercised in tests with mocks; verify a real round-trip
> on devnet before mainnet.

## Install

```bash
npm install shipyard-inference
```

## Quick start (SDK)

### Anthropic (direct)

```ts
import { AnthropicProvider } from 'shipyard-inference'

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const response = await provider.chat({
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Hello!' }],
  tools: [],
})

console.log(response.content)
```

### OpenAI (direct)

```ts
import { OpenAIProvider } from 'shipyard-inference'

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
})

const response = await provider.chat({
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Hello!' }],
  tools: [],
})
```

### Point any provider at a proxy

Every provider accepts `baseURL`, so you can route through any OpenAI/Anthropic-compatible gateway (UsePod, OpenRouter, an internal proxy, etc.):

```ts
new AnthropicProvider({
  apiKey: 'placeholder',
  baseURL: 'https://api.usepod.ai/proxy/<your-token>',
})
```

## Proven savings (not guessed)

Set a `baselineModel` — the model you'd otherwise have called direct — and every
completed request reports **what it actually cost vs what the baseline would
have**, so the savings are measured, not claimed. The win is mechanism-based:
routing to the cheapest *capable* model **+** provider-native prompt caching (on
by default for Anthropic — the stable system + tools prefix bills at the ~0.1×
cache-read rate on reuse). Attribute per end-user with `metadata.userId`.

```ts
import { Router, MemoryUsageRecorder, costOptimized } from 'shipyard-inference'

const usage = new MemoryUsageRecorder()
const router = new Router({
  candidates: [/* … */],
  strategy: costOptimized(),
  baselineModel: 'claude-opus-4-5', // "cheaper than calling Opus direct"
  usageRecorder: usage,
})

await router.chat({ system, messages, tools, metadata: { userId: 'alice' } })

const t = usage.totals()
console.log(`saved $${t.savedUsd.toFixed(4)} (${(100 * t.savedUsd / t.baselineCostUsd).toFixed(0)}%)`)
console.log(t.perUser['alice']) // per-user requests / tokens / cost / baseline / saved
```

Each `request_completed` event also carries `actualCostUsd` / `baselineCostUsd` /
`savedUsd` / `userId` for live dashboards. The baseline is honest — *the same
request on `baselineModel`, called direct, uncached.*

## Cost-aware routing

A `Router` is itself an `LLMProvider`, so it drops in anywhere a provider is
expected — and composes (a `Router` can be a candidate of another `Router`).
The default `costOptimized()` strategy routes each request to the cheapest
*capable* model across your configured candidates.

```ts
import {
  Router,
  AnthropicProvider,
  createUsePodProvider,
  costOptimized,
} from 'shipyard-inference'

const router = new Router({
  candidates: [
    {
      id: 'anthropic',
      provider: new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }),
      models: [
        { model: 'claude-haiku-4-5', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 200_000, tier: 'economy', capabilities: ['tools'] },
        { model: 'claude-sonnet-4-5', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200_000, tier: 'standard', capabilities: ['tools'] },
      ],
    },
    { id: 'usepod', provider: createUsePodProvider({ token: process.env.USEPOD_TOKEN }) },
  ],
  strategy: costOptimized(),
})

// Cheapest capable model — bump quality per-request with routingHints.
await router.chat({ system: 'You are helpful.', messages: [{ role: 'user', content: 'Hi' }], tools: [] })
await router.chat({ system: '…', messages: [/* … */], tools: [], routingHints: { tier: 'frontier' } })
```

Strategies: `costOptimized()` (cheapest capable), `failover(order?)` (availability-first),
and `composite(...)` (e.g. cheapest-capable with UsePod always last). `withFailover(primary, fallback)`
is the convenience the roadmap promised — try primary, fall back on retryable errors
(429 / 5xx / model-deprecated). A `retry` policy retries the *same* candidate with
exponential backoff + jitter (honoring `Retry-After`) before failing over:
`new Router({ candidates, retry: { maxRetries: 3 } })`. Optional `cache` (a `CacheStore`)
and `compress` (a `CompressionTransform`) are off by default — see [Caching & compression](#caching--compression).
Add hundreds more models via OpenRouter:

```ts
import { createOpenRouterProvider } from 'shipyard-inference'
const openrouter = createOpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY })
// add as a candidate; use OpenRouter model ids like 'google/gemini-2.5-pro'
```

> Pricing in `DEFAULT_PRICING` is **advisory** and drifts; per-candidate `models[]`
> is authoritative, with `pricingOverrides` in between. It ranks candidates, it
> does not bill.

## Caching & compression

Both cut token spend and are off by default. **Caching** dedupes repeated work; a
**`SemanticCacheStore`** matches *paraphrases* by embedding similarity (an
exact-match `MemoryCacheStore` ships too):

```ts
import { Router, SemanticCacheStore, openAIEmbedder } from 'shipyard-inference'

const router = new Router({
  candidates: [/* … */],
  cache: new SemanticCacheStore({
    embedder: openAIEmbedder({ apiKey: process.env.OPENAI_API_KEY }), // or bring your own Embedder
    threshold: 0.95, // cosine similarity for a hit
  }),
})
```

**Compression** shrinks long histories before dispatch — `slidingWindowCompression`
(deterministic; keeps whole recent messages so code blocks stay intact) or
`summarizeCompression` (summarizes older turns with a cheap model):

```ts
import { slidingWindowCompression, summarizeCompression } from 'shipyard-inference'

new Router({ candidates: [/* … */], compress: slidingWindowCompression({ maxMessages: 20 }) })
// or: summarizeCompression({ provider: cheapProvider, keepRecent: 8 })
```

## Streaming

Every provider and the `Router` support streaming via `chatStream`. Events are
incremental (`text_delta`, `tool_call_start`, `tool_call_delta`) and end in a
single `done` carrying the assembled response with `usage`.

```ts
for await (const event of router.chatStream({ system, messages, tools })) {
  if (event.type === 'text_delta') process.stdout.write(event.text)
  if (event.type === 'done') console.log('\nusage:', event.response.usage)
}
```

The Router fails over only *before* the first token; once streaming has begun it
commits (no duplicate output). `collectStream(stream)` reduces a stream to a
plain `LLMResponse`. A `request_completed` event (and the optional
`MemoryUsageRecorder`) reports actual tokens, `actualCostUsd`, and latency.

## Paying for inference on Solana (x402)

Payment lives *below* the provider, inside a custom `fetch`. An HTTP 402 from the
upstream is settled and retried transparently — `chat()` and `Router` never see it.

```ts
import {
  AnthropicProvider,
  createPayingFetch,
  createSolanaPayProvider,
  keypairSigner,
} from 'shipyard-inference'

// Requires the optional peers: @solana/web3.js @solana/spl-token
const signer = await keypairSigner(process.env.SOLANA_PAYER_SECRET)
const payment = await createSolanaPayProvider({ signer, network: 'devnet' })

const fetch = createPayingFetch({
  paymentProvider: payment,
  spendCap: { perRequest: '50000', perProcess: '5000000' }, // atomic USDC base units
})

const provider = new AnthropicProvider({ baseURL: 'https://your-x402-endpoint', fetch })
```

**Money-safety:** `maxPaymentRetries` defaults to `1` (never loops on repeated 402s);
`pay` is idempotent per nonce; spend caps are enforced per-request and per-process;
`network` defaults to `devnet`. Use a dedicated low-balance hot wallet and never log
the secret.

### MPP sessions (bulk settlement)

For sustained inference, a per-call 402 round-trip is wasteful. An **MPP**
(Machine Payments Protocol) session locks a budget once, then attaches a reusable
voucher to every request so the server debits the session — settling the
cumulative total in bulk at `close()`:

```ts
const payment = await createSolanaPayProvider({ signer, network: 'mainnet' })
const session = await payment.openSession('5000000') // budget in atomic USDC units

const fetch = createPayingFetch({ paymentProvider: payment, session })
// …many calls reuse the session voucher (a per-call 402 still backstops via pay())…
await session.close() // settle in bulk
```

The session voucher is signed with the signer's `signMessage` (`keypairSigner` and
`payboxSigner` both support it). The exact voucher/escrow wire format is
facilitator-specific — override `encodeSession` / `onSessionClose` on
`createSolanaPayProvider` to match yours.

### Paybox

[Paybox](https://paybox.sh) is a credential vault + non-custodial payment broker
for agents. Its card/merchant flow plugs in as a `PaymentProvider` (scoped,
passkey-gated approvals):

```ts
import { createPayingFetch, createPayboxPaymentProvider } from 'shipyard-inference'

// Requires the optional peer: @paybox-sh/sdk (configure via `npx @paybox-sh/sdk login`)
const payment = await createPayboxPaymentProvider({
  credentialId: process.env.PAYBOX_CREDENTIAL_ID!,
  merchant: 'Your App',
  merchantUrl: 'https://yourapp.example',
})
const fetch = createPayingFetch({ paymentProvider: payment })
```

For **on-chain USDC** x402, `payboxSigner` is a non-custodial `SolanaSigner` backed
by a Paybox wallet credential — Paybox signs each transfer behind passkey approval
(the private key never reaches you, the agent, or the model), so you get Solana
settlement without a hot-wallet key in your environment:

```ts
import { createPayingFetch, createSolanaPayProvider, payboxSigner } from 'shipyard-inference'

const signer = await payboxSigner({ credentialId: process.env.PAYBOX_WALLET_ID! })
const payment = await createSolanaPayProvider({ signer, network: 'mainnet' })
const fetch = createPayingFetch({ paymentProvider: payment })
```

And `payboxSecret` reveals a vaulted API key (passkey-gated) so provider keys live
in Paybox instead of your environment:

```ts
import { AnthropicProvider, payboxSecret } from 'shipyard-inference'

const apiKey = await payboxSecret({ credentialId: process.env.PAYBOX_ANTHROPIC_KEY_ID! })
const provider = new AnthropicProvider({ apiKey })
```

## How UsePod works (the short version)

UsePod doesn't ship an SDK. It's a **wallet-funded proxy** in front of Anthropic and OpenAI. You fund a USDC balance in the [UsePod dashboard](https://usepod.ai/dashboard), copy a per-account proxy URL, and point any existing Anthropic/OpenAI client at it. Inference is billed against your wallet instead of an API key.

```ts
import { createUsePodProvider } from 'shipyard-inference'

// Get a token at usepod.ai/dashboard and fund the balance.
const provider = createUsePodProvider({ token: process.env.USEPOD_TOKEN })
// OpenAI-compatible mode: createUsePodProvider({ family: 'openai', token })
```

`createUsePodProvider()` is a thin convenience that returns one of our existing providers pre-configured for that proxy.

## Roadmap

- **v0.2** — Anthropic, OpenAI, UsePod providers; `baseURL` passthrough.
- **v0.3** — Cost-aware `Router` (`costOptimized` / `failover` / `composite`),
  `withFailover`, and the x402-on-Solana payment layer.
- **v0.4** — Streaming + usage/$ telemetry, the OpenAI-compatible
  `shipyard-gateway`, and Nous/Hermes (`createNousProvider`) + Hermes Agent compatibility.
- **v0.5** — Semantic cache (`SemanticCacheStore` + `openAIEmbedder`), context
  compression (`slidingWindowCompression` / `summarizeCompression`), and OpenRouter
  (`createOpenRouterProvider`).
- **v0.6** — Full Paybox surface: on-chain `payboxSigner` (`solanaTransaction`
  intent) and `payboxSecret` (vaulted API keys), alongside the card/merchant
  `createPayboxPaymentProvider`.
- **v0.7** — MPP session settlement: `openSession` / `PaymentSession`,
  `createPayingFetch({ session })`, and `signMessage` on the Solana signers.
- **v0.8** — Retry-with-jitter: a per-candidate `retry` policy with exponential
  backoff + full jitter, honoring `Retry-After`, before failover.
- **v0.9** — `createWalletInference`: turnkey "fund a wallet → cost-routed,
  wallet-paid inference" for *true x402* endpoints (signer + payment + MPP session
  + Router in one call).
- **v0.10** — UsePod prepaid funding done right (`registerUsePod` /
  `depositUsdc` / `usePodBalance`, `/v1` + `X-Pod-Max-Price-*` on the provider),
  after confirming UsePod is a prepaid token-balance proxy — not x402.
- **v0.11** — Provable savings: `baselineModel` → `savedUsd`/`baselineCostUsd`
  on every `request_completed` + `MemoryUsageRecorder` per-user totals, and
  default-on Anthropic prompt caching (system + tools) with cache-credited cost math.
- **v0.12** (now) — `payboxSettle()`: the meter-then-settle billing half — charge a
  user's accrued USDC from their (Paybox-custodied) wallet to a treasury on Solana.

## Related

- [Shipyard](https://openshipyard.xyz) — the agent ecosystem this SDK powers
- [Dock](https://github.com/BiscayneDev/dock) — consumer-facing first mate (first consumer of this SDK)
- [UsePod](https://usepod.ai) — wallet-funded inference proxy

## License

MIT © Halsey Huth
