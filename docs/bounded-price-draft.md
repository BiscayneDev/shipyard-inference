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

Scoped price principals use only their exact price ledger. Their chat auth never
collects x402; their nonstream path skips wallet drawdown, Tender and old fixed
connection holds. Other keys retain those existing paths unchanged. BYO routing
remains unsupported because it can substitute a different provider. It does not
redesign other billing, enable itself, grant budgets, or
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

## Native contract candidates, not deployment configuration

`nativeJevPriceContract` uses the current official $0.042/M input, free output,
64k total request-context limit with long context disabled. It reserves 2,688
microdollars per decision stage, then rounds actual valid input usage up. It
rejects other providers/model versions and missing usage. Native TypeSafe parsing
no longer converts missing usage counts to a false zero.

`nativeClaude45PriceContract` reserves the full 200k-context worst 5-minute cache
write price plus 2,048 output tokens: 780,720 microdollars ($0.780720) for Sonnet
4.5, with actual Haiku/Sonnet native usage settled by exact model and disjoint
input/output/cache counts. This is conservative held capacity, not expected cost.
Official Sonnet and Haiku model pages and prompt-caching docs supply rates. The
helper cannot be used for UsePod/OpenRouter/Hopscotch or premium/long-context
variants. Missing cache counters remain unknown, not silently zero.

A verified native adapter/config binding is required for either helper. No key,
provider selection, candidate filtering, live configuration or approval is added.
Current hosted app may configure proxy candidates, which remain unsupported until
their exact all-in terms are verified. Existing alternate payment hooks can remain
for other keys, but are bypassed for scoped price principals. Sonnet4.5
has a published retirement date of November30,2026; contract expiry must precede
that. Do not turn these optional helpers into a silent routing change.
