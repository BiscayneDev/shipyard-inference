# Shipyard Inference: The Model Layer for Agents ("Lighthouse")

**Date:** 2026-09-18
**Status:** Approved design, pending implementation plan
**Repo:** `~/projects/shipyard-inference`

## Problem

Agent users today are trapped between two bad options: a Claude subscription with hard usage limits, or self-managed local/cloud models that break silently and are painful to revive. The canonical failure: a user hits a provider limit mid-session in Hermes (Telegram or terminal), the session dies, and recovery requires manual archaeology — figure out which limit, switch providers, restart, rebuild context.

## Thesis

**Shipyard Inference is the model layer for agents.** Any agent — Claude Code, Hermes/OpenClaw, custom SDK apps — points at one endpoint. The gateway:

1. **Connect** — one command, any agent (`shipyard connect`)
2. **Select** — hardware-aware local ladder + Jev content-aware tier routing
3. **Pay** — x402 per-call from the user's wallet (PayBox OAuth; MoonPay on-ramp), no subscription
4. **Survive** — limits, outages, and crashes become the gateway's problem: transparent failover with a post-hoc receipt; sessions never die

Target users (all, via the same gateway): Claude Code users replacing a subscription, Hermes/OpenClaw power users, developers building custom agents, and ourselves (user zero).

Audience is crypto-native: they already hold wallets. New friction is only getting them to try PayBox; MoonPay covers the no-crypto edge case.

## Architecture

```
Agent (Claude Code / Hermes / OpenClaw / SDK)
        │  same endpoint, same wire protocol as today
        ▼
┌─ Shipyard Inference Gateway ─────────────────────────┐
│  Auth (PayBox wallet ── or ── API key)               │
│         │                                            │
│  Router: Jev content-aware tier + hardware ladder    │
│         │                                            │
│  Failover Engine ──► Provider Health Tracker         │
│         │               (429s, 5xx, latency, uptime) │
│         ▼                                            │
│  Providers: local Ollama ── Venice (x402) ── cloud   │
│         │                                            │
│  Conversation Anchor (state store)  ──► Receipts     │
└──────────────────────────────────────────────────────┘
```

All pillar logic lives in the gateway (one implementation serves all four on-ramps). Two thin client-side pieces: the `shipyard connect` CLI flow and the receipt surface.

Wire-protocol compatibility is a hard constraint:
- `/v1/messages` accepting BOTH `Authorization: Bearer` and `x-api-key` (Claude Code route mode)
- OpenAI-compatible `/v1/chat/completions` for SDKs and agent runtimes
- All custom SSE telemetry MUST ride a valid OpenAI chunk shape (`{id, object: 'chat.completion.chunk', created, model, choices: [], x_shipyard: …}`) — a bare telemetry frame fails strict client validation (AI SDK `AI_TypeValidationError`)

## Components

### a) `shipyard connect` v2 — the front door

One command, one flow:

1. **Hardware detection** (chip, RAM/VRAM) → build the local model ladder. Example on an 8GB M2: `llama3.2:3b` (economy), `qwen2.5:3b-instruct` (alternate); burst to cloud for frontier-tier work.
2. Offer `ollama pull` for anything missing.
3. Auth choice: **connect wallet (PayBox OAuth, default hero path)** or instant API key (testing / enterprise).
4. Write the agent config:
   - Claude Code: route mode (backs up and rewrites `~/.claude/settings.json` env — backup mandatory, existing behavior)
   - Hermes/OpenClaw: env vars (`SHIPYARD_INFERENCE_URL`, `SHIPYARD_INFERENCE_API_KEY`, `AGENT_MODEL_VIC`)
   - Custom agents: plain OpenAI-compatible env vars
5. Print a "you're live" verification with one test call (and for route mode, remind to restore settings after testing).

The Hermes-style "best local model for your hardware" advisor is step 1 of connect — not a separate feature.

### b) Failover engine + provider health tracker

Per-tier failover chains:

- **economy:** ollama-primary → ollama-alternate → Venice (x402) → cheap cloud
- **frontier:** Anthropic → OpenRouter fallback

The health tracker keeps rolling stats per provider (429 rate, 5xx rate, latency). A 429/5xx **mid-request** triggers a transparent retry on the next provider in the chain, same request. Context overflow on a small local model triggers an automatic tier bump + retry.

**Venice as a provider:** open-weights hosted inference, x402-native (no API key). Two billing modes:
1. **Gateway-pays-and-rebills (build first):** the gateway's wallet pays Venice via x402; the user is re-billed through existing `upto` metering. Preserves receipts, rate limiting, and conversation anchor.
2. **Passthrough x402 (later):** user's wallet pays Venice directly. Cheaper story, loses gateway-side metering.

Venice is the mid-tier rung — it is NOT frontier quality. Jev content-aware routing rarely sends frontier-tier work there. Its failover value: when local hardware is too weak, busy, or offline, before jumping to frontier-priced cloud.

### c) Conversation anchor

The gateway keys lightweight conversation state on a conversation ID:
- Client passes `x-shipyard-conversation-id` header; falls back to API key / wallet identity
- State: model used, provider, tier, token count, recent context digest, failover history
- Purpose: if the client drops mid-stream or restarts, the next request resumes at the same ladder position instead of cold-starting into a broken state — kills the "hard to get going again" half of the pain
- Storage: SQLite locally, durable store in prod; TTL-evicted after 24h

### d) Receipts (Survive-pillar UX: transparent but noticed)

Default behavior is transparent failover; the user is informed after the fact, never blocked. Extend the `x_shipyard` telemetry chunk (riding the valid OpenAI chunk shape) with failover events:

```json
{ "model": "…", "provider": "…", "costUsd": 0.04,
  "failover": { "from": "ollama/llama3.2:3b", "to": "venice/llama-3.3-70b", "reason": "context_overflow" } }
```

Surfaces: statusline (existing `/api/me` budget-aware fetch), Telegram-facing summary. Silence when nothing went wrong.

### e) Wallet-empty as a recoverable event

Insufficient balance returns a 402 with a MoonPay top-up link — never a dead session. The conversation anchor preserves state, so after top-up the next request just works.

## Error handling matrix

| Failure | Behavior |
|---|---|
| Provider 429/5xx | Transparent failover to next in chain + receipt |
| Local model down | Health tracker detects; route to Venice/cloud or auto-restart Ollama + receipt |
| Context overflow | Auto tier-bump + retry + receipt |
| Wallet empty | 402 + MoonPay top-up link; anchor preserves state for seamless resume |
| Client crash/restart | Anchor resumes session; no archaeology |

Out of scope (explicitly): fixing agent-side breakage (e.g., Hermes' own session state corruption). The gateway keeps the model layer alive; it cannot resurrect the agent process.

## Testing

- **Contract tests** for all three wire shapes (Claude Code Bearer auth, AI SDK strict chunk validation — guarded by the telemetry-chunk shape rule)
- **Chaos tests:** kill Ollama mid-stream; force 429s via mock provider; drain a test wallet — assert session survives and receipt fires
- **E2E:** existing browser-payer script + `stack-health` preflight, extended with a failover scenario
- **Advisor matrix:** hardware profiles → expected local ladder

## Build order

1. **Failover engine + health tracker** (kills the primary personal pain fastest)
2. **Receipts** (telemetry chunk extension + surfaces)
3. **`connect` v2** with hardware advisor folded in
4. **Conversation anchor** (state store + resume)
5. **Venice provider** (gateway-pays-and-rebills mode)

## Decisions log

- **2026-09-18:** Approach 3 (gateway-first Lighthouse) over agent-side companion. Survive is the wedge, Pay is the moat.
- **2026-09-18:** Failover UX = B (transparent but noticed), with interactive prompts reserved for expensive tier jumps (later).
- **2026-09-18:** Wallet-first onboarding; PayBox default, API key secondary; MoonPay for the no-crypto edge.
- **2026-09-18:** Venice added as mid-tier x402 provider, not an Ollama replacement. Ollama remains the local tier.
