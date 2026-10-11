# Agent Self-Funding Loop (Orbio crossover P0/P1) Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan workstream-by-workstream.

**Goal:** Agents fund and identify themselves against the Shipyard Inference gateway with zero human checkout — wallet-signed API keys, a one-call USDC top-up that mints credit balance, and an MCP server exposing balance/usage/top-up to any MCP client (Claude Code, Cursor).

**Architecture:** Two parallel workstreams on disjoint file sets. WS-A extends the gateway (wallet-key issuance + x402 top-up route + docs). WS-B adds a standalone stdio MCP server that is a thin REST client of the gateway. Both branch off fresh `main` (`a35d16c`), TDD throughout, never merge or deploy — the controller merges in risk order.

**Tech Stack:** TypeScript (gateway repo, tsc + `node --test --import tsx test/*.test.ts`), node:crypto Ed25519, existing x402 machinery (`src/gateway/x402.ts`, `x402-upto.ts`), existing credit stores (`MemoryCreditStore`, `SupabaseCreditStore` via `creditStore` in `GatewayConfig`), `@modelcontextprotocol/sdk` (WS-B only).

**Repo:** `~/projects/shipyard-inference` (BiscayneDev/shipyard-inference). Node 25 required: `export PATH=/opt/homebrew/bin:$PATH`. Commands: `npm run typecheck`, `npm test`, `npm run build`.

---

## Out of scope (do NOT build)

- Transferable/tradeable credit of any kind (SHIPusd stays non-transferable by design — `~/shipyard-os/docs/ship-credits-design.md`)
- ORBIO-style tokens, staking, launchpad, discount curves/order book
- Metering Buoy tools against credit (P1, later round)
- Any change to Hopscotch/OpenRouter provider wiring

## Sibling-agent rules

- Branch off `origin/main` AFTER `git fetch && git pull --rebase`. Rebase before every push; pushes may be rejected — pull --rebase and retry.
- Own ONLY your workstream's files. Never touch the other workstream's files.
- Never merge, never deploy, never `vercel` commands. Leave branch pushed; controller merges.
- Never read/write another project's `.env*` (arken rule). Repo's own `.env.local` only.
- Commit after every task: `type: concise subject`.

---

## Workstream A — Agent self-funding loop (branch `feat/agent-topup`)

**Owns exclusively:** `src/gateway/keys-wallet.ts`, `src/gateway/topup.ts`, `src/gateway/server.ts`, `app.ts`, `scripts/agent-selffund.mts`, `docs/agents.md`, `test/keys-wallet.test.ts`, `test/gateway.topup.test.ts`. Do NOT touch `package.json`, `mcp/`, `docs/mcp.md`.

### Task A1: Wallet-signed key issuance

**Objective:** An agent proves control of a Solana wallet with an Ed25519 signature and receives a normal gateway API key bound to that wallet — no website, no checkout.

- **Read first:** `src/gateway/keys.ts` (key model + store), `src/gateway/dev-keys.ts` + `src/gateway/self-serve.ts` (recent key-issuance patterns and their tests), `src/gateway/auth.ts`.
- Create `src/gateway/keys-wallet.ts`:
  - `challengeForWallet(pubkey: string): string` — deterministic challenge string embedding `pubkey`, a caller-supplied nonce, and `SHIPYARD_WALLET_KEY_DOMAIN ?? 'shipyard-inference'`.
  - `verifyWalletSignature({ pubkey, nonce, signatureB58 }, expectedMessage): boolean` — base58-decode the 64-byte signature, build the Ed25519 public key from the raw 32-byte pubkey by prefixing the SPKI header `302a300506032b6570032100`, verify with `node:crypto`. (Mirror of the existing voucher-signing code, verification side.)
  - `createWalletKeyIssuer(store)` — verifies challenge + signature, then mints a key through the SAME key store/API the other issuers use, with metadata `{ wallet: pubkey }` so balance and audit trail bind to the wallet.
- Tests in `test/keys-wallet.test.ts`: sign with a generated keypair (PKCS#8-wrap the 32-byte seed: prefix `302e020100300506032b657004220420`), happy path issues a key; wrong signature rejected; replayed nonce rejected; malformed pubkey rejected.
- Wire the route in `src/gateway/server.ts` (or wherever routes register): `POST /v1/keys/wallet` `{ pubkey, nonce, signature }` → `{ key }`. Unauthenticated by design — the signature IS the auth.
- Commit: `feat(gateway): wallet-signed API key issuance`

### Task A2: One-call top-up (USDC → credit balance)

**Objective:** The `buyAndActivate` analog: one signed request pays real USDC and immediately credits the caller's wallet-bound key balance.

- **Read first:** `src/gateway/x402.ts` (exact-scheme verify + settle), `src/gateway/x402-upto.ts`, `src/gateway/spend.ts`, and how `creditStore` is consumed in `app.ts` (~lines 257–264, 1236, 1271) — reuse the SAME credit-store mutation the existing flows use. Do not invent a parallel balance.
- Create `src/gateway/topup.ts`:
  - `POST /v1/topup` with `Authorization: Bearer <wallet-issued key>`: body `{ amountUsd }` (min 0.01, max 1000). Gateway returns a standard x402 `402` challenge (exact scheme, `amountUsd` as the price). Client pays; gateway verifies + settles, then credits the key's balance `amountUsd` through the credit store and returns `{ balanceUsd }`.
  - Keyed requests that already carry a valid balance skip payment (mirror the existing auth/x402 coexistence rule).
- Tests in `test/gateway.topup.test.ts`: 402 challenge issued with correct price; paid settlement credits balance (MemoryCreditStore); under/over-limit amounts rejected; non-wallet key gets 404-or-clear-error per existing auth conventions.
- Commit: `feat(gateway): x402 one-call topup crediting wallet key balance`

### Task A3: Agent-facing example + docs

- `scripts/agent-selffund.mts` — runnable loop against a LOCAL gateway: request without key → 402 → solve challenge → `POST /v1/keys/wallet` → `POST /v1/topup` → pay → make a chat completion. Model it on `scripts/localnet-paid-call.mts` (same patterns, same localnet env handling; write no secrets anywhere).
- `docs/agents.md` — the "no human in the loop" page: challenge/sign/issue/topup/serve sequence with curl + TS snippets, and the Surfnet/localnet env matrix for testing.
- Commit: `docs: agent self-funding loop guide + example script`

---

## Workstream B — MCP billing server (branch `feat/billing-mcp`)

**Owns exclusively:** `mcp/**`, `docs/mcp.md`, `package.json`, `package-lock.json`, `test/mcp-billing.test.ts`. Do NOT touch `app.ts`, `src/gateway/server.ts`, or any gateway source.

### Task B1: MCP server skeleton + tools

- `mcp/server.ts` — stdio MCP server (`@modelcontextprotocol/sdk`) whose tools are thin REST clients of a configurable gateway URL + key (env `SHIPYARD_GATEWAY_URL`, `SHIPYARD_GATEWAY_KEY`; arg overrides for testing):
  - `shipyard_balance` → key balance (via whatever balance/me endpoint exists — READ `src/gateway/server.ts` and `src/gateway/keys.ts` to find the real one; if none is exposed, call `/v1/topup` GET semantics is NOT allowed — instead expose balance from the key-info endpoint that exists, or return a clear "not exposed yet" error string; do NOT add gateway routes)
  - `shipyard_usage` → recent usage/receipts (reuse any existing usage endpoint; same rule)
  - `shipyard_models` → `GET /v1/models`
  - Every tool returns compact JSON; network errors become tool errors, never thrown stack traces.
- Add `mcp` entries to `package.json`: `"shipyard-mcp": "mcp/server.ts"` style bin/script + devDependency on the SDK. Run via `node --import tsx mcp/server.ts`.
- Tests in `test/mcp-billing.test.ts`: start the server programmatically, call each tool with a mock gateway (local http server), assert tool output shape and error handling.
- Commit: `feat(mcp): billing MCP server — balance, usage, models`

### Task B2: MCP docs

- `docs/mcp.md` — Claude Code / Cursor / Codex config snippets (stdio command), env vars, tool list, and the note that `shipyard_topup`-style self-funding arrives with the `/v1/topup` route (Workstream A) — leave a stub tool OUT; document only what exists.
- Commit: `docs(mcp): wire the billing MCP into clients`

---

## Controller sequence (after both workstreams)

1. Verify each branch: run `npm run typecheck && npm test && npm run build` on each.
2. Merge order: `feat/agent-topup` first (risk), then `feat/billing-mcp` (rebase onto it; only shared file is package.json-adjacent — resolve simply).
3. Full suite on merged main; final integration review; push.
4. Local e2e on the Surfnet/localnet stack per the existing skill runbook (402 loop) before any deploy.

---

# Round 2 (2026-10-11, post-merge): balance drawdown + dogfood

**Discovery:** keyed requests record spend against the breaker but never DEBIT `config.creditStore` — a topped-up balance is decorative. Round 2 closes the loop:

## Task R1: Balance drawdown on keyed requests (branch `feat/balance-drawdown`)
- Pre-flight: for wallet-bound keys (account has a balance account), check balance > 0 before serving; exhausted → 402 `insufficient_balance` with the x402 top-up challenge/hint. Free ($0) traffic always passes. Non-wallet keys (dev/owner) unchanged.
- Post-completion: debit ACTUAL costUsd from the credit store (same identity the topup credited — `auth.account.userId`/balanceAccount). BYO-key routes (`billed === false`) and $0 local traffic never debit. Debit must be idempotent per request id (replay-safe like topup's consumed map).
- Per-key ceiling at issuance: wallet-issued keys accept an optional operator-configured default ceiling (spend tracker) so a stolen key can't drain faster than the balance allows.
- Tests: funded key serves and balance declines by actual cost; exhausted key blocked pre-flight with top-up hint; free model never debits/blocks; BYO route never debits; double-settle cannot double-debit.

## Task R2: `shipyard_topup` MCP tool (branch `feat/balance-drawdown`, same WS)
- Add to `mcp/server.ts`: triggers `POST /v1/topup` with the configured key, returns the 402 challenge payload (payTo/amount/nonce) + current balance; when the gateway responds 200 (already settled), returns `{balanceUsd}`. The MCP process does not hold a Solana wallet — payment happens via the wallet path (createPayingFetch in the agent's own runtime).

## Task R3: Dogfood on prod (controller, after R1 merges)
- Mint a prod key for a real agent runtime (Bonnet), fund it with ~$1 REAL mainnet USDC (payer = operator wallet, pays our own treasury — needs user-provided funding wallet), wire the Bonnet Hermes profile to the prod base URL + key, run a real session, show balance declining. Blocked on user for the funding wallet.

## Task R4: SHIPusd design doc update (separate repo: ~/shipyard-os/docs/ship-credits-design.md)
- Add the live third acquisition path (agent self-funding via x402 top-up, one-call), document drawdown semantics (burn-on-settle, per-request debit, idempotent), per-key ceilings, and sketch Buoy tool-metering as the next surface (out of scope to build this round).
