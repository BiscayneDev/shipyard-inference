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

Portal payouts, debug transaction capture and portal campaign management stay
unavailable independently. Campaign management belongs to the separate advertiser
service, not ordinary portal users. A safe payout needs durable accounting and
funding review; authenticating a user does not fix accounting.

Before reopening: inspect full browser OTP/login-to-portal and OAuth return flow,
verify exact production identity configuration, test actual record visibility and
writes with fictional distinct accounts, and review remaining production payment
and inference funding paths. Unit/in-process route tests alone are insufficient.
No live financial test or private-record fetch is needed or authorized here.
