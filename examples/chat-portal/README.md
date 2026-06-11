# Chat portal — Shipyard in an agentic interface

A Claude-style chat UI that runs **in front of the Shipyard `Router`**. Connect a
wallet, pick a model (or let Shipyard route to the cheapest capable one), and chat
with streaming replies — every answer shows exactly what it **cost**, what the same
prompt would have **cost direct** (the baseline), and what you **saved**.

Crucially, **there is no provider API key here.** Inference is paid *through*
Shipyard from a wallet — a UsePod prepaid USDC balance or per-request x402/Paybox
USDC — and a keyless **demo** mock lets you explore the UX offline. This is the
reference front-end for the gateway: how a product (like
[Dock](https://github.com/BiscayneDev/dock)) lets end users reach frontier models
through their own wallet, **cheaper than going direct**, with provable savings.

```
browser ──/api/chat (SSE)──▶ portal server ──▶ Router (costOptimized, baseline)
   ▲                              │                 └─ wallet-funded provider
   └────── cost / saved ──────────┘                    (demo · UsePod · x402)
        meter → settle (wallet)
```

The browser never holds a key, and neither does the server: payment rides under
the provider (UsePod token balance, or x402-on-Solana). The Router is where
per-request cost and savings are measured (`request_completed` → `actualCostUsd` /
`baselineCostUsd` / `savedUsd`).

## Run it

From the repo root — **no keys required**, it boots in demo mode:

```bash
npm run build                         # the portal imports the built SDK from ./dist
node examples/chat-portal/server.mjs
# → http://localhost:8788
```

Demo mode uses a built-in mock model (bills nothing) so you can explore the whole
UX offline. Point it at real wallet-funded inference by setting one of the modes
below — the model picker, pricing, and savings all switch automatically.

## Inference modes (auto-detected)

The server picks a mode at boot from the environment, in this priority order.
Every mode routes through the Shipyard `Router`, so cost-routing, caching, and
savings work the same regardless of how inference is paid for. **Real inference
is always wallet-funded — there is no provider-API-key path.**

Inference (how a reply is *produced*) and settlement (how it's *paid for*) are
separate. You do **not** need an x402 inference endpoint for real billing — that's
only the optional pay-per-request mode below.

**Inference mode** | Trigger | What runs the model
:-- | :-- | :--
**usepod** (recommended) | `USEPOD_TOKEN` | Prepaid USDC balance proxy — auth is the funded token, **no API key, no endpoint to stand up**. Routes to the cheapest provider.
**paybox x402** (advanced) | `SHIPYARD_X402_URL` (or `USEPOD_X402_URL`) + `PAYBOX_CREDENTIAL_ID` | Pays the model *per request* over x402 from a Paybox wallet. Needs a true x402 inference endpoint — most setups don't use this.
**demo** (default) | _no env_ | Built-in mock model. Nothing is billed.

**Settlement** layers on *any* inference mode: set `SHIPYARD_TREASURY_WALLET` +
`PAYBOX_CREDENTIAL_ID` and every `/api/settle` runs a real on-chain `payboxSettle()`
(metered USDC → treasury). Without a treasury it's simulated, so the demo stays runnable.

### Go live (the real path Dock uses — no x402 endpoint, no Buoy)

Inference through Shipyard on a wallet-funded provider (UsePod), spend metered, then
**`payboxSettle()` moves the metered USDC on-chain from the Paybox wallet to a
treasury** — the receipt chip links to the real tx. This is exactly
[Dock](https://github.com/BiscayneDev/dock)'s model.

```bash
# 1. Authenticate Paybox (once). The scoped `pbxk1` signing key enables hands-off,
#    in-process signing (autonomous grant) — no per-settlement passkey tap.
paybox login                                  # or: export PAYBOX_API_KEY=... PAYBOX_SIGNING_KEY=pbxk1...

# 2. Wallet-funded inference — UsePod prepaid USDC (no endpoint, no API key):
export USEPOD_TOKEN=<funded-usepod-token>

# 3. Real settlement — metered USDC → your treasury, on-chain:
export PAYBOX_CREDENTIAL_ID=<wallet-credential-id>
export SHIPYARD_TREASURY_WALLET=<solana-treasury-address>
export SHIPYARD_SETTLE_NETWORK=devnet         # rehearse on devnet first (test USDC)
export SHIPYARD_SETTLE_USDC_MINT=<mint>       # e.g. Nebula devUSDC on devnet
# export SHIPYARD_SETTLE_RPC_URL=https://...  # optional custom RPC

node examples/chat-portal/server.mjs
# boot log:  inference: usepod
#            settle:    REAL · <payer> → <treasury> (devnet)
```

A settle failure leaves the spend pending and retries next turn (never double-charges).
**Prove it on devnet before mainnet** — the on-chain path spends real USDC.

> **Buoy?** No. [Buoy](https://openshipyard.xyz/buoy) wraps *your own* API behind x402 to
> *sell* it on the marketplace — it's the provider side. You'd only use it to *create* an
> x402 endpoint for the advanced pay-per-request mode, which this path doesn't need.

The active mode shows as a badge in the top bar (amber **demo** vs. green
**usepod** / **paybox · live**), so it's always clear when real inference is on.

## What to try

1. **Auto routing** — leave the picker on *Auto — cheapest capable* and send a
   prompt. The reply chip shows the economy model ran and a green **saved** chip
   versus the standard-tier baseline.
2. **Pin a model** — open the picker: each model shows its live **price**
   (`$in · $out / Mtok`), a tier badge, and a **savings-vs-baseline** preview, so
   you can see the cheaper option before you pick it. Pin one to force it.
3. **Connect a wallet** — use *Connect Paybox* (Shipyard's USDC smart account)
   or bring an existing wallet (*Phantom* / *MetaMask*). Each turn meters `chargedUsd`
   (= `min(actual × (1 + margin), baseline)`) as **pending**, then settles it from
   the balance; the **session savings** card accumulates total spent / saved / %.
4. **Read the receipt** — every settled turn appends a **`settled $… · <tx> ↗`**
   chip linking to the Solana explorer, with the settlement latency in ms. In
   **x402** mode that's the real on-chain signature; in demo/usepod it's a
   realistic stand-in.
5. **Top up** — use *Top up* in the wallet card to deposit USDC into the account.
6. **Rich replies** — answers render as markdown: headings, lists, links, and
   syntax-styled **code blocks** with a per-block copy button. Each reply also has
   **Copy** and **Regenerate** actions.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `USEPOD_TOKEN` | — | Turn on real inference, wallet-funded via UsePod (prepaid USDC, no API key). |
| `SHIPYARD_X402_URL` | — | A true x402 inference endpoint (with `PAYBOX_CREDENTIAL_ID`). |
| `PAYBOX_CREDENTIAL_ID` | — | Paybox wallet that pays per-request x402 USDC. |
| `SHIPYARD_X402_FAMILY` | `openai` | API surface of the x402 endpoint (`openai`/`anthropic`). |
| `SHIPYARD_SETTLE_NETWORK` | `devnet` | Solana cluster for x402 payment. |
| `PORT` | `8788` | HTTP port. |
| `PORTAL_BASELINE_MODEL` | mode's standard model | Model the savings baseline is priced against. |
| `PORTAL_MARGIN_PCT` | `15` | Margin added to actual cost when charging (still capped at baseline). |
| `PORTAL_DEMO_BALANCE_USD` | `5` | Starting wallet balance shown in the UI. |

## Meter-then-settle

Spend accrues as `pendingUsd` per turn, then `POST /api/settle` moves it to
settled and decrements the wallet — the same shape Shipyard uses for real billing.
In **usepod** mode the USDC is actually debited upstream per request (the local
balance mirrors it); in **x402** mode `/api/settle` is where
[`payboxSettle()`](../../src/payment/settle.ts) would settle `pendingUsd` to a
treasury. Demo mode simulates it in memory so the portal stays fully runnable
without any wallet.
