# Venice Video Endpoints → Buoy x402 Proxy Setup

This guide explains how to register Venice's video generation API as a
[Buoy](https://openshipyard.xyz/buoy) x402 pay-per-call proxy. Buoy wraps any
upstream API with x402 payment gating — agents pay in USDC on Solana per call,
Buoy verifies the payment cryptographically, then forwards the request.

## Prerequisites

| Variable       | Description                                      |
|----------------|--------------------------------------------------|
| `BUOY_API_KEY` | Your Shipyard/Buoy API key (`sk_live_...`)       |
| `VENICE_WALLET` | Solana wallet address for receiving USDC payouts |
| `BUOY_BASE_URL` | Optional — defaults to `https://openshipyard.xyz` |

## Venice Video Endpoints

Venice's API (`https://api.venice.ai/api/v1`) exposes four video routes:

| Endpoint           | Method | Purpose                          | Buoy Price |
|--------------------|--------|----------------------------------|------------|
| `/video/queue`     | POST   | Async video generation           | $1.00      |
| `/video/quote`     | POST   | Get USD price before generating  | Free       |
| `/video/retrieve`  | POST   | Poll for completion              | Free       |
| `/video/complete`  | POST   | Cleanup after generation         | Free       |

The `/video/queue` endpoint is the billed call. The remaining endpoints are
free so agents can poll status and fetch price quotes without incurring cost.

## Pricing Rationale

Venice charges approximately $0.16 per call for models like `gemini-omni-flash`.
Buoy charges $1.00 — a margin that covers payment processing overhead and the
x402 verification round-trip. Adjust the price in the script if needed.

## Running the Setup

```bash
BUOY_API_KEY=sk_live_... \
VENICE_WALLET=<your-solana-wallet> \
node scripts/setup-venice-buoy.mjs
```

The script performs four steps:

1. **Create proxy** — `POST /api/v1/x402/setup` with the Venice upstream URL,
   your wallet, and a default price.
2. **Scan endpoints** — `POST /api/v1/x402/scan` detects OpenAPI endpoints.
3. **Set pricing** — `PUT /api/v1/x402/{listingId}/pricing` sets per-endpoint
   prices for the four video routes.
4. **Verify** — `GET /api/v1/x402/{listingId}` confirms the final config.

## After Setup

Buoy publishes a proxy URL (`/x/your-slug`). Agents call that URL with an x402
payment header instead of hitting Venice directly. Buoy verifies payment, then
forwards to the Venice upstream. Payouts land in your configured Solana wallet.

## Custom Pricing

Edit the `ENDPOINT_PRICING` map in `scripts/setup-venice-buoy.mjs` to adjust
per-endpoint prices before running, or re-run the script with different values
to update pricing on an existing listing.
