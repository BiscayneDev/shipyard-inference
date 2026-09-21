# Billing Outcomes

Every request that reaches the inference gateway ends in exactly one **terminal
outcome**, surfaced as `x_shipyard.outcome` on the streaming receipt (OpenAI SSE
trailer chunk) and classified by `classifyOutcome()` in `src/router/outcome.ts`.
The outcome is the shared vocabulary for three downstream decisions:

- **Billed or not** — whether wallet spend / metered usage is recorded.
- **Error-rate accounting** — whether the request counts as a gateway error.
- **Retry policy** — how the router reacted (see `src/router/retry.ts` and
  `src/router/errors.ts`).

| Outcome | When | Billed? | Counts in error rate? | Retry policy |
|---|---|---|---|---|
| `rejected_pre_flight` | The request never reached a provider: auth failure, 402 payment required, spend ceiling, invalid body, or no candidate satisfies the routing hints (`NoCapableModelError`). | **No** — nothing was served. | No — not a provider failure. | None — nothing was attempted. Caller fixes the request / tops up. |
| `truncated` | The upstream stream ended after tokens were emitted but without a clean `done` (mid-stream cutoff / upstream error post-commit). | **Yes** — tokens that reached the client are billable. | **Yes** — the caller got an incomplete answer. | **Never retried or failed over.** Once any token is emitted the request is committed; re-running on another model would duplicate output. Surfaced as an error event on the stream. |
| `client_abort` | The client disconnected mid-stream after tokens were emitted (the gateway aborts the upstream, stopping token spend). | **Yes** — for tokens that arrived before the disconnect (usage recorded at the trailer). | **No** — not a gateway or provider failure. | **Never retried.** The caller is gone; failover is meaningless. Mid-stream cutoffs never trigger candidate retry. |
| `ok` | The upstream stream completed normally (`done`, usage recorded, `request_completed` emitted). | **Yes** — full usage (input + output tokens × model pricing). | No. | N/A — success. Health tracker records a success for the candidate. |
| `provider_error` | A provider was attempted, nothing was emitted, and the request never completed — the final candidate's error propagated (or all retry/failover budget was exhausted). | **No** — no tokens reached the client. | **Yes** — this is the gateway's error signal. | Pre-commit only: retryable errors (429, 5xx, `ETIMEDOUT`/`ECONNRESET`/`ECONNREFUSED`, deprecation/overloaded) retry the same candidate within `retry.maxRetries` (default 0) with capped full-jitter backoff (250 ms base, 20 s cap, `Retry-After` honored), then fail over to the next candidate. Non-retryable errors (other 4xx — auth, malformed request, context-length) propagate immediately: never retried, never failed over. A failed candidate is put in **cooldown** (default 30 s, half-open probe) by the health tracker. |

## Notes

- **429 → capacity**: a rate-limited candidate is retried once in place
  (within the retry budget, honoring `Retry-After`) and then fails over to the
  next candidate — a capacity signal, not a hard failure.
- **Malformed / context-length errors are terminal**: any non-429 4xx is a
  caller error; the gateway does not mask it with failover.
- **Failover only before first token**: the streaming router commits after the
  first content event; `truncated` and `client_abort` are therefore terminal
  outcomes that never trigger candidate retry.
- Outcome classification priority: `attempted === 0` → `rejected_pre_flight`;
  tokens + client abort → `client_abort`; tokens + no completion → `truncated`;
  completed → `ok`; otherwise `provider_error`.
