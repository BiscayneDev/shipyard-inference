# Bounded Jev smoke checks

`POST /v1/decisions` accepts optional `noFallback: true`. It invokes the first
configured decision backend at most once, retaining configured provider order
and model defaults. Failure returns 502 instead of trying another backend or
the stub. Unsupported providers are refused without invoking inference.
Omitting the field or setting false preserves existing fallback behavior.

A read-only authenticated `GET /v1/models` advertises
`x-shipyard-decision-attempt-limit: 1` when this control is available. Bounded
clients must check that header before any potentially billed POST. Old servers
can ignore unknown body fields, so sending noFallback without this preflight is
NOT safe. The POST also returns the header when enforcing the control, including
backend failures. Verify the active deployment/revision before testing; a mixed
old/new deployment can invalidate a prior capability check.

This is an upstream-attempt boundary, NOT a dollar cap, budget, receipt, global
quota, or billing/telemetry redesign. One failed attempt can still incur a charge.
It does not change charging, settlement, usage recording, normal provider
selection, or chat behavior. It does not limit a provider's internal infrastructure;
it prevents retries/fallback in these Shipyard adapters (each issues one fetch).

For the authorized fictional UI smoke test: preflight the deployed control,
then perform at most three sequential POSTs with noFallback true and no model
override. Consume an attempt before dispatch, including timeouts/errors; no
retries, no coding-model calls, no automatic resume. Stop on error, missing
acknowledgment, weak answers, or stub response. Keep Dinghy's UI flag OFF.
A local harness must refuse to start if its saved attempt ledger already exists,
so process restarts cannot silently rerun the test. This PR does not execute it,
merge itself, deploy, or change production configuration.
