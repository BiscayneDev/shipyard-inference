# Wallet challenge replay fix

Wallet key challenges now carry a five-minute issue timestamp. Old arbitrary
nonces are rejected, so clients must request a fresh discovery challenge and
sign its exact message. Existing browser and mintWalletKey CLI do this already.
Future timestamps and expired signatures never mint keys, even after restart.
Signature verification happens before the atomic replay claim to avoid an
invalid request burning another wallet's challenge.

Hosted app.ts uses the existing Supabase OAuth once table via its atomic unique
insert. No per-instance fallback on database errors. Standalone SDK/CLI gateway
memory defaults remain single-process only; supply a shared NonceRegistry for
multi-instance deployments. Already-issued API keys remain unchanged.

Before deployment verify the current gateway database has shipyard_oauth_once,
unique key k, and appropriate service-only access. Missing or unavailable table
refuses new wallet-key issuance, not inference with existing keys. No migration
or remote DB probe is included here. This dependency must be verified through
the actual deployed database, not a similarly named dashboard project.
