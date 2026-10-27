# Tender accounting security update

## Deployment order

The claim-only pause stays active by default even after this change is deployed.
Only a separately approved TENDER_CLAIMS_ENABLED=on activation restores claims.
The claim-only pause stays active until this change is reviewed and activated.
Do not deploy this change before applying the included SQL migration to the
same Supabase project used by the inference service. Applying SQL alone does
not fix the old application. Claims must stay paused during rollout.

Prerequisites to verify without revealing secrets:
- SUPABASE_URL and SUPABASE_SERVICE_KEY are configured.
- Credits and campaigns use the default table names. Custom table overrides
  need an operator-reviewed version of the migration, not a fallback.
- All legacy claim invocations have drained before claims are restored.
- Existing campaigns and credits are reviewed for prior inconsistent accruals.
  This patch prevents new double payments; it cannot prove older credits were
  funded. Do not restore claims solely because the new tests pass.

The migration adds service-role-only accounting tables and SECURITY INVOKER
functions. New tables have RLS with no client policies. Existing application
permissions are not revoked or broadened. No production migration is automatic.
Missing tables or RPCs fail closed. Claims and standalone impressions return
unavailable; routed inference can finish but its reward accrual is refused.
This is an intentional activation dependency, not an inference outage.

## Claim safety and reconciliation

A transaction serializes claims by account, records a claim and debits credits
atomically. Only one open claim per account is allowed. Before broadcast, the
application persists the exact signed transaction signature, cluster, signer public
address, token mint, blockhash and last-valid block height. A
confirmed successful transfer marks that claim paid. Any error leaves the
claim held. The HTTP response says reconciliation is required; it never says
paid merely because broadcasting was attempted.

There is no automatic refund, new transaction, or retry on an unknown chain
outcome. An operator must inspect the recorded signature on its recorded
cluster. A confirmed successful transaction can be marked paid through the
same guarded confirmation function. If a transaction is absent, that alone
is not proof it failed: establish final failure or expiry and check all
relevant RPC evidence before considering a separate approved adjustment.
A reserved claim with no signature means broadcast was not reached by this
application, but a failed preparation write can be ambiguous to the caller;
inspect durable state rather than trusting a client error.

Never delete a pending claim or credit a refund just to make retries work.
Any manual adjustment needs its own audit record and approval. No user can
invoke these RPCs through the public roles.

## Funded impressions

Standalone impressions serialize per account and lock one campaign, enforcing
cadence and funded inventory before crediting. Routed, attested impressions
use the same persistent campaign row budget. Request receipts prevent replay.
Both decrement inventory and append credit in one transaction. They no longer
rely on instance-local campaign counters for the hard financial cap.

Campaign funding provenance (including old house/demo campaigns) is a separate
activation check. The existing product permits active demo campaigns when no
treasury is configured; this patch does not silently remove that feature.

## Tests

Route tests use fictional accounts, fake transaction preparation and no network.
They cover parallel claims, reserve/preparation/finalization failures, unknown
chain outcomes, missing durable storage, and unauthenticated calls. SQL audit
verification runs against PGlite separately and confirms reservation/debit,
held unknown outcomes, budget exhaustion, replay prevention and role denial.
The ordinary suite does not install a new database dependency.

## Still blocked before payout activation

The legacy ledger has no network/mint or verified funding provenance. This
patch does not retroactively make those credits asset-backed. A minimal
read-only activation review should compare aggregate claimable liabilities
with verified campaign funding on the intended mint/network, identify the
payout signer publicly, and verify explicitly allocated payout assets.
Do not extract individual users' balances for this first aggregate check.
House/demo campaigns must not be treated as paid deposits. Any needed
legacy-credit quarantine, conversion, cancellation or refund requires a
separate owner decision; this patch makes none.

The SQL reservation protects an existing credit balance from double spending.
It does NOT independently prove that balance has corresponding on-chain
assets. Keep TENDER_CLAIMS_ENABLED unset until that separate check passes.
