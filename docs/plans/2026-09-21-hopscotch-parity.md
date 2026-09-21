# Hopscotch Parity & Partnership Plan — Shipyard Inference

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Adopt the best of Hopscotch's model-layer UX (classified outcomes, project spend caps, BYO upstream keys, public catalog) while opening a partnership conversation that makes us complementary instead of head-to-head.

**Architecture:** All changes stay inside the existing gateway/operator surface — `src/gateway/` for policy, `src/router/` for outcome classification, `src/operator/` for portal surfaces. No new services. Node 25, TDD against `node --import tsx --test test/<file>.test.ts` with `test/helpers.ts`.

**Tech Stack:** TypeScript, Vercel AI SDK-compatible OpenAI endpoint, existing spend breaker (`src/gateway/spend.ts`), health tracker (`src/router/health.ts`), x402 (`src/gateway/x402-upto.ts`), operator portal (`src/operator/`).

**Context:** Hopscotch Labs (hopscotchlabs.ai, built Uniblock — we are friendly) raised $7.5M for a hosted multi-provider gateway: 150+ models, `auto` cost tiers, classified failover, prepaid balance. We are NOT competing on breadth. We win on: local appliance (Ollama, $0 traffic, hardware ladder), x402 wallet pay-per-call, Jev content-aware tier inference, agent-native `connect`. The plan hardens our shared strengths, then reaches for partnership.

---

## Track 0 — Partnership first (do this before building anything big)

The friendliest move is to make Hopscotch an *upstream* in our ladder rather than a rival.

### Task 0.1: Write the positioning memo (docs, no code)

**Objective:** One page that locks the "complementary, not competing" framing before any feature work drags us into breadth-racing.

**Files:**
- Create: `~/projects/shipyard-inference/docs/2026-09-21-hopscotch-positioning.md`

**Step 1:** Write the memo with three sections:
1. *Division of labor* — Hopscotch = hosted breadth (150+ models, prepaid); Shipyard = local edge (appliance + Ollama) + x402 settlement. We never chase catalog count.
2. *Integration options to float with them* (pick one to open with):
   - **Hopscotch as a gateway provider:** our router gains a `hopscotch` provider — one entry in the candidates ladder that fans out to 150 models via their base URL. Their breadth becomes our long tail.
   - **Us as their local edge:** their cloud catalog + our appliance for $0 local traffic and x402 metered settlement. Agents get one endpoint with both.
   - **Outcome-taxonomy alignment:** both products adopt the same four-outcome classification so shared customers get one mental model.
3. *Ask* — intro call; we show the local gateway + x402 demo stack (Surfnet, chat portal).

**Step 2:** Commit.
```bash
cd ~/projects/shipyard-inference && git add docs/2026-09-21-hopscotch-positioning.md
git commit -m "docs: Hopscotch positioning memo — complementary integration options"
```

### Task 0.2: Spike — Hopscotch as a router provider (throwaway)

**Objective:** Prove our candidate ladder can treat Hopscotch as just another upstream, before promising it in the partnership call.

**Files:**
- Create (spike, not shipping): `spikes/hopscotch-provider.mts`

**Step 1:** Read `src/providers/` to find the provider interface, then hand-roll a minimal provider pointing `baseURL` at `https://hopscotchlabs.ai/v1` with a test key.
**Step 2:** Wire it as the lowest-priority cloud candidate in a local config and send one request through `node --import tsx` — confirm a completion, streaming, and `x_shipyard` receipt come back.
**Step 3:** Record findings in the positioning memo (works / what breaks / cost pass-through question). Do NOT merge — this is the demo artifact for the call.
**Step 4:** Commit the spike.
```bash
git add spikes/hopscotch-provider.mts
git commit -m "chore(spike): Hopscotch as router provider — throwaway"
```

---

## Track 1 — Classified outcome taxonomy (their best idea, ours is close but implicit)

Their four outcomes: **rejected pre-flight** (nothing billed), **truncated** (paid for what arrived), **client abort** (billed partial, excluded from error rate), **your-key-no-debit** (BYO key). Ours records failover receipts but doesn't classify terminal outcomes.

### Task 1.1: Define the outcome enum + classifier

**Files:**
- Create: `src/router/outcome.ts`
- Test: `test/outcome.test.ts`

**Step 1: Write failing test**
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOutcome } from '../src/router/outcome.ts';

test('pre-flight rejection when router plan produced no candidates', () => {
  assert.equal(classifyOutcome({ attempted: 0, tokensEmitted: false, error: 'no_candidates' }), 'rejected_pre_flight');
});
test('truncated when first token flushed then upstream broke', () => {
  assert.equal(classifyOutcome({ attempted: 1, tokensEmitted: true, clientAborted: false, completed: false }), 'truncated');
});
test('client abort excluded from error classification', () => {
  assert.equal(classifyOutcome({ attempted: 1, tokensEmitted: true, clientAborted: true, completed: false }), 'client_abort');
});
test('ok on clean completion', () => {
  assert.equal(classifyOutcome({ attempted: 1, tokensEmitted: true, clientAborted: false, completed: true }), 'ok');
});
```
**Step 2:** Run `node --import tsx --test test/outcome.test.ts` → FAIL (module not found).
**Step 3:** Implement `src/router/outcome.ts` exporting `classifyOutcome(r: {attempted: number; tokensEmitted: boolean; clientAborted?: boolean; completed?: boolean}): 'rejected_pre_flight' | 'truncated' | 'client_abort' | 'ok' | 'provider_error'`. Rule: `attempted === 0` → pre-flight; abort after emit → `client_abort`; incomplete after emit → `truncated`; else `ok`/`provider_error`.
**Step 4:** Test PASS. **Step 5:** Commit `feat(router): classified outcome taxonomy`.

### Task 1.2: Surface outcome in `x_shipyard` receipt + request log

**Files:**
- Modify: `src/gateway/serve.ts` (end-of-stream trailer construction)
- Test: `test/x-shipyard-receipt.test.ts` (extend existing — find via `search_files('x_shipyard', path='test')`)

**Step 1:** Extend the trailer test: receipt gains `outcome` field; mid-stream client disconnect yields `outcome: 'client_abort'` and cost still recorded. **Step 2:** FAIL. **Step 3:** Thread the classifier into trailer construction; keep the frame a valid OpenAI chunk shape (`choices: []`) — the AI_TypeValidationError trap. **Step 4:** PASS, run `npm run typecheck && npm test`. **Step 5:** Commit.

### Task 1.3: Publish the billing rule (docs)

**Files:** Create `docs/billing-outcomes.md` — one row per outcome: billed or not, error-rate counted or not, retry policy. Mirrors `src/router/retry.ts` semantics (429 retried once → capacity; unavailable → cooldown; malformed/context-length → never retried).

---

## Track 2 — Project-level spend cap (answer to "agent in a loop drains the balance")

### Task 2.1: Two-tier cap in the spend breaker

**Files:**
- Modify: `src/gateway/spend.ts`, `src/gateway/config.ts` (`GatewayConfig.spend` gains `project?: { ceilingUsd: number; windowMs: number }`)
- Test: `test/spend-breaker.test.ts` (extend)

**Step 1:** Extend tests: per-key breaker behaves as today; a new aggregate cap rejects ANY key once aggregate recorded spend crosses `project.ceilingUsd` within the window (402 + `topUpUrl`); free/zero-cost requests still pass (the existing "free traffic never blocks" rule applies to per-key blocklists only — a drained project stays drained). **Step 2:** FAIL. **Step 3:** Track aggregate in the same store the per-key breaker uses, keyed by a project id (default `'default'` when config omits it). **Step 4:** PASS + full gate. **Step 5:** Commit `feat(gateway): project-level spend cap`.

### Task 2.2: Pre-flight refusal message says WHICH cap fired

**Files:** Modify the 402 body construction in `src/gateway/spend.ts`/`serve.ts`; extend breaker test asserting body contains `cap: 'key' | 'project'`. Same TDD loop. Commit.

---

## Track 3 — BYO upstream keys ("your key, your bill")

### Task 3.1: Per-provider upstream secret in config

**Files:**
- Modify: `src/gateway/config.ts` (new `byok?: { provider: string; apiKeyEnv: string }[]`)
- Modify: provider construction in `src/providers/` — when a BYO key exists for a provider, its candidates are tried BEFORE shared-pool candidates for that provider and record `costUsd: 0` + `billed: false` in the receipt.
- Test: `test/byok-ordering.test.ts`

**Step 1:** Test: two candidates for `anthropic` (BYO then shared); BYO attempt succeeds → receipt shows `billed: false`, cost 0, spend breaker untouched. **Step 2:** FAIL. **Step 3:** Minimal implementation: ordering at `Router.plan()` + receipt flag. **Step 4:** PASS + gate. **Step 5:** Commit `feat(gateway): BYO upstream keys — your key, your bill`.

### Task 3.2: Portal shows debited vs not-debited

Modify `src/operator/aggregate.ts` feed join: requests carry the `billed` flag through; Appliance/usage feed renders "not debited (own key)" chip. Manual verify via operator server on 8799.

---

## Track 4 — Public catalog page (our differentiator: hardware-fit column)

### Task 4.1: Catalog data module

**Files:** Create `src/catalog/models.ts` — one entry per model in our ladder: slug, provider, in/out price, context, `hardwareFit` (min VRAM/RAM from the hardware ladder), `localAvailable`. Source prices from `src/router/pricing.ts` — do NOT duplicate numbers.
Test: `test/catalog.test.ts` — every catalog entry resolves to a real candidate in `src/router/candidates.ts` (no orphan catalog rows).

### Task 4.2: `/catalog` page in the operator portal SPA

**Files:** Create `src/operator/public/catalog.js` + hook into the existing SPA shell (see `src/operator/public/`); server route in `src/operator/server.ts` serving `GET /api/catalog` from the module. Columns: model, provider, price, context, hardware fit ("runs on 8GB M2" / "needs 32GB" / "cloud only"), local available. Verify: `node dist/operator/bin.js` (port 8799) → curl `/api/catalog`, open page.

---

## Track 5 — Playground (defer until after partnership call)

Same-prompt model comparison on the chat portal using the existing browser x402 payer — every test call is a real paid call, which *is* the billing-rule demo. Hold this until Track 0 tells us whether Hopscotch integration makes "compare across 150 models" a free win instead of a build.

---

## Suggested order

1. Track 0 (memo + spike) — shapes everything else, unblocks the friendly conversation
2. Track 1 (outcomes) — small, high-trust-signal
3. Track 2 (project cap) — small
4. Track 3 (BYOK) — medium; doubles as appliance selling point
5. Track 4 (catalog) — the public-facing differentiator
6. Track 5 — parked pending Track 0 outcome

**Standing rules from skills (apply throughout):** agents request `model: auto`; custom SSE telemetry only in valid OpenAI chunk shape; mid-stream cutoffs never fail over — the `truncated` outcome reflects this, don't promise transparent recovery; verify live git/build state before claiming done (sibling agents run in this repo).
