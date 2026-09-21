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
