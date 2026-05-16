# shipyard-inference

The always-available inference layer for the [Shipyard](https://openshipyard.xyz) stack.

`shipyard-inference` wraps Anthropic, OpenAI, and (soon) [UsePod](https://usepod.ai) behind one `LLMProvider` interface, with [Open Wallet Standard](https://openwallet.sh) signing for x402-gated payment calls. The strategic goal: agents that don't get rate-limited mid-demo, deprecated overnight, or shut off by a policy change. UsePod is the *always-available* tier alongside frontier providers — not a replacement.

## Status

**Alpha — v0.1.0.** The Anthropic and OpenAI providers are production-ready (lifted from [Dock](https://github.com/BiscayneDev/dock)). The UsePod provider is stubbed pending public SDK release. Provider failover routing lands in a subsequent release.

| Component           | Status        |
| ------------------- | ------------- |
| `AnthropicProvider` | ✅ Ready       |
| `OpenAIProvider`    | ✅ Ready       |
| `OWSClient`         | ✅ Ready       |
| `UsePodProvider`    | 🚧 Stub        |
| `withFailover()`    | 🚧 Next       |

## Install

```bash
npm install shipyard-inference
```

## Quick start

### Anthropic

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

### OpenAI

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

### Open Wallet Standard signing

OWS runs as a local HTTP daemon (default `http://localhost:8787`) with Bearer auth.

```ts
import { OWSClient } from 'shipyard-inference'

const ows = new OWSClient({
  endpoint: 'http://localhost:8787',
  apiKey: process.env.OWS_API_KEY!,
})

const wallets = await ows.listWallets()
const sig = await ows.signMessage(walletId, 'solana:mainnet', 'hello')
```

## Roadmap

- **v0.1** (now) — Anthropic + OpenAI providers, OWS HTTP client.
- **Next** — `UsePodProvider` against `api.usepod.ai` with x402 + USDC-on-Solana payment via `@x402/fetch`, signed by `OWSClient`.
- **Then** — `withFailover(primary, fallback)` routing. Try primary, route to UsePod on retryable errors (rate-limit / outage / model-deprecated). This is what makes "always-on" real.
- **Later** — Streaming, retry-with-jitter, observability hooks (failover-event log).

## Related

- [Shipyard](https://openshipyard.xyz) — the agent ecosystem this SDK powers
- [Dock](https://github.com/BiscayneDev/dock) — consumer-facing first mate (first consumer of this SDK)
- [Open Wallet Standard](https://github.com/open-wallet-standard/core) — the wallet/signing layer
- [UsePod](https://usepod.ai) — the decentralized inference marketplace

## License

MIT © Halsey Huth
