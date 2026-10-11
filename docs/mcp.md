# Shipyard Inference billing MCP server

A standalone stdio MCP server that exposes Shipyard Inference billing to any
MCP client (Claude Code, Cursor, Codex). It is a **thin REST client** of the
gateway: every tool is an authenticated HTTPS call to your gateway URL with
your API key. No secrets are stored by the server.

## Tools

| Tool | Gateway call | What it returns |
| --- | --- | --- |
| `shipyard_balance` | `GET /api/me` | Credit balance (SHIPusd) — `kickbacksUsd` from `/api/me`: top-ups and tender kickbacks share one durable credit ledger, so that field IS your balance. Older gateways without the shared ledger return a clear `not_exposed` error. |
| `shipyard_usage` | `GET /api/me` | Compact usage breakdown for your key: requests, `spentUsd`, `baselineUsd`, `savedUsd`/`savedPct`, kickbacks. Optional `windowMs` (default 24h). |
| `shipyard_models` | `GET /v1/models` | `{ models: [...], count }` of available model IDs. |

Every tool returns compact JSON. Gateway/network failures are returned as MCP
tool errors (`network_error`, `gateway_error` with the HTTP status) — never
stack traces.

## Environment variables

| Var | Required | Meaning |
| --- | --- | --- |
| `SHIPYARD_GATEWAY_URL` | yes | Base URL of your Shipyard Inference gateway (e.g. `https://inference.shipyard.example`). Trailing slashes stripped. |
| `SHIPYARD_GATEWAY_KEY` | yes | Your gateway API key, sent as `Authorization: Bearer <key>`. |

## Running

```sh
npm run mcp:billing
# equivalent to:
node --import tsx mcp/server.ts
```

## Claude Code

Add to `~/.claude.json` (or use `claude mcp add`):

```sh
claude mcp add shipyard-billing \
  -e SHIPYARD_GATEWAY_URL=https://your-gateway.example \
  -e SHIPYARD_GATEWAY_KEY=sk-your-key \
  -- node --import tsx /path/to/shipyard-inference/mcp/server.ts
```

Or in `.mcp.json` at project root:

```json
{
  "mcpServers": {
    "shipyard-billing": {
      "command": "node",
      "args": ["--import", "tsx", "/path/to/shipyard-inference/mcp/server.ts"],
      "env": {
        "SHIPYARD_GATEWAY_URL": "https://your-gateway.example",
        "SHIPYARD_GATEWAY_KEY": "sk-your-key"
      }
    }
  }
}
```

## Cursor

`~/.cursor/mcp.json` (or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "shipyard-billing": {
      "command": "node",
      "args": ["--import", "tsx", "/path/to/shipyard-inference/mcp/server.ts"],
      "env": {
        "SHIPYARD_GATEWAY_URL": "https://your-gateway.example",
        "SHIPYARD_GATEWAY_KEY": "sk-your-key"
      }
    }
  }
}
```

## Codex

In `~/.codex/config.toml`:

```toml
[mcp_servers.shipyard-billing]
command = "node"
args = ["--import", "tsx", "/path/to/shipyard-inference/mcp/server.ts"]
env = { "SHIPYARD_GATEWAY_URL" = "https://your-gateway.example", "SHIPYARD_GATEWAY_KEY" = "sk-your-key" }
```

## Self-funding top-up

The gateway's `POST /v1/topup` route is live (see `docs/agents.md`): pay USDC in
one call to mint credit balance on a wallet-issued key. `shipyard_balance`
reads that balance from `GET /api/me`. A dedicated `shipyard_topup` MCP tool
(x402 settlement over MCP) is not built yet — use the gateway route directly
via `createPayingFetch` for now.
