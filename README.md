# shipyard-inference

The always-available inference layer for the [Shipyard](https://openshipyard.xyz) stack.

`shipyard-inference` wraps Anthropic, OpenAI, and [UsePod](https://usepod.ai) behind one `LLMProvider` interface. The strategic goal: agents that don't get rate-limited mid-demo, deprecated overnight, or shut off by a policy change. UsePod is the *always-available* tier alongside frontier providers — not a replacement.

As of v0.4 it ships a cost-aware **`Router`** (route each request to the cheapest *capable* model), an **x402-on-Solana payment layer** (pay per request with USDC), **streaming** with real usage/$ telemetry, and a **drop-in OpenAI-compatible gateway** — so any product in any language can point its `baseURL` at it and get routing + payments + savings with zero code changes. It also speaks to [Nous Research / Hermes](https://portal.nousresearch.com) and plugs into [Hermes Agent](https://github.com/nousresearch/hermes-agent).

## Status

**Alpha — v0.4.0.** Providers, cost-aware routing, x402-on-Solana payments,
streaming + usage telemetry, and the OpenAI-compatible gateway are all ready.

| Component                              | Status        |
| -------------------------------------- | ------------- |
| `AnthropicProvider` / `OpenAIProvider` | ✅ Ready       |
| `createUsePodProvider()`               | ✅ Ready       |
| `createNousProvider()` (Hermes)        | ✅ Ready       |
| `Router` / `costOptimized()`           | ✅ Ready       |
| `withFailover()`                       | ✅ Ready       |
| Streaming (`chatStream`)               | ✅ Ready       |
| Usage/$ telemetry + `MemoryUsageRecorder` | ✅ Ready    |
| `createPayingFetch()` (x402)           | ✅ Ready       |
| `createSolanaPayProvider()`            | ✅ Ready       |
| `createPayboxPaymentProvider()`        | ✅ Ready       |
| `shipyard-gateway` (OpenAI-compatible) | ✅ Ready       |
| Semantic cache / compression           | 🔌 Seam only  |

## How UsePod works (the short version)

UsePod doesn't ship an SDK. It's a **wallet-funded proxy** in front of Anthropic and OpenAI. You fund a USDC balance in the [UsePod dashboard](https://usepod.ai/dashboard), copy a per-account proxy URL, and point any existing Anthropic/OpenAI client at it. Inference is billed against your wallet instead of an API key.

`createUsePodProvider()` is a thin convenience that returns one of our existing providers pre-configured for that proxy.

## Install

```bash
npm install shipyard-inference
```

## Quick start

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

### UsePod (wallet-funded, no API key)

Get a token at [usepod.ai/dashboard](https://usepod.ai/dashboard) and fund the balance.

```ts
import { createUsePodProvider } from 'shipyard-inference'

const provider = createUsePodProvider({
  token: process.env.USEPOD_TOKEN, // the UUID from your dashboard
})

const response = await provider.chat({
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Hello!' }],
  tools: [],
})
```

OpenAI-compatible mode:

```ts
const provider = createUsePodProvider({
  family: 'openai',
  token: process.env.USEPOD_TOKEN,
})
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

Every provider now accepts `baseURL`, so you can route through any OpenAI/Anthropic-compatible gateway (UsePod, OpenRouter, an internal proxy, etc.):

```ts
new AnthropicProvider({
  apiKey: 'placeholder',
  baseURL: 'https://api.usepod.ai/proxy/<your-token>',
})
```

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
(429 / 5xx / model-deprecated). Optional `cache` (a `CacheStore`) and `compress`
(a `CompressionTransform`) are off by default and ship as seams — bring your own.

> Pricing in `DEFAULT_PRICING` is **advisory** and drifts; per-candidate `models[]`
> is authoritative, with `pricingOverrides` in between. It ranks candidates, it
> does not bill.

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

> For *on-chain USDC* x402 settlement use `keypairSigner` + `createSolanaPayProvider`.
> Paybox's wallet-sign path is intent-based and submits on-chain itself, so this
> adapter targets endpoints that bill through a Paybox card credential.

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

## Drop-in gateway (OpenAI-compatible)

Run an OpenAI-compatible HTTP server in front of the Router — any app or
framework that speaks OpenAI (including [Hermes Agent](./examples/hermes-agent))
points its `baseURL` at it and gets routing + payments + telemetry, no code
changes.

```bash
npm i shipyard-inference hono @hono/node-server
npx shipyard-gateway --config ./examples/hermes-agent/gateway.config.mjs
# → POST http://localhost:8787/v1/chat/completions  (stream + non-stream)
#   GET  http://localhost:8787/v1/models
```

Responses carry `x-shipyard-model` / `x-shipyard-provider` / `x-shipyard-cost-usd`
(and an `x_shipyard` trailer event on streams) so callers see exactly what ran
and what it cost. `hono` + `@hono/node-server` are optional peers — `import { Router }`
pulls no server code. See [`examples/hermes-agent`](./examples/hermes-agent) for
the Hermes Agent + Nous/Hermes setup.

## Roadmap

- **v0.2** — Anthropic, OpenAI, UsePod providers; `baseURL` passthrough.
- **v0.3** — Cost-aware `Router` (`costOptimized` / `failover` / `composite`),
  `withFailover`, and the x402-on-Solana payment layer.
- **v0.4** (now) — Streaming + usage/$ telemetry, the OpenAI-compatible
  `shipyard-gateway`, and Nous/Hermes (`createNousProvider`) + Hermes Agent compatibility.
- **Later** — retry-with-jitter, a real semantic `CacheStore`, context
  compression, MPP session settlement, and a Paybox `SignIntent` on-chain path.

## Related

- [Shipyard](https://openshipyard.xyz) — the agent ecosystem this SDK powers
- [Dock](https://github.com/BiscayneDev/dock) — consumer-facing first mate (first consumer of this SDK)
- [UsePod](https://usepod.ai) — wallet-funded inference proxy

## License

MIT © Halsey Huth
