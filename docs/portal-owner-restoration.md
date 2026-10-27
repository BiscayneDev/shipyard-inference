# Portal owner-boundary preparation

Hosted /portal remains paused. This branch does not remove the production gate.

Identity reuses existing Shipyard Supabase email-OTP login and server allowlist.
Each private API request validates its bearer with the configured Supabase Auth
issuer, requires a confirmed allowed email and uses the issuer's stable user ID.
Browser modules reuse that login session. No new portal password or API key.
The OAuth callback alone accepts a ten-minute Secure HttpOnly identity cookie,
revalidates it with the same issuer, and checks the existing PKCE/state cookies.
The portal callback no longer returns a session identifier in its URL.

New records carry ownerId. Lists, reads, mutations and session references enforce
that owner. Legacy records with no owner stay inaccessible and are not guessed,
auto-adopted or deleted. Existing local connections must reconnect after the
exposed PayBox client has been revoked. No migration of old token material.

Portal payouts, settlements, deposits/topups, reward clicks, paid inference,
paid decisions, debug transaction capture and portal campaign management stay
unavailable independently. Login is not proof of wallet ownership or permission
to use a shared operator-funded wallet. Client-provided addresses are not adopted
as proven wallet identities. Demo chat and account-owned history can be tested
without reopening financial paths. Campaign management belongs to the separate advertiser
service, not ordinary portal users. A safe payout needs durable accounting and
funding review; authenticating a user does not fix accounting.

Before reopening: inspect full browser OTP/login-to-portal and OAuth return flow,
verify exact production identity configuration, test actual record visibility and
writes with fictional distinct accounts, and review remaining production payment
and inference funding paths. Unit/in-process route tests alone are insufficient.
No live financial test or private-record fetch is needed or authorized here.


Qualification completed locally: actual Chrome rendering/token-injection wrapper
with fictional Supabase SDK session; actual portalApp start/callback lifecycle
with mocked issuer registration/token exchange, matching PKCE verifier hash and
redirect URI, browser HttpOnly cookie return, owner A session recovery and owner B
refusal using the same browser cookie. External server/browser network was blocked.
No real PayBox wallet/token/customer data or financial transaction was used.
Existing hosted email OTP login was independently verified with the allowed owner
account; it has no OAuth callback and cannot stand in for the PayBox issuer.

These tests do not establish actual PayBox issuer compatibility or revoke the
exposed client. Reopening remains blocked until actual issuer revocation and
normal connection succeed after a new external signal clears the known botwall,
plus exact hosted configuration and accounting/funding qualification. Do not
reopen merely to test. No timed botwall retries. Demo screenshot labels may still
say PAYBOX LIVE for fictional callback tokens; that is UI state, not provider proof.

Manual reproducible browser fixture: `python3 scripts/security/portal-callback-browser.py`
requires local Chrome and Python websocket-client. It starts only a localhost
fictional portal process, blocks external browser requests, mocks all server
fetches, asserts browser session ownership/PKCE return, and writes a screenshot
under /downloads/appsec. It is not a production or PayBox connectivity test.
