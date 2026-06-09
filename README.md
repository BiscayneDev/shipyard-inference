# shipyard-inference

The always-available inference layer for the [Shipyard](https://openshipyard.xyz) stack.

`shipyard-inference` wraps Anthropic, OpenAI, and [UsePod](https://usepod.ai) behind one `LLMProvider` interface. The strategic goal: agents that don't get rate-limited mid-demo, deprecated overnight, or shut off by a policy change. UsePod is the *always-available* tier alongside frontier providers — not a replacement.

As of v0.3 it also ships a cost-aware **`Router`** (route each request to the cheapest *capable* model) and an **x402-on-Solana payment layer** so agents can pay for inference per-request with USDC — driving down token spend without sacrificing availability.

## Status

**Alpha — v0.3.0.** All three providers are production-ready, plus a cost-aware
`Router` and an x402-on-Solana payment layer.

| Component                       | Status        |
| ------------------------------- | ------------- |
| `AnthropicProvider`             | ✅ Ready       |
| `OpenAIProvider`                | ✅ Ready       |
| `createUsePodProvider()`        | ✅ Ready       |
| `Router` / `costOptimized()`    | ✅ Ready       |
| `withFailover()`                | ✅ Ready       |
| `createPayingFetch()` (x402)    | ✅ Ready       |
| `createSolanaPayProvider()`     | ✅ Ready       |
| `createPayboxPaymentProvider()` | ✅ Ready       |
| Semantic cache / compression    | 🔌 Seam only  |

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

## Roadmap

- **v0.2** — Anthropic, OpenAI, UsePod providers; `baseURL` passthrough.
- **v0.3** (now) — Cost-aware `Router` (`costOptimized` / `failover` / `composite`),
  `withFailover`, and the x402-on-Solana payment layer (`createPayingFetch`,
  `createSolanaPayProvider`, Paybox adapter).
- **Later** — Streaming, retry-with-jitter, a real semantic `CacheStore`,
  MPP session settlement, and a Paybox `SignIntent`-based on-chain path.

## Related

- [Shipyard](https://openshipyard.xyz) — the agent ecosystem this SDK powers
- [Dock](https://github.com/BiscayneDev/dock) — consumer-facing first mate (first consumer of this SDK)
- [UsePod](https://usepod.ai) — wallet-funded inference proxy

## License

MIT © Halsey Huth
