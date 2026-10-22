import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { MemoryApiKeyStore } from '../src/gateway/keys.js'
import {
  createOAuthApp, sha256b64url, connectionBudgetStatus, validateAuthorizeParams,
  type AuditEvent, type ShipyardSession,
} from '../src/gateway/oauth.js'
import { TEST_CLIENT_SECRET, TEST_CLIENTS } from './oauth-fixtures.js'

const REDIRECT = 'https://dock-harness.vercel.app/api/connect/shipyard/callback'
const LOGIN = 'https://shipyard.example/login'

function setup(opts: { session?: ShipyardSession | undefined; now?: () => number } = {}) {
  let t = 1_000_000
  const now = opts.now ?? (() => t)
  const keyStore = new MemoryApiKeyStore()
  const events: AuditEvent[] = []
  const session = 'session' in opts ? opts.session : { userId: 'acct_1' }
  const app = new Hono()
  app.route('/', createOAuthApp({
    keyStore, loginUrl: LOGIN, csrfSecret: 'test-csrf-secret-value', now, clients: TEST_CLIENTS,
    resolveSession: async () => session, audit: (e) => events.push(e),
  }))
  const advance = (ms: number) => { t += ms }
  return { app, keyStore, events, advance }
}

const verifier = randomBytes(48).toString('base64url') // 64 chars
const challenge = sha256b64url(verifier)
const state = randomBytes(16).toString('hex')

function authorizeQuery(over: Record<string, string> = {}) {
  return new URLSearchParams({
    client_id: 'dock', redirect_uri: REDIRECT, response_type: 'code',
    code_challenge: challenge, code_challenge_method: 'S256', state, workspace: 'ws-main', ...over,
  })
}

async function approve(app: Hono, over: Record<string, string> = {}) {
  const q = authorizeQuery(over)
  const page = await app.request(`/oauth/authorize?${q}`)
  const html = await page.text()
  const csrf = /name="csrf" value="([^"]+)"/.exec(html)?.[1] ?? ''
  const form = new URLSearchParams({ ...Object.fromEntries(q), csrf, decision: 'approve', scope: over.scope ?? 'chat:write route:preview' })
  return app.request('/oauth/authorize', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form, redirect: 'manual' })
}

async function codeFrom(res: Response): Promise<string> {
  const loc = new URL(res.headers.get('location') ?? '')
  const code = loc.searchParams.get('code')
  assert.ok(code, 'expected a code in redirect')
  return code
}

function tokenBody(code: string, over: Record<string, string> = {}) {
  return new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: 'dock', client_secret: TEST_CLIENT_SECRET, redirect_uri: REDIRECT, ...over })
}

const postToken = (app: Hono, body: URLSearchParams) =>
  app.request('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })

test('happy path: code exchanges once for a key that never appears in a redirect', async () => {
  const { app, keyStore, events } = setup()
  const res = await approve(app)
  assert.equal(res.status, 302)
  assert.ok(!res.headers.get('location')!.includes('sk-shipyard-'))
  const code = await codeFrom(res)
  const tok = await postToken(app, tokenBody(code))
  assert.equal(tok.status, 200)
  const body = await tok.json() as Record<string, unknown>
  assert.match(body.access_token as string, /^sk-shipyard-/)
  assert.equal(body.token_type, 'Bearer')
  assert.equal(body.scope, 'chat:write route:preview')
  assert.equal(body.budget_usd, 10)
  assert.ok(body.key_id)
  const acct = await keyStore.resolve(body.access_token as string)
  assert.equal(acct?.userId, 'acct_1')
  assert.ok(!JSON.stringify(events).includes(body.access_token as string), 'no key value in audit')
  assert.ok(events.some((e) => e.event === 'token.issued'))
})

test('PKCE mismatch is refused and consumes the code', async () => {
  const { app } = setup()
  const code = await codeFrom(await approve(app))
  const bad = await postToken(app, tokenBody(code, { code_verifier: randomBytes(48).toString('base64url') }))
  assert.equal(bad.status, 400)
  assert.equal((await bad.json() as { error: string }).error, 'invalid_grant')
  const retry = await postToken(app, tokenBody(code))
  assert.equal((await retry.json() as { error: string }).error, 'invalid_grant', 'code is spent after a failed attempt')
})

test('redirect_uri mismatch refused at authorize (no redirect) and at token', async () => {
  const { app } = setup()
  const off = await app.request(`/oauth/authorize?${authorizeQuery({ redirect_uri: 'https://evil.example/cb' })}`, { redirect: 'manual' })
  assert.equal(off.status, 400)
  const localhostPath = await app.request(`/oauth/authorize?${authorizeQuery({ redirect_uri: REDIRECT + '/x' })}`, { redirect: 'manual' })
  assert.equal(localhostPath.status, 400, 'exact match only, no prefix')

  const code = await codeFrom(await approve(app))
  const tok = await postToken(app, tokenBody(code, { redirect_uri: 'http://localhost:3000/api/connect/shipyard/callback' }))
  assert.equal((await tok.json() as { error: string }).error, 'invalid_grant')
})

test('code replay is refused and revokes the key the first exchange issued', async () => {
  const { app, keyStore, events } = setup()
  const code = await codeFrom(await approve(app))
  const first = await (await postToken(app, tokenBody(code))).json() as { access_token: string }
  assert.ok(await keyStore.resolve(first.access_token), 'key works after first exchange')
  const replay = await postToken(app, tokenBody(code))
  assert.equal(replay.status, 400)
  assert.equal((await replay.json() as { error: string }).error, 'invalid_grant')
  assert.equal(await keyStore.resolve(first.access_token), undefined, 'key revoked by replay')
  assert.ok(events.some((e) => e.event === 'token.replay'))
  assert.ok(events.some((e) => e.event === 'key.revoked' && e.reason === 'code_replay'))
})

test('expired code (over 60s) is refused', async () => {
  const { app, advance } = setup()
  const code = await codeFrom(await approve(app))
  advance(61_000)
  const res = await postToken(app, tokenBody(code))
  assert.equal((await res.json() as { error: string }).error, 'invalid_grant')
})

test('code still valid at 59s', async () => {
  const { app, advance } = setup()
  const code = await codeFrom(await approve(app))
  advance(59_000)
  assert.equal((await postToken(app, tokenBody(code))).status, 200)
})

test('scope escalation refused at authorize', async () => {
  const { app } = setup()
  const q = authorizeQuery({ scope: 'chat:write admin:all' })
  const res = await app.request(`/oauth/authorize?${q}`, { redirect: 'manual' })
  assert.equal(res.status, 302)
  const loc = new URL(res.headers.get('location')!)
  assert.equal(loc.searchParams.get('error'), 'invalid_scope')
  assert.equal(loc.searchParams.get('code'), null)
})

test('owner/admin scopes are not in the Dock client registry', () => {
  const r = validateAuthorizeParams(Object.fromEntries(authorizeQuery({ scope: 'owner:keys' })))
  assert.ok('redirect' in r && r.redirect?.error === 'invalid_scope')
})

test('signed-out authorize redirects to login, not a consent page', async () => {
  const { app } = setup({ session: undefined })
  const res = await app.request(`/oauth/authorize?${authorizeQuery()}`, { redirect: 'manual' })
  assert.equal(res.status, 302)
  assert.ok(res.headers.get('location')!.startsWith(LOGIN))
})

test('consent POST without a valid CSRF token is refused', async () => {
  const { app } = setup()
  const form = new URLSearchParams({ ...Object.fromEntries(authorizeQuery()), csrf: 'forged', decision: 'approve' })
  const res = await app.request('/oauth/authorize', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form, redirect: 'manual' })
  assert.equal(res.status, 403)
})

test('deny redirects with access_denied and issues nothing', async () => {
  const { app, keyStore } = setup()
  const q = authorizeQuery()
  const html = await (await app.request(`/oauth/authorize?${q}`)).text()
  const csrf = /name="csrf" value="([^"]+)"/.exec(html)![1]
  const res = await app.request('/oauth/authorize', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...Object.fromEntries(q), csrf, decision: 'deny', scope: 'chat:write route:preview' }), redirect: 'manual' })
  assert.equal(new URL(res.headers.get('location')!).searchParams.get('error'), 'access_denied')
  assert.equal((await keyStore.listAccounts()).length, 0)
})

test('plain PKCE and missing state are refused', () => {
  const plain = validateAuthorizeParams(Object.fromEntries(authorizeQuery({ code_challenge_method: 'plain' })))
  assert.ok('redirect' in plain && plain.redirect?.error === 'invalid_request')
  const noState = validateAuthorizeParams(Object.fromEntries(authorizeQuery({ state: '' })))
  assert.ok('redirect' in noState && noState.redirect?.error === 'invalid_request')
})

test('budget gate refuses at and above budget with budget_exhausted', () => {
  assert.equal(connectionBudgetStatus(3, 10).ok, true)
  const over = connectionBudgetStatus(10, 10)
  assert.equal(over.ok, false)
  assert.equal(over.body?.code, 'budget_exhausted')
  assert.equal(over.body?.budget_usd, 10)
})

test('revoke kills the key immediately (RFC 7009 style, token is the credential)', async () => {
  const { app, keyStore } = setup()
  const tok = await (await postToken(app, tokenBody(await codeFrom(await approve(app))))).json() as { access_token: string; key_id: string }
  const rev = await app.request('/oauth/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tok.access_token }) })
  assert.equal(rev.status, 200)
  assert.equal(await keyStore.resolve(tok.access_token), undefined)
})

test('token endpoint rate limit returns 429 after the window quota', async () => {
  const keyStore = new MemoryApiKeyStore()
  const app = createOAuthApp({ keyStore, loginUrl: LOGIN, csrfSecret: 'x'.repeat(16), tokenRatePerMinute: 3, clients: TEST_CLIENTS, resolveSession: async () => undefined })
  const statuses: number[] = []
  for (let i = 0; i < 4; i++) statuses.push((await postToken(app as unknown as Hono, tokenBody('nope'))).status)
  assert.deepEqual(statuses, [400, 400, 400, 429])
})
