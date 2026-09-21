# Hopscotch Positioning Memo

**Date:** 2026-09-21
**From:** Shipyard Inference
**Re:** Hopscotch Labs — complementary, not competing

## 1. Division of labor

**Hopscotch Labs** (hopscotchlabs.ai — the ex-Uniblock team; we are friendly with them) raised $7.5M to build a hosted multi-provider gateway. Their strengths:

- 150+ models across 11 labs, hosted
- `hopscotch/auto` cost tiers with classified failover
- Prepaid balance / spend caps, BYO upstream keys

**Shipyard Inference** does not do hosted breadth. We do:

- **Local edge:** the appliance gateway runs on the user's Mac, colocated with Ollama — $0 for local traffic, served via a hardware ladder (local model first, then cloud).
- **x402 wallet pay-per-call:** Solana USDC, metered `upto` settlement — no prepaid balance, no billing relationship, agent-native.
- **Content-aware tier inference:** Jev/TypeSafe classify the request and pick the tier, instead of the user hand-selecting.

**Explicit statement: we never chase catalog count.** Catalog breadth is their lane; we treat model catalogs as a commodity we can route to, not a moat we need to build.

## 2. Integration options to float

We open the conversation with (a), and list all three:

**(a) Hopscotch as a router provider.** Our candidate ladder gains one `hopscotch` provider entry that fans out to their 150+ models via their OpenAI-compatible base URL (`https://hopscotchlabs.ai/v1`). Their breadth becomes our long tail — when no local model or hardware-ladder candidate fits, requests fall through to Hopscotch. We stay a thin client on their catalog.

**(b) Us as their local edge.** Their cloud catalog plus our appliance for $0 local traffic and x402 metered settlement. Their customers' agents get one endpoint that serves cheap-but-good locally and escalates to the hosted catalog — they extend to on-device without building an appliance.

**(c) Outcome-taxonomy alignment.** Both products adopt the same four-outcome classification — `rejected_pre_flight` / `truncated` / `client_abort` / `ok` — so shared customers get one mental model across both tools.

## 3. The ask

An intro call. We demo the local gateway plus the x402 demo stack: Surfnet billing and the browser payer chat portal. The pitch in one line: **you are the catalog, we are the edge — agents get both.**

## Spike findings (Task 0.2, spikes/hopscotch-provider.mts — throwaway)

**Interface compatibility.** `OpenAIProvider` pointed at `https://hopscotchlabs.ai/v1` is the entire integration: `createHopscotchProvider()` constructs an `OpenAIProvider` with `baseURL` + placeholder model and satisfies `LLMProvider` (chat + chatStream) with zero adapter code. No new provider class needed — the same shape as OpenRouter/Venice.

**Mapped cleanly:**
- Base URL / wire format: standard OpenAI `/v1` chat completions per their docs.
- Streaming: their SSE chunks flow through the existing `chatStream` delta parser; the usage-only terminal chunk is already tolerated.
- Auth: OpenAI SDK sends `Authorization: Bearer <key>`; if Hopscotch uses a custom header instead, `OpenAIProviderOptions.defaultHeaders` covers it — still no adapter class.
- Priority: dropping it into the candidate ladder as the lowest-priority cloud candidate is config, not code.

**Needs verification / possible adapter work (no API key exists — live run unverified):**
- Model naming: `hopscotch/auto` is a placeholder; need their real model IDs and whether their router-style default exists.
- `max_tokens` vs `max_completion_tokens` acceptance; `stream_options: { include_usage: true }` support.
- Tool-call chunk shape (function-tool deltas in OpenAI form?) — untested.
- Usage accounting in the terminal chunk (affects cost math / x402 metering).

**Open questions for the partnership call:**
1. Cost pass-through: wholesale + we settle, or metered pass-through at their list price?
2. BYO-key interplay: if users bring their own Hopscotch key, does our x402 pay-per-call layer coexist (skip billing on BYO-key routes)?
3. Whether their BYO-key mode means OUR users could pay Hopscotch directly — i.e. Shipyard routes but never touches Hopscotch spend, which changes where `createPayingFetch` hooks in (not at all, for those routes).
4. Rate limits / 402-vs-429 semantics on their side for the payment-layer retry path.
