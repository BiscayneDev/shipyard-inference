# Shipyard Inference: The Model Layer for Agents ("Lighthouse")

**Date:** 2026-09-18 (v2, supersedes v1)
**Status:** Phase 1 implemented; Phase 2 scoped
**Repo:** `~/projects/shipyard-inference`

## Problem

Agent users are trapped between a Claude subscription with hard usage limits and self-managed models that break silently. Canonical failure (user's own): a Hermes session in Telegram/terminal hits a provider limit mid-task, the session dies, and recovery means manual archaeology.

## Thesis

**Shipyard Inference is the model layer for agents.** One endpoint; the gateway handles *which model* (Jev task-tier × hardware ladder), *payment* (x402 from the user's wallet — PayBox OAuth, MoonPay on-ramp; no subscription), and *staying alive* (limits are the gateway's problem: transparent failover, receipts, recoverable 402s). Customer zero is the maintainer himself (Hermes terminal + Telegram daily driver); the product also serves strangers.

Four pillars: **Connect** (one command, any agent) · **Select** (hardware + task aware) · **Pay** (wallet, no subscription) · **Survive** (limits become the gateway's problem). Survive is the wedge, Pay is the moat.

Audience is crypto-native: they already hold wallets. New friction is only getting them to try PayBox; MoonPay covers the no-crypto edge case.

## Dual-mode topology (v2's structural fix)

- **Appliance mode** — gateway runs on the user's machine (reference: MacBook Air M2/8GB), colocated with Ollama. Full ladder: local (free) → Venice/cloud burst (x402). SQLite/in-memory state is fine. **This is the default and the dogfood deployment.**
- **Hosted mode** — `shipyard-inference.vercel.app`. Ladder starts at Venice. Request-scoped features only (failover + receipts — serverless-safe); conversation anchor deferred.
- Same code, same wire protocols, same `connect` flow. The v1 spec conflated these and broke on "Vercel can't reach localhost Ollama."

Wire-protocol compatibility remains a hard constraint:
- `/v1/messages` accepting BOTH `Authorization: Bearer` and `x-api-key` (Claude Code route mode)
- OpenAI-compatible `/v1/chat/completions` for SDKs and agent runtimes
- All custom SSE telemetry MUST ride a valid OpenAI chunk shape — a bare telemetry frame fails strict client validation (AI SDK `AI_TypeValidationError`)

## Routing: Jev × hardware × policy

Jev judges task tier per request (structural inference as the free fast path, Jev on low confidence, `combine: 'max'`, 5-min judgment cache). The probed hardware ladder decides whether local can serve that tier; if not, burst to Venice/cloud from the wallet. Failover (429/5xx/context-overflow) tries the next rung transparently.

**Pinning caveat (discovered in Phase 1):** explicitly-requested models are PINNED by `explicitModelHints()` and never fail over across candidates — agents must request `auto` to get full Survive behavior. `connect` v2 must configure agents accordingly.

Venice remains the mid-tier x402 rung (not frontier quality; its failover value is when local hardware is too weak, busy, or offline, before jumping to frontier-priced cloud).

## Phase 1 — implemented (2026-09-18, all TDD, suite 319/319 vs baseline 300)

| Feature | Files | Commit |
|---|---|---|
| Hardware probe + local ladder (8GB→3B class: usable VRAM = min(70% RAM, RAM−6GB)) | `src/connect/hardware.ts` | `ad80e00` |
| Ollama runtime probe (pulled vs missing models) | `src/connect/ollama-probe.ts` | `75be62d` |
| Provider health tracker (circuit breaker: N consecutive failures → open 30s → half-open probe; open circuits skipped at selection) | `src/router/health.ts`, wired into `Router.plan()` + both attempt loops, forwarded via `GatewayConfig.health` | `126cfa0`, `2411cb5` |
| Failover receipts on stream telemetry (`x_shipyard.failover = {from, to, reason}` on a valid OpenAI chunk; reasons: `rate_limited` / `provider_error` / `context_overflow`) | `src/gateway/server.ts` (`capture()`, `classifyFailoverReason()`) | `3117d58` |
| Per-key spend circuit breaker + recoverable 402 with MoonPay top-up link | `src/gateway/spend.ts`, wired in chat route; `GatewayConfig.spend` | `a2129eb` |
| Appliance config wired (health 3/30s, spend $5/key, MoonPay link) | `local.gateway.config.mjs` (gitignored, local) | — |

Spend-breaker semantics: a key with recorded spend ≥ ceiling is blocked (402, `spend_ceiling_exceeded`, `topUpUrl`) until `reset()`; zero-cost (local/Ollama) traffic never blocks. Cost records post-completion from actual usage — providers that don't report usage record $0 (acceptable: free/unpriced).

Receipt surfaces owned by Shipyard: statusline, portal, connect output. Telegram summaries are a cross-project dependency (Hermes/OpenClaw would need to surface `x_shipyard`), not a spec feature.

## Phase 2 (deferred, in build order)

1. **`connect` v2 interactive flow:** hardware probe → ladder → offer `ollama pull` → PayBox-wallet-or-key → write agent env. Each agent gets its own key = its own spend ceiling (anchor/breaker identity is the API key — Hermes and Claude Code can't send custom headers).
2. **Conversation anchor** (model continuity keyed on API key; SQLite, TTL 24h). Honest scope: model continuity + top-up resume only — it does not resurrect crashed agents (they resend their own history).
3. **Appliance ops:** launchd plists for gateway + Ollama auto-restart (Survive applied to the box itself).
4. **Venice x402 burst-billing** in appliance mode (user wallet pays Venice directly — no gateway float, no treasury monitoring).
5. **Hosted-mode rollout** (Vercel): request-scoped only.

## Error-handling matrix (v2, honest)

| Failure | Behavior | Status |
|---|---|---|
| Provider 429/5xx at request start | Transparent failover to next rung + receipt | ✅ shipped |
| Provider dead repeatedly | Circuit opens (default 30s); selection skips it; failover routes around meanwhile | ✅ shipped |
| Context overflow | `isCapable()` rejects small-window models → next rung (pre-existing) + receipt | ✅ |
| Mid-stream cutoff | Committed stream: error propagates (no fake transparency; emitted tokens can't be unsent; SSE resumption out of scope) | documented |
| Key spend ≥ ceiling | 402 + top-up link; resume after reset/top-up | ✅ shipped |
| Wallet empty (x402 keyless) | 402 challenge (pre-existing); MoonPay deep-link with wallet prefill TBD | partial |
| Client crash/restart | Client resends history; anchor (Phase 2) preserves model continuity | Phase 2 |
| Gateway box reboot | launchd auto-restart | Phase 2 |

Out of scope (explicitly): agent-side breakage (e.g., Hermes' own session state). The gateway keeps the model layer alive; it cannot resurrect the agent process.

## Testing

- Contract tests for both wire shapes; chaos tests for failover/receipt/spend in the suite (`test/router.health.test.ts`, `test/gateway.failover-receipt.test.ts`, `test/gateway.spend.test.ts`).
- Full suite: **319 pass / 0 fail** (baseline 300 — +19 new tests, 0 regressions).
- Live smoke on the local gateway 2026-09-18: boots with health+spend enabled, `model: "auto"` routes to Ollama, 200.

## Decisions log

- **2026-09-18:** Approach 3 (gateway-first Lighthouse). Survive is the wedge, Pay is the moat.
- **2026-09-18:** Failover UX = B (transparent but noticed); interactive prompts reserved for expensive tier jumps (later).
- **2026-09-18:** Wallet-first onboarding; PayBox default, API key secondary; MoonPay for the no-crypto edge.
- **2026-09-18:** Venice as mid-tier x402 provider, not an Ollama replacement. Ollama remains the local tier.
- **2026-09-18:** v1 holistic review → v2: dual-mode topology (fixes Vercel-vs-localhost conflict), honest anchor scope, split request-start vs mid-stream failover semantics, added spend guardrail.
- **2026-09-18:** You-are-customer-zero: appliance mode is the default deployment; hosted is optional.
- **2026-09-18:** Phase 1 shipped. `model: "auto"` required for cross-candidate failover (pinning discovery).
