# Using shipyard-inference with Hermes Agent (Nous Research)

[Hermes Agent](https://github.com/nousresearch/hermes-agent) speaks the OpenAI
API and supports [pluggable providers](https://hermes-agent.nousresearch.com/docs/integrations/providers).
Because the shipyard-inference gateway is an OpenAI-compatible endpoint, you can
register it as a custom provider — Hermes Agent then gets cost-aware routing,
x402-on-Solana payments, and spend telemetry with **no rebuild**.

## 1. Run the gateway

```bash
npm i shipyard-inference hono @hono/node-server
export ANTHROPIC_API_KEY=...      # or any candidate's key
export NOUS_API_KEY=...           # Nous Portal key (portal.nousresearch.com)
export SHIPYARD_GATEWAY_KEY=my-secret

npx shipyard-gateway --config ./gateway.config.mjs
# → shipyard-gateway listening on http://localhost:8787
```

Verify it speaks OpenAI:

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "authorization: Bearer my-secret" -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5","messages":[{"role":"user","content":"hi"}],"stream":true}'
```

## 2. Point Hermes Agent at it

Configure a custom OpenAI-compatible provider in Hermes Agent
([adding providers](https://hermes-agent.nousresearch.com/docs/developer-guide/adding-providers)).
The shape is typically:

```jsonc
{
  "providers": {
    "shipyard": {
      "type": "openai",
      "base_url": "http://localhost:8787/v1",
      "api_key_env": "SHIPYARD_GATEWAY_KEY",
      "models": ["claude-sonnet-4-5", "claude-haiku-4-5", "Hermes-4-405B"]
    }
  }
}
```

Now Hermes Agent's requests flow through the gateway: the router picks the
cheapest capable model per request, payments settle on Solana underneath, and
each response carries `x-shipyard-model` / `x-shipyard-cost-usd` (and an
`x_shipyard` trailer event on streams) so you can see exactly what was spent.

> The gateway tolerates Hermes' extra SSE event types (`hermes.tool.progress`,
> spec-native `function_call` items) — unknown events are ignored, standard
> `chat.completion.chunk`s pass through.
