# Tender: impressions-first (clicks are a partner-terminal capability)

Status: Accepted · Scope: Tender ad product · Date: 2026-06-15

## Decision
The **impression** — a sponsored line shown during a real, billed inference wait — is
Tender's canonical trackable and payable unit. **Clicks are deferred** to an optional
capability available only on partner terminals that can render a hyperlink in the
sponsored line. Claude Code (and any text-only spinner) is impression-only.

## Why
- A click needs an actionable line. The spinner in Claude Code is plain text — not
  clickable — so a click is physically impossible there. Building click billing as a
  core unit would price a behavior most surfaces can't produce.
- Partner terminals that opt into rendering a hyperlink *can* support clicks later; that
  makes clicks a per-surface capability, not a platform primitive.
- Impressions work on every surface and are already the live settlement path.

## What this means in the code (today's reality)
- Live settlement bills **impressions only**: `GatewayTender.serve()/settle()`
  (`src/tender/gateway-tender.ts`) → release gate (`src/tender/attestation.ts`) →
  requester + provider split accrual. The gateway never calls `accrueClick`.
- `accrueClick` / `CLICK_MULTIPLIER` / `Placement.endpointUrl` remain as an OPTIONAL,
  unused-by-core capability (kept for partner terminals + the chat-portal example). They
  are not load-bearing and can stay dormant.

## The honesty gap to close before leaning on impression billing
"Impression" today = *selected during a billed wait*, NOT *confirmed displayed*.
`PlacementSurface.render()` is fire-and-forget — no proof the line painted, for how long,
or at all. If impressions are THE billed unit, advertisers will scrutinize this. The
strengthening (deferred, not done here) is a **render receipt**: the surface acknowledges
it displayed the line (and duration), and that ack joins the release gate so an impression
only settles when "seen" is real.

## Deferred implementation options (when we choose to build)
1. **Gate clicks behind surface capability** — add `capabilities?.canRenderHyperlink` to
   `PlacementSurface`; make `endpointUrl` optional; only hyperlink-capable surfaces render a
   link and may bill clicks. Small, isolated change; impression path untouched.
2. **Render receipt (recommended)** — surfaces send back a display acknowledgment; fold it
   into `assertValidAttestation` so "seen" is provable. This is the real moat for
   impression billing.

## Constraints noted for later
- Buoy (the x402 endpoint provider for clicks) is **Solana-only**; impressions/payouts
  already support Solana + Base. Clicks would lag Base until Buoy supports it.
- Click economics stack fees (agent pays the API via x402 + advertiser pays Tender from
  escrow) — model advertiser ROI before enabling.

## Open questions
- Render-receipt transport + how to measure display duration without a heavy protocol.
- Whether to keep `accrueClick`/`CLICK_MULTIPLIER` exported or remove until a surface needs them.
- Dedupe/anti-fraud for impressions once render receipts exist.
