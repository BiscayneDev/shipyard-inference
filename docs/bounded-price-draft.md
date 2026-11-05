# Request-bound price path (draft, not activated)

This default-absent path is a dependency for bounded Dock specialist calls. It
preserves Jev tier selection and the configured coding candidate order. No model
pin is introduced. Normal keys retain their existing behavior.

An operator explicitly lists SHA256 bearer principals that require quoted chat.
These principals cannot call decisions, messages, previews, or unquoted chat.
`POST /v1/chat/quote` authenticates, bounds a nonstream `auto` request, and saves
its exact serialized body digest, principal, reviewed configuration revision,
expiry, and maximum price. Quote creation calls no inference. Task-class/latency
routing headers and conflicting output limits are refused on this narrow path.

Every configured tier, coding and guardrail provider needs a current reviewed
all-in price contract. The maximum is tier bound + largest possible coding bound
+ guardrail bound. Catalog estimates are not contracts. There are no real vendor
contracts configured by this PR. The supplied fixture values prove only flow.
A contract must account for tool schema/framing, prompt caching, reasoning,
failed calls and any hidden transport retries. `accepts` validates complete exact
stage input before dispatch; `actualCostMicros` must return authoritative all-in
charge, not a guessed token-price multiplication. Unsupported cases refuse.

Quoted chat atomically consumes and reserves against the private scoped ledger
before Jev runs. Hooks guard each actual stage, allow no second invocation of a
stage, and validate the complete input against its reviewed contract. Guardrail
inference is awaited on this path, then settlement is awaited before output.
Unknown usage, uncertain HTTP outcomes or failed settlement retain the full hold
for reconciliation. No automatic retry or release. Identical body/principal
cannot be served again using a new quote. This conservative rule may refuse an
intentional repeated prompt; changing that requires explicit request identity
semantics, not weakening replay protection.

Alternate payment hooks, BYO keys, wallet drawdown, Tender and the old fixed-hold
connection ledger are incompatible with this draft configuration and refused at
startup. It does not redesign their billing, enable itself, grant budgets, or
change existing production configuration. The draft SQL and service-role adapter
must be independently reviewed/applied before activation; no memory store is the
production default. Storage outages refuse service. No expiry automatically
releases an uncertain reserved charge.

Proof: `test/gateway.bounded-price.test.ts` and existing bounded-chat tests cover
actual in-process gateway/router/Jev/coding/guardrail ordering, scoped-key bypass
refusal, changed identity/body/revision, quote replay/concurrency, unknown charge
and failed settlement. `scripts/prove-bounded-price-db.py` checks actual local
PostgreSQL atomic holds/settlement, conflicts, eight-way concurrency and retained
unknown charges. Fixtures are fictional; no provider calls or production writes.

Remaining: authoritative live stage contracts, stable deployed revision,
private schema/config activation, Dock consuming the quote/settlement protocol,
and qualified isolated runtime/egress/watchdog. This source is not a shipped
bounded inference service.

The full local inference suite currently reports 599 passing and one failure in
`operator.server.test.ts` (hardware ladder probe expects `probed` but receives
`fallback`). The same isolated test fails on pristine base c16fdf9 in this
environment. The focused price/bounded-chat tests and typecheck/build pass.
