# shipyard-inference

The always-available inference layer for the [Shipyard](https://openshipyard.xyz) stack.

`shipyard-inference` wraps Anthropic, OpenAI, and [UsePod](https://usepod.ai) behind one `LLMProvider` interface. The strategic goal: agents that don't get rate-limited mid-demo, deprecated overnight, or shut off by a policy change. UsePod is the *always-available* tier alongside frontier providers — not a replacement.

## Status

**Alpha — v0.2.0.** All three providers are production-ready. Provider failover routing lands in a subsequent release.

| Component                  | Status        |
| -------------------------- | ------------- |
| `AnthropicProvider`        | ✅ Ready       |
| `OpenAIProvider`           | ✅ Ready       |
| `createUsePodProvider()`   | ✅ Ready       |
| `withFailover()`           | 🚧 Next       |

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

## Roadmap

- **v0.2** (now) — Anthropic, OpenAI, UsePod providers; `baseURL` passthrough on all of them.
- **Next** — `withFailover(primary, fallback)` routing. Try primary, fall back to UsePod on retryable errors (rate-limit / outage / model-deprecated). This is what makes "always-on" real.
- **Later** — Streaming, retry-with-jitter, observability hooks (failover-event log).

## Related

- [Shipyard](https://openshipyard.xyz) — the agent ecosystem this SDK powers
- [Dock](https://github.com/BiscayneDev/dock) — consumer-facing first mate (first consumer of this SDK)
- [UsePod](https://usepod.ai) — wallet-funded inference proxy

## License

MIT © Halsey Huth
