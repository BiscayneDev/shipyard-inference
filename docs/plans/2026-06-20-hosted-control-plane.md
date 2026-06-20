# Shipyard Inference Hosted Control Plane Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn Shipyard Inference from a self-hosted gateway + example site into a billable hosted control plane for production AI teams.

**Architecture:** Keep the data plane lightweight and self-hostable. Add a hosted control plane that owns tenants, API keys, usage persistence, baseline measurement, savings reporting, SLA reporting, and billing surfaces. The hosted layer should not sit in the hot path unless necessary; it should consume telemetry from the gateway/router and turn it into customer-facing control, reporting, and invoices.

**Tech Stack:** TypeScript, Hono, Next.js app router, JSONL/SQLite or durable DB for control-plane persistence, existing Shipyard gateway/router telemetry, existing operator UI assets.

---

## Task 1: Define the tenant and billing model

**Objective:** Introduce the minimum data model for customers, projects, API keys, plans, usage records, and savings reports.

**Files:**
- Modify: `src/operator/types.ts`
- Modify: `src/operator/store.ts`
- Modify: `src/operator/hub.ts`
- Test: `test/operator/*.test.ts` (create if needed)

**Steps:**
1. Add explicit types for `Tenant`, `Project`, `ApiKey`, `UsageRecord`, `SavingsSnapshot`, `BillingPlan`, and `SlaSummary`.
2. Add persistence helpers in the operator store for append-only writes plus query-by-tenant/project.
3. Make sure the in-memory and JSONL paths both preserve tenant/project identity.
4. Add tests that prove records round-trip and basic aggregates work.

**Verification:**
- Run: `npm test -- test/operator/*`
- Expected: tests pass and records are queryable by tenant and project.

---

## Task 2: Add real tenant auth and API key issuance

**Objective:** Replace static bearer-key auth with tenant-scoped API keys and revocation.

**Files:**
- Modify: `src/gateway/auth.ts`
- Modify: `src/gateway/config.ts`
- Modify: `src/operator/server.ts`
- Modify: `src/operator/hub.ts`
- Test: `test/gateway/auth.test.ts`

**Steps:**
1. Add a tenant-aware API key model with status, label, scopes, and revocation timestamp.
2. Add issuance and revoke endpoints in the operator server.
3. Update gateway auth to resolve a key to tenant/project identity instead of only matching a static string.
4. Preserve a simple bootstrap mode for local dev.
5. Add tests for valid, revoked, missing, and expired keys.

**Verification:**
- Run: `npm test -- test/gateway/auth.test.ts test/operator/*`
- Expected: auth resolves tenant identity and revoked keys fail.

---

## Task 3: Persist usage and settlement telemetry into a customer ledger

**Objective:** Turn router/gateway telemetry into durable customer-facing usage and settlement records.

**Files:**
- Modify: `src/router/router.ts`
- Modify: `src/gateway/server.ts`
- Modify: `src/operator/reporter.ts`
- Modify: `src/operator/store.ts`
- Modify: `src/operator/hub.ts`
- Test: `test/router.usage.test.ts`, `test/operator/reporter.test.ts` (create if needed)

**Steps:**
1. Ensure every completed request includes tenant/project identity in the emitted event.
2. Persist usage records with request class, model, provider, actual cost, baseline cost, and saved amount.
3. Persist settlement records separately so cash collection and metered usage are both visible.
4. Add query methods for billable period rollups.
5. Add tests for ingestion and aggregation.

**Verification:**
- Run: `npm test -- test/router.usage.test.ts test/operator/*`
- Expected: usage and settlement both show up in the ledger with correct tenant attribution.

---

## Task 4: Implement the savings baseline and signed report flow

**Objective:** Make savings-share measurable and defensible using the customer’s configured default path as baseline.

**Files:**
- Modify: `src/router/router.ts`
- Modify: `src/operator/hub.ts`
- Modify: `src/operator/aggregate.ts`
- Modify: `src/operator/server.ts`
- Test: `test/savings.test.ts`

**Steps:**
1. Define baseline rules explicitly: customer default model path, same request class, same time window.
2. Add shadow-mode calculation so Shipyard can compare its route against the baseline without changing the customer’s live traffic.
3. Split savings into routing, caching, and compression contributions.
4. Generate a signed savings report for a selected time window.
5. Add guardrails so the baseline can be frozen and audited.

**Verification:**
- Run: `npm test -- test/savings.test.ts`
- Expected: baseline math is stable, repeatable, and attributable.

---

## Task 5: Build the hosted control plane APIs

**Objective:** Expose customer-facing hosted endpoints for onboarding, configuration, usage, billing, and reports.

**Files:**
- Modify: `src/operator/server.ts`
- Modify: `src/operator/hub.ts`
- Modify: `src/operator/public/app.js`
- Modify: `src/operator/public/index.html`
- Test: `test/operator/server.test.ts` (create if needed)

**Steps:**
1. Add endpoints for tenant creation, project creation, API key issuance, usage queries, savings reports, and SLA summaries.
2. Make the operator UI show the hosted control plane story instead of only internal telemetry.
3. Add a billing summary panel with period usage, savings, and estimated invoice amount.
4. Keep the UI simple and focused on production readiness.

**Verification:**
- Run: `npm test -- test/operator/server.test.ts`
- Expected: endpoints return tenant-scoped payloads and the UI renders the control-plane views.

---

## Task 6: Add SLA and reliability reporting

**Objective:** Support the reliability tier with honest uptime, failover, and incident reporting.

**Files:**
- Modify: `src/router/router.ts`
- Modify: `src/operator/aggregate.ts`
- Modify: `src/operator/hub.ts`
- Modify: `src/operator/types.ts`
- Test: `test/router.failover.test.ts`, `test/router.stream.failover.test.ts`

**Steps:**
1. Track failovers, retries, error rates, and provider availability per tenant/project.
2. Summarize uptime-like availability and response quality for billing periods.
3. Add a report view that can support credits or SLA commitments.
4. Keep the math transparent and auditable.

**Verification:**
- Run: `npm test -- test/router.failover.test.ts test/router.stream.failover.test.ts`
- Expected: reliability metrics are emitted and aggregated correctly.

---

## Task 7: Make the onboarding experience sellable

**Objective:** Convert the control plane into something a buyer can actually try and understand.

**Files:**
- Modify: `examples/chat-portal/README.md`
- Modify: `examples/hermes-agent/README.md`
- Modify: `README.md`
- Modify: `src/operator/public/index.html`

**Steps:**
1. Rewrite onboarding copy around “LLM spend control” and “verified savings.”
2. Add one clear CTA: run one workload, prove savings, then move to managed.
3. Make the docs explain how self-host and hosted modes fit together.
4. Add a short rollout guide for design partners.

**Verification:**
- Run: `npm run build`
- Expected: docs and UI tell one coherent story.

---

## Final gate

**Objective:** Prove the whole product works together before any public launch.

**Files:**
- All files touched above

**Steps:**
1. Run the full test suite.
2. Build the package.
3. Smoke-test the gateway and operator locally.
4. Confirm the hosted control plane can ingest telemetry and render a savings report.
5. Commit and push once the flow is green.

**Verification:**
- Run: `npm test`
- Run: `npm run build`
- Expected: green build, green tests, and a clear hosted-control-plane story end to end.

---

## Suggested implementation order
1. Tenant and billing model
2. API key issuance and auth
3. Telemetry ledger persistence
4. Savings baseline/reporting
5. Hosted control plane APIs and UI
6. SLA reporting
7. Onboarding/docs polish

## Exit criteria
- Customers can be created as tenants
- Requests are attributed to a tenant/project
- Savings can be measured against a defensible baseline
- The operator UI can show usage, savings, and reliability
- The product is ready for a paid hosted pilot
