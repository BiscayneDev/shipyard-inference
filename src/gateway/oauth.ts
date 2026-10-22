import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Hono, type Context } from 'hono'
import type { Account, ApiKeyStore } from './keys.js'
import { verifyHandoff, readConsent, readCookie, consentCookieHeader, signConsent } from './handoff.js'

// OAuth 2.0 authorization code + PKCE (S256) for third-party apps (Dock).
// The user signs in once to their Shipyard account, approves on the consent
// screen, and the app exchanges a single-use code for a workspace-scoped
// gateway key. The key is returned only from the server-to-server token call,
// never in a redirect, and is stored hashed (ApiKeyStore) like every other key.

export interface OAuthClient {
  clientId: string
  /** Exact-match allowlist. No wildcards, no prefix matching. */
  redirectUris: string[]
  /** Hard ceiling. Requested scopes outside this list are refused. */
  scopes: string[]
  /** SHA-256 hex of the client secret. Unset = client cannot exchange codes (fail closed). */
  secretSha256?: string
}

export const OAUTH_CLIENTS: Record<string, OAuthClient> = {
  dock: {
    clientId: 'dock',
    redirectUris: [
      'https://dock-harness.vercel.app/api/connect/shipyard/callback',
      'http://localhost:3000/api/connect/shipyard/callback',
    ],
    scopes: ['chat:write', 'route:preview'],
    secretSha256: process.env.SHIPYARD_DOCK_CLIENT_SECRET_SHA256 || undefined,
  },
}

export const CODE_TTL_MS = 60_000
export const DEFAULT_CONNECTION_BUDGET_USD = 10
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/
const CHALLENGE_RE = /^[A-Za-z0-9\-_]{43}$/
const WORKSPACE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/** A signed-in Shipyard user, resolved from the shared identity session. */
export interface ShipyardSession {
  userId: string
}

export interface AuthCodeRecord {
  codeHash: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  userId: string
  workspace: string
  scopes: string[]
  budgetUsd: number
  expiresAt: number
  consumed: boolean
  /** keyId issued from this code, set on successful exchange. */
  issuedKeyId?: string
  issuedProjectId?: string
}

export interface OAuthStore {
  putCode(rec: AuthCodeRecord): Promise<void>
  getCode(codeHash: string): Promise<AuthCodeRecord | undefined>
  updateCode(codeHash: string, patch: Partial<AuthCodeRecord>): Promise<void>
  /** Atomically mark a code consumed. Returns false if it was already consumed (replay). */
  markCodeConsumed(codeHash: string): Promise<boolean>
  /** Atomically record a one-time key (handoff jti). Returns false if already seen. */
  consumeOnce(key: string, expiresAtMs: number): Promise<boolean>
}

export class MemoryOAuthStore implements OAuthStore {
  private readonly codes = new Map<string, AuthCodeRecord>()
  async putCode(rec: AuthCodeRecord) { this.codes.set(rec.codeHash, { ...rec }) }
  async getCode(h: string) { const r = this.codes.get(h); return r ? { ...r } : undefined }
  async updateCode(h: string, patch: Partial<AuthCodeRecord>) {
    const r = this.codes.get(h)
    if (r) this.codes.set(h, { ...r, ...patch })
  }
  async markCodeConsumed(h: string) {
    const r = this.codes.get(h)
    if (!r || r.consumed) return false
    this.codes.set(h, { ...r, consumed: true })
    return true
  }
  private readonly once = new Map<string, number>()
  async consumeOnce(key: string, expiresAtMs: number) {
    const t = Date.now()
    for (const [k, e] of this.once) if (e <= t) this.once.delete(k)
    if (this.once.has(key)) return false
    this.once.set(key, expiresAtMs)
    return true
  }
}

export interface AuditEvent {
  event: 'authorize.approved' | 'authorize.denied' | 'token.issued' | 'token.refused' | 'token.replay' | 'key.revoked'
  clientId?: string
  userId?: string
  workspace?: string
  keyId?: string
  reason?: string
  at: number
}

export interface OAuthAppOptions {
  keyStore: ApiKeyStore
  store?: OAuthStore
  /** Resolve the signed-in Shipyard user for a request, or undefined. */
  resolveSession: (c: Context) => Promise<ShipyardSession | undefined>
  /** Where to send signed-out users. Required; /oauth/authorize 503s without it. */
  loginUrl?: string
  /** Budget applied to each new connection, from Shipyard policy. */
  budgetUsd?: number
  /** Serverless-safe audit sink. Receives events; never key values. */
  audit?: (e: AuditEvent) => void
  /** Per-client token endpoint limit (requests per minute). Default 30. */
  tokenRatePerMinute?: number
  /** Secret for the consent CSRF token and consent cookie. Required. */
  csrfSecret: string
  /** Override the client registry (tests). Defaults to OAUTH_CLIENTS. */
  clients?: Record<string, OAuthClient>
  /** HMAC secret shared with the Shipyard web app for handoff tokens (>= 32 chars). Unset = /oauth/handoff refuses. */
  handoffSecret?: string
  /** Expected `iss` of handoff tokens: the Shipyard web app origin. */
  handoffIssuer?: string
  now?: () => number
}

export const sha256b64url = (s: string) => createHash('sha256').update(s).digest('base64url')
export const sha256hex = (s: string) => createHash('sha256').update(s).digest('hex')

/** S256 PKCE check. Constant-time compare. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!VERIFIER_RE.test(verifier) || !CHALLENGE_RE.test(challenge)) return false
  const a = Buffer.from(sha256b64url(verifier))
  const b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Deterministic project id for one (Shipyard account, workspace) connection. */
export function connectionProjectId(userId: string, workspace: string, clientId: string): string {
  return `${clientId}_${sha256hex(`${userId}\u0000${workspace}`).slice(0, 24)}`
}

/** Pure budget gate used on every connection call: spent >= budget means refuse. */
export function connectionBudgetStatus(spentUsd: number, budgetUsd: number): { ok: boolean; body?: Record<string, unknown> } {
  if (spentUsd < budgetUsd) return { ok: true }
  return {
    ok: false,
    body: {
      error: 'budget_exhausted',
      code: 'budget_exhausted',
      message: 'This connection has used its Shipyard budget. Raise the budget in Shipyard to continue.',
      budget_usd: budgetUsd,
    },
  }
}

function oauthError(c: Context, status: number, error: string, description?: string) {
  c.header('Cache-Control', 'no-store')
  return c.json({ error, ...(description ? { error_description: description } : {}) }, status as 400)
}

function redirectWithParams(redirectUri: string, params: Record<string, string>): string {
  const u = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return u.toString()
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
}

/** Form or JSON body as a flat string record. */
async function readBody(c: Context): Promise<Record<string, string>> {
  const ct = c.req.header('content-type') ?? ''
  if (ct.includes('application/json')) {
    const j = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, typeof v === 'string' ? v : '']))
  }
  const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>))
  return Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v : '']))
}

/** Parse + validate the authorize request. Returns an error only if the redirect target is trustworthy. */
export type AuthorizeCheck =
  | { fatal: string }
  | { redirect: { redirectUri: string; error: string; description: string } }
  | { ok: true; client: OAuthClient; redirectUri: string; scopes: string[]; codeChallenge: string; state: string; workspace: string }

export function validateAuthorizeParams(q: Record<string, string | undefined>, clients = OAUTH_CLIENTS): AuthorizeCheck {
  const client = q.client_id ? clients[q.client_id] : undefined
  if (!client) return { fatal: 'unknown client_id' }
  if (!q.redirect_uri || !client.redirectUris.includes(q.redirect_uri)) return { fatal: 'redirect_uri not registered' }
  const redirectUri = q.redirect_uri
  const bad = (error: string, description: string): AuthorizeCheck => ({ redirect: { redirectUri, error, description } })
  if (q.response_type !== 'code') return bad('unsupported_response_type', 'response_type must be code')
  if (q.code_challenge_method !== 'S256') return bad('invalid_request', 'PKCE S256 is required')
  if (!q.code_challenge || !CHALLENGE_RE.test(q.code_challenge)) return bad('invalid_request', 'code_challenge is malformed')
  if (!q.state || q.state.length < 16 || q.state.length > 256) return bad('invalid_request', 'state (16-256 chars) is required')
  if (!q.workspace || !WORKSPACE_RE.test(q.workspace)) return bad('invalid_request', 'workspace is required')
  const requested = q.scope ? q.scope.split(' ').filter(Boolean) : client.scopes
  if (requested.some((s) => !client.scopes.includes(s))) return bad('invalid_scope', 'requested scope is not allowed for this client')
  return { ok: true, client, redirectUri, scopes: [...new Set(requested)], codeChallenge: q.code_challenge, state: q.state, workspace: q.workspace }
}

function safeEqHex(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Session resolver for the consent cookie set by /oauth/handoff. Fail closed. */
export function consentSessionResolver(csrfSecret: string, now: () => number = Date.now) {
  return async (c: Context): Promise<ShipyardSession | undefined> => {
    const userId = readConsent(readCookie(c.req.header('cookie'), 'shipyard_consent'), csrfSecret, now())
    return userId ? { userId } : undefined
  }
}

export function createOAuthApp(opts: OAuthAppOptions): Hono {
  const app = new Hono()
  const store = opts.store ?? new MemoryOAuthStore()
  const now = opts.now ?? Date.now
  const audit = (e: Omit<AuditEvent, 'at'>) => opts.audit?.({ ...e, at: now() })
  const budgetUsd = opts.budgetUsd ?? DEFAULT_CONNECTION_BUDGET_USD
  const clients = opts.clients ?? OAUTH_CLIENTS
  const csrf = (userId: string, p: { clientId: string; state: string; codeChallenge: string; workspace: string; redirectUri: string; scope: string }) =>
    createHash('sha256').update([opts.csrfSecret, userId, p.clientId, p.state, p.codeChallenge, p.workspace, p.redirectUri, p.scope].join('\u0000')).digest('base64url')

  // Token endpoint rate limit: fixed window per client_id.
  const hits = new Map<string, { n: number; start: number }>()
  const limited = (key: string): boolean => {
    const limit = opts.tokenRatePerMinute ?? 30
    const t = now()
    const h = hits.get(key)
    if (!h || t - h.start >= 60_000) { hits.set(key, { n: 1, start: t }); return false }
    h.n += 1
    return h.n > limit
  }

  // Token handoff from the Shipyard web app. Verifies the signed token, consumes its jti once,
  // and sets the short consent-session cookie. Only same-origin /oauth/authorize targets are allowed.
  app.get('/oauth/handoff', async (c) => {
    c.header('Cache-Control', 'no-store')
    const token = c.req.query('token') ?? ''
    const ret = c.req.query('return') ?? ''
    const me = new URL(c.req.url)
    let target: URL
    try { target = new URL(ret) } catch { return c.text('Handoff refused: bad return', 400) }
    if (target.origin !== me.origin || target.pathname !== '/oauth/authorize') return c.text('Handoff refused: bad return', 400)
    if (!opts.handoffSecret || !opts.handoffIssuer) return c.text('Shipyard sign-in is not configured', 503)
    const nowMs = now()
    const v = verifyHandoff(token, { secret: opts.handoffSecret, expectedIss: opts.handoffIssuer, nowMs })
    if (!v.ok) {
      audit({ event: 'authorize.denied', reason: `handoff_${v.reason}` })
      return c.text('Sign-in handoff failed. Start the connection again from Dock.', 401)
    }
    const fresh = await store.consumeOnce(`jti:${v.payload.jti}`, v.payload.exp * 1000)
    if (!fresh) {
      audit({ event: 'authorize.denied', userId: v.payload.sub, reason: 'handoff_replay' })
      return c.text('Sign-in handoff already used. Start the connection again from Dock.', 401)
    }
    c.header('Set-Cookie', consentCookieHeader(signConsent(v.payload.sub, opts.csrfSecret, nowMs)))
    return c.redirect(target.toString())
  })

  app.get('/oauth/authorize', async (c) => {
    const q = Object.fromEntries(Object.entries(c.req.query()).map(([k, v]) => [k, String(v)]))
    const v = validateAuthorizeParams(q, clients)
    if ('fatal' in v) return c.text(`Authorization request refused: ${v.fatal}`, 400)
    if ('redirect' in v) {
      // redirect_uri is valid; errors go back to the client.
      return c.redirect(redirectWithParams(v.redirect.redirectUri, { error: v.redirect.error, error_description: v.redirect.description, state: q.state ?? '' }))
    }
    if (!opts.loginUrl) return c.text('Shipyard sign-in is not configured', 503)
    const session = await opts.resolveSession(c)
    if (!session) {
      // The login URL is the web app's handoff route; it returns here after minting a token.
      const back = new URL(c.req.url)
      const login = new URL(opts.loginUrl)
      login.searchParams.set('return', back.toString())
      c.header('Cache-Control', 'no-store')
      return c.redirect(login.toString())
    }
    const token = csrf(session.userId, { clientId: v.client.clientId, state: v.state, codeChallenge: v.codeChallenge, workspace: v.workspace, redirectUri: v.redirectUri, scope: v.scopes.join(' ') })
    c.header('Cache-Control', 'no-store')
    c.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'")
    return c.html(`<!doctype html><html><head><meta charset="utf-8"><title>Connect to Shipyard</title><style>body{font:16px system-ui;background:#0a0a0f;color:#e6e6ef;max-width:560px;margin:64px auto;padding:24px}.card{background:#111118;border:1px solid #2a2a38;border-radius:12px;padding:24px}button{font:inherit;padding:10px 16px;border-radius:8px;border:0;cursor:pointer;margin-right:8px}.ok{background:#3b82f6;color:#fff}.no{background:#2a2a38;color:#e6e6ef}ul{padding-left:20px}</style></head><body><div class="card"><h1>Connect ${esc(v.client.clientId === 'dock' ? 'Dock' : v.client.clientId)} to Shipyard</h1><p>Dock will be able to:</p><ul>${v.scopes.map((s) => `<li><code>${esc(s)}</code></li>`).join('')}</ul><p>Spend budget for this connection: <strong>$${budgetUsd.toFixed(2)}</strong>. All usage is metered on your Shipyard ledger and stops when the budget is used.</p><p>Workspace: <code>${esc(v.workspace)}</code></p><form method="post" action="/oauth/authorize"><input type="hidden" name="client_id" value="${esc(v.client.clientId)}"><input type="hidden" name="redirect_uri" value="${esc(v.redirectUri)}"><input type="hidden" name="state" value="${esc(v.state)}"><input type="hidden" name="code_challenge" value="${esc(v.codeChallenge)}"><input type="hidden" name="workspace" value="${esc(v.workspace)}"><input type="hidden" name="scope" value="${esc(v.scopes.join(' '))}"><input type="hidden" name="csrf" value="${token}"><button class="ok" name="decision" value="approve">Approve</button><button class="no" name="decision" value="deny">Deny</button></form></div></body></html>`)
  })

  app.post('/oauth/authorize', async (c) => {
    const b = await readBody(c)
    const v = validateAuthorizeParams(b, clients)
    if ('fatal' in v) return c.text(`Authorization request refused: ${v.fatal}`, 400)
    if ('redirect' in v) return c.redirect(redirectWithParams(v.redirect.redirectUri, { error: v.redirect.error, state: b.state ?? '' }))
    const session = await opts.resolveSession(c)
    if (!session) return c.text('Sign in to Shipyard first', 401)
    const expected = csrf(session.userId, { clientId: v.client.clientId, state: v.state, codeChallenge: v.codeChallenge, workspace: v.workspace, redirectUri: v.redirectUri, scope: v.scopes.join(' ') })
    if (!b.csrf || b.csrf.length !== expected.length || !timingSafeEqual(Buffer.from(b.csrf), Buffer.from(expected))) {
      return c.text('Consent form expired. Start the connection again from Dock.', 403)
    }
    c.header('Cache-Control', 'no-store')
    if (b.decision !== 'approve') {
      audit({ event: 'authorize.denied', clientId: v.client.clientId, userId: session.userId, workspace: v.workspace })
      return c.redirect(redirectWithParams(v.redirectUri, { error: 'access_denied', state: v.state }))
    }
    const code = randomBytes(32).toString('base64url')
    await store.putCode({
      codeHash: sha256hex(code), clientId: v.client.clientId, redirectUri: v.redirectUri, codeChallenge: v.codeChallenge,
      userId: session.userId, workspace: v.workspace, scopes: v.scopes, budgetUsd, expiresAt: now() + CODE_TTL_MS, consumed: false,
    })
    audit({ event: 'authorize.approved', clientId: v.client.clientId, userId: session.userId, workspace: v.workspace })
    return c.redirect(redirectWithParams(v.redirectUri, { code, state: v.state }))
  })

  app.post('/oauth/token', async (c) => {
    const b = await readBody(c)
    c.header('Cache-Control', 'no-store')
    if (b.grant_type !== 'authorization_code') return oauthError(c, 400, 'unsupported_grant_type')
    const clientId = b.client_id ?? ''
    if (limited(`token:${clientId || 'anon'}`)) return oauthError(c, 429, 'rate_limited', 'Too many token requests')
    const client = clients[clientId]
    if (!client) return oauthError(c, 401, 'invalid_client')
    // Client authentication: hashed secret, constant-time compare. Checked before the code is touched.
    if (!client.secretSha256 || !b.client_secret || !safeEqHex(sha256hex(b.client_secret), client.secretSha256)) {
      audit({ event: 'token.refused', clientId, reason: 'client_auth' })
      return oauthError(c, 401, 'invalid_client')
    }
    if (!b.code || !b.code_verifier || !b.redirect_uri) return oauthError(c, 400, 'invalid_request')
    const rec = await store.getCode(sha256hex(b.code))
    if (!rec) {
      audit({ event: 'token.refused', clientId, reason: 'unknown_code' })
      return oauthError(c, 400, 'invalid_grant')
    }
    if (rec.consumed) {
      // Replay: the code was already exchanged. Kill the key it produced.
      audit({ event: 'token.replay', clientId, userId: rec.userId, workspace: rec.workspace, keyId: rec.issuedKeyId, reason: 'code_replay' })
      if (rec.issuedKeyId && rec.issuedProjectId && opts.keyStore.revokeInProject) {
        await opts.keyStore.revokeInProject(rec.issuedProjectId, rec.issuedKeyId, now())
        audit({ event: 'key.revoked', clientId, userId: rec.userId, keyId: rec.issuedKeyId, reason: 'code_replay' })
      }
      return oauthError(c, 400, 'invalid_grant')
    }
    // Any attempt with the live code consumes it, whether or not it succeeds.
    // Atomic: two concurrent exchanges cannot both win.
    if (!(await store.markCodeConsumed(rec.codeHash))) {
      audit({ event: 'token.replay', clientId, userId: rec.userId, workspace: rec.workspace, keyId: rec.issuedKeyId, reason: 'code_replay' })
      return oauthError(c, 400, 'invalid_grant')
    }
    const refuse = (reason: string) => {
      audit({ event: 'token.refused', clientId, userId: rec.userId, workspace: rec.workspace, reason })
      return oauthError(c, 400, 'invalid_grant')
    }
    if (now() > rec.expiresAt) return refuse('code_expired')
    if (clientId !== rec.clientId) return refuse('client_mismatch')
    if (b.redirect_uri !== rec.redirectUri) return refuse('redirect_uri_mismatch')
    if (!verifyPkce(b.code_verifier, rec.codeChallenge)) return refuse('pkce_mismatch')

    const projectId = connectionProjectId(rec.userId, rec.workspace, clientId)
    const issued = await opts.keyStore.issue({
      projectId,
      userId: rec.userId,
      scopes: rec.scopes,
      label: `${clientId}:${rec.workspace}`.slice(0, 64),
    }, now())
    await store.updateCode(rec.codeHash, { issuedKeyId: issued.account.keyId, issuedProjectId: projectId })
    audit({ event: 'token.issued', clientId, userId: rec.userId, workspace: rec.workspace, keyId: issued.account.keyId })
    return c.json({
      access_token: issued.key,
      token_type: 'Bearer',
      scope: rec.scopes.join(' '),
      expires_at: null,
      budget_usd: rec.budgetUsd,
      key_id: issued.account.keyId,
    })
  })

  // RFC 7009-style revoke. The bearer token is the credential; no client secret is needed.
  app.post('/oauth/revoke', async (c) => {
    const b = await readBody(c)
    c.header('Cache-Control', 'no-store')
    if (!b.token) return oauthError(c, 400, 'invalid_request')
    const account = await opts.keyStore.resolve(b.token)
    if (account?.keyId && account.projectId && opts.keyStore.revokeInProject) {
      await opts.keyStore.revokeInProject(account.projectId, account.keyId, now())
      audit({ event: 'key.revoked', clientId: account.label?.split(':')[0], userId: account.userId, keyId: account.keyId, reason: 'client_revoke' })
    }
    return c.body(null, 200)
  })

  // User-facing list and revoke, scoped to the signed-in user.
  app.get('/oauth/connections', async (c) => {
    const session = await opts.resolveSession(c)
    if (!session) return c.json({ error: 'unauthenticated' }, 401)
    c.header('Cache-Control', 'no-store')
    const accounts: Account[] = await opts.keyStore.listAccounts()
    const mine = accounts
      .filter((a) => a.userId === session.userId && !!a.label?.startsWith('dock:'))
      .map((a) => ({ key_id: a.keyId, label: a.label, scopes: a.scopes ?? [], status: a.status, created_at: a.createdAt, revoked_at: a.revokedAt ?? null }))
    return c.json({ connections: mine })
  })

  app.post('/oauth/connections/:keyId/revoke', async (c) => {
    const session = await opts.resolveSession(c)
    if (!session) return c.json({ error: 'unauthenticated' }, 401)
    c.header('Cache-Control', 'no-store')
    const keyId = c.req.param('keyId')
    const target = (await opts.keyStore.listAccounts()).find((a) => a.keyId === keyId && a.userId === session.userId)
    if (!target?.projectId || !opts.keyStore.revokeInProject) return c.json({ error: 'not_found' }, 404)
    const ok = await opts.keyStore.revokeInProject(target.projectId, keyId, now())
    if (ok) audit({ event: 'key.revoked', userId: session.userId, keyId, reason: 'user_revoke' })
    return c.json({ revoked: ok })
  })

  return app
}

/**
 * Durable OAuth state for serverless (codes, handoff jtis). Tables in the gateway's
 * Supabase project: shipyard_oauth_codes and shipyard_oauth_once (see scripts/shipyard-gateway-tables.sql).
 */
export class SupabaseOAuthStore implements OAuthStore {
  private readonly base: string
  private readonly headers: Record<string, string>
  constructor(opts: { url: string; key: string; fetch?: typeof fetch }) {
    this.base = opts.url.replace(/\/+$/, '') + '/rest/v1'
    this.f = opts.fetch ?? fetch
    this.headers = { apikey: opts.key, authorization: `Bearer ${opts.key}`, 'content-type': 'application/json' }
  }
  private readonly f: typeof fetch
  private async call(path: string, init: RequestInit & { prefer?: string } = {}): Promise<unknown[]> {
    const { prefer, ...rest } = init
    const res = await this.f(`${this.base}/${path}`, { ...rest, headers: { ...this.headers, ...(prefer ? { Prefer: prefer } : {}) } })
    if (!res.ok) throw new Error(`oauth store ${res.status}`)
    const text = await res.text()
    return text ? (JSON.parse(text) as unknown[]) : []
  }
  async putCode(rec: AuthCodeRecord) {
    await this.call('shipyard_oauth_codes', { method: 'POST', body: JSON.stringify({ code_hash: rec.codeHash, consumed: rec.consumed, expires_at: rec.expiresAt, rec }), prefer: 'return=minimal' })
  }
  async getCode(h: string) {
    const rows = (await this.call(`shipyard_oauth_codes?select=rec,consumed&code_hash=eq.${encodeURIComponent(h)}&limit=1`)) as Array<{ rec: AuthCodeRecord; consumed: boolean }>
    const r = rows[0]
    return r ? { ...r.rec, consumed: r.consumed } : undefined
  }
  async updateCode(h: string, patch: Partial<AuthCodeRecord>) {
    const cur = await this.getCode(h)
    if (!cur) return
    const next = { ...cur, ...patch }
    await this.call(`shipyard_oauth_codes?code_hash=eq.${encodeURIComponent(h)}`, { method: 'PATCH', body: JSON.stringify({ rec: next, consumed: next.consumed }), prefer: 'return=minimal' })
  }
  async markCodeConsumed(h: string) {
    const rows = await this.call(`shipyard_oauth_codes?code_hash=eq.${encodeURIComponent(h)}&consumed=is.false`, { method: 'PATCH', body: JSON.stringify({ consumed: true }), prefer: 'return=representation' })
    return rows.length > 0
  }
  async consumeOnce(key: string, expiresAtMs: number) {
    const rows = await this.call('shipyard_oauth_once', { method: 'POST', body: JSON.stringify({ k: key, expires_at: expiresAtMs }), prefer: 'resolution=ignore-duplicates,return=representation' })
    return rows.length > 0
  }
}
