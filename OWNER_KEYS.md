# Owner-issued project keys

`/owner/keys` is an operator-only issuance form. The write endpoint is
`POST /api/owner/keys`, authenticated with `SHIPYARD_OPERATOR_TOKEN`. Anonymous
self-serve stays paused; existing `/api/keys` behavior is unchanged.

Before issuance, add the project's cap to `SHIPYARD_PROJECT_CAPS`, preserving
all existing entries. Proposed buoy-credits entry: `"buoy-credits":20` ($20/day).
This is a proposal, not an approved production budget. The operator must confirm
and configure it before minting. An unknown/uncapped project returns 409.

Example request body (no secret):

```json
{"projectId":"buoy-credits","label":"buoy-credits","scopes":["models:read","chat:write","messages:write","tokens:count"]}
```

The returned plaintext key is shown once, with `Cache-Control: no-store`. Store
it directly in a secret manager, then set `SHIPYARD_INFERENCE_KEY` in the local
buoy-credits environment. Never paste it into a PR, log, or chat. The form keeps
it masked and holds the operator token only in memory, clearing it on success.

Scopes are enforced on `/v1/*`: scoped keys are denied every endpoint not
explicitly allowed (including video and decisions). Keys without scopes retain
legacy behavior. Model and provider selection remain the gateway's job; owner
issuance accepts neither pins nor caller-provided budget overrides.

Keys for the same project share the existing persisted UTC-day spend ledger.
The existing cap is a budget guard, NOT a strict payment ceiling: requests can
cross the cap before their cost is recorded, concurrent requests can overshoot,
and spend-store failures fail open. This change does not alter those semantics.
No migration or spending is performed by this PR.
