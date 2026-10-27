# Portal local state boundary

The hosted portal remains paused. This storage change does not restore it or
fix its separate user-identity and record-ownership requirements.

When Supabase is configured, the existing Supabase persistence path is unchanged.
Local runs now store runtime state in ~/.local/state/shipyard-chat-portal instead
of the source checkout. SHIPYARD_PORTAL_DATA_DIR can choose another directory,
but it must resolve outside the source tree, including through symlinks.
Directories are owner-only (0700); files are owner-only (0600), replaced atomically.
These files still contain sensitive local credentials. Do not upload or share them.

Old examples/chat-portal/.data files are never imported or migrated automatically.
Existing local portal sessions must reconnect through PayBox after the exposed
client is revoked. Do not copy the old credentials into the new store. Keep any
required incident evidence in a restricted location, not Git, reports or fixtures.
Removing tracked files does not remove historical copies or invalidate tokens.
Revocation of the exposed issuer-side client is still required independently.

## Source credential tripwire

CI runs scripts/check-credentials.mjs automatically through npm pretest. It scans
tracked Git text blobs for runtime-state paths, JWT-like literals, long JSON
OAuth token literals, private-key headers and known service-token prefixes.
Findings contain only path and rule, never values or matched lines. Run
npm run security:staged before committing to inspect the actual staged blobs.
This is a narrow tripwire, not proof that code or history contains no secrets.
It skips binary content and cannot recognize arbitrary secret formats.
Historical exposures still need issuer-side revocation and a separate restricted
history scan. Do not post scanner matches, source dumps or tokens in artifacts.
