import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, createHmac } from 'node:crypto'
import { Hono } from 'hono'
import { MemoryApiKeyStore } from '../src/gateway/keys.js'
import { MemoryOAuthStore, createOAuthApp, consentSessionResolver, sha256b64url } from '../src/gateway/oauth.js'
import { signHandoff, verifyHandoff, signConsent, readConsent, HANDOFF_TTL_S } from '../src/gateway/handoff.js'
import { TEST_CLIENTS, TEST_CLIENT_SECRET } from './oauth-fixtures.js'

const SECRET = 'handoff-secret-for-tests-0123456789abcdef'
const CSRF = 'csrf-secret-for-tests-0123456789abcd'
const ISS = 'https://shipyard.example'
const GW = 'https://gw.example'
const REDIRECT = 'https://dock-harness.vercel.app/api/connect/shipyard/callback'
const NOW = 1_800_000_000_000

const base = { sub: 'acct_owner', iss: ISS, secret: SECRET, nowMs: NOW }

test('handoff: valid token verifies', () => {
  const t = signHandoff({ ...base, jti: 'j1' })
  const v = verifyHandoff(t, { secret: SECRET, expectedIss: ISS, nowMs: NOW + 1000 })
  assert.equal(v.ok, true)
  if (v.ok) assert.equal(v.payload.sub, 'acct_owner')
})

test('handoff: expiry at 120s is refused', () => {
  const t = signHandoff({ ...base, jti: 'j2' })
  assert.equal(verifyHandoff(t, { secret: SECRET, expectedIss: ISS, nowMs: NOW + (HANDOFF_TTL_S - 1) * 1000 }).ok, true)
  const late = verifyHandoff(t, { secret: SECRET, expectedIss: ISS, nowMs: NOW + HANDOFF_TTL_S * 1000 })
  assert.deepEqual(late, { ok: false, reason: 'expired' })
})

test('handoff: wrong iss refused', () => {
  const t = signHandoff({ ...base, jti: 'j3' })
  assert.deepEqual(verifyHandoff(t, { secret: SECRET, expectedIss: 'https://evil.example', nowMs: NOW }), { ok: false, reason: 'wrong_iss' })
})

test('handoff: wrong aud refused (token minted for another audience)', () => {
  // Forge a correctly-signed token with a different aud to isolate the aud check.
  const body = Buffer.from(JSON.stringify({ sub: 'a', aud: 'other', iss: ISS, iat: 1, exp: 9e9, jti: 'x' })).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url')
  assert.deepEqual(verifyHandoff(`${body}.${sig}`, { secret: SECRET, expectedIss: ISS, nowMs: NOW }), { ok: false, reason: 'wrong_aud' })
})

test('handoff: tampered payload or wrong secret refused', () => {
  const t = signHandoff({ ...base, jti: 'j4' })
  const [body, sig] = t.split('.') as [string, string]
  const evil = Buffer.from(JSON.stringify({ sub: 'acct_other', aud: 'shipyard-inference-oauth', iss: ISS, iat: 1, exp: 9e9, jti: 'j4' })).toString('base64url')
  assert.equal(verifyHandoff(`${evil}.${sig}`, { secret: SECRET, expectedIss: ISS, nowMs: NOW }).ok, false)
  assert.equal(verifyHandoff(`${body}.${sig}`, { secret: 'a-different-secret-that-is-long-enough', expectedIss: ISS, nowMs: NOW }).ok, false)
})

test('consent cookie: valid within 10 min, refused after, refused when tampered', () => {
  const c = signConsent('acct_owner', CSRF, NOW)
  assert.equal(readConsent(c, CSRF, NOW + 60_000), 'acct_owner')
  assert.equal(readConsent(c, CSRF, NOW + 601_000), undefined)
  const forgedUser = `${Buffer.from('acct_other').toString('base64url')}${c.slice(c.indexOf('.'))}`
  assert.equal(readConsent(forgedUser, CSRF, NOW), undefined)
  assert.equal(readConsent(c, 'other-csrf-secret-value-0123456789', NOW), undefined)
})

function app(o: { store?: MemoryOAuthStore; now?: () => number } = {}) {
  const keyStore = new MemoryApiKeyStore()
  const store = o.store ?? new MemoryOAuthStore()
  const now = o.now ?? (() => NOW)
  const a = new Hono()
  a.route('/', createOAuthApp({
    keyStore, store, loginUrl: `${ISS}/api/oauth/handoff`, csrfSecret: CSRF, clients: TEST_CLIENTS, now,
    handoffSecret: SECRET, handoffIssuer: ISS,
    resolveSession: consentSessionResolver(CSRF, now),
  }))
  return { a, keyStore, store }
}

const verifier = randomBytes(48).toString('base64url')
const challenge = sha256b64url(verifier)
const state = randomBytes(16).toString('hex')
const authQ = (extra = '') => `/oauth/authorize?client_id=dock&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&state=${state}&workspace=ws-main&scope=chat:write%20route:preview${extra}`
const returnUrl = `${GW}${authQ()}`
const handoffUrl = (token: string, ret = returnUrl) => `${GW}/oauth/handoff?token=${encodeURIComponent(token)}&return=${encodeURIComponent(ret)}`

test('signed-out: /oauth/authorize redirects to the web app handoff route, not 404', async () => {
  const { a } = app()
  const res = await a.request(`${GW}${authQ()}`, { redirect: 'manual' })
  assert.equal(res.status, 302)
  const loc = new URL(res.headers.get('location')!)
  assert.equal(loc.origin + loc.pathname, `${ISS}/api/oauth/handoff`)
  assert.ok(loc.searchParams.get('return')?.startsWith(`${GW}/oauth/authorize`))
})

test('approve without consent cookie is refused (401)', async () => {
  const { a } = app()
  const form = new URLSearchParams({ client_id: 'dock', redirect_uri: REDIRECT, response_type: 'code', code_challenge_method: 'S256', state, code_challenge: challenge, workspace: 'ws-main', scope: 'chat:write route:preview', csrf: 'x', decision: 'approve' })
  const res = await a.request('/oauth/authorize', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form, redirect: 'manual' })
  assert.equal(res.status, 401)
})

test('handoff: valid token sets consent cookie and redirects to authorize; cookie then shows the consent page', async () => {
  const { a } = app()
  const t = signHandoff({ ...base, jti: 'hand-1' })
  const res = await a.request(handoffUrl(t), { redirect: 'manual' })
  assert.equal(res.status, 302)
  assert.equal(res.headers.get('location'), returnUrl)
  const cookie = res.headers.get('set-cookie') ?? ''
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Max-Age=600/)
  const pair = cookie.split(';')[0]!
  const page = await a.request(authQ(), { headers: { cookie: pair }, redirect: 'manual' })
  assert.equal(page.status, 200)
  assert.match(await page.text(), /Connect Dock to Shipyard/)
})

test('handoff: replayed jti is refused', async () => {
  const { a } = app()
  const t = signHandoff({ ...base, jti: 'hand-replay' })
  assert.equal((await a.request(handoffUrl(t), { redirect: 'manual' })).status, 302)
  const again = await a.request(handoffUrl(t), { redirect: 'manual' })
  assert.equal(again.status, 401)
  assert.equal(again.headers.get('set-cookie'), null)
})

test('handoff: expired token refused; return must be same-origin /oauth/authorize', async () => {
  let t0 = NOW
  const { a } = app({ now: () => t0 })
  const token = signHandoff({ ...base, jti: 'hand-exp' })
  t0 = NOW + HANDOFF_TTL_S * 1000 + 1
  assert.equal((await a.request(handoffUrl(token), { redirect: 'manual' })).status, 401)
  const bad = await a.request(handoffUrl(token, 'https://evil.example/oauth/authorize?x=1'), { redirect: 'manual' })
  assert.equal(bad.status, 400)
})

test('consent cookie from a different user cannot approve a form forged for another', async () => {
  const { a } = app()
  const tokenA = signHandoff({ ...base, jti: 'hand-A' })
  const cookieA = ((await a.request(handoffUrl(tokenA), { redirect: 'manual' })).headers.get('set-cookie') ?? '').split(';')[0]!
  const page = await (await a.request(authQ(), { headers: { cookie: cookieA } })).text()
  const csrf = /name="csrf" value="([^"]+)"/.exec(page)![1]!
  const form = new URLSearchParams({ client_id: 'dock', redirect_uri: REDIRECT, response_type: 'code', code_challenge_method: 'S256', state, code_challenge: challenge, workspace: 'ws-main', scope: 'chat:write route:preview', csrf, decision: 'approve' })
  const forged = await a.request('/oauth/authorize', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'shipyard_consent=garbage.0.0' }, body: form, redirect: 'manual' })
  assert.equal(forged.status, 401)
})

test('token: missing or wrong client secret refused before the code is spent', async () => {
  const { a } = app()
  const tokenA = signHandoff({ ...base, jti: 'hand-tok' })
  const cookie = ((await a.request(handoffUrl(tokenA), { redirect: 'manual' })).headers.get('set-cookie') ?? '').split(';')[0]!
  const page = await (await a.request(authQ(), { headers: { cookie } })).text()
  const csrf = /name="csrf" value="([^"]+)"/.exec(page)![1]!
  const form = new URLSearchParams({ client_id: 'dock', redirect_uri: REDIRECT, response_type: 'code', code_challenge_method: 'S256', state, code_challenge: challenge, workspace: 'ws-main', scope: 'chat:write route:preview', csrf, decision: 'approve' })
  const approve = await a.request('/oauth/authorize', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: form, redirect: 'manual' })
  const code = new URL(approve.headers.get('location')!).searchParams.get('code')!
  const tokenForm = (secret?: string) => new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: 'dock', redirect_uri: REDIRECT, ...(secret === undefined ? {} : { client_secret: secret }) })
  const post = (b: URLSearchParams) => a.request('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: b })
  assert.equal((await post(tokenForm())).status, 401)
  assert.equal((await post(tokenForm('wrong-secret-value-0123456789abcdef'))).status, 401)
  const ok = await post(tokenForm(TEST_CLIENT_SECRET))
  assert.equal(ok.status, 200, 'code still usable with the right secret')
})

test('dock client with no registered secret hash fails closed', async () => {
  const keyStore = new MemoryApiKeyStore()
  const a = new Hono()
  a.route('/', createOAuthApp({ keyStore, loginUrl: `${ISS}/x`, csrfSecret: CSRF, resolveSession: async () => undefined }))
  const res = await a.request('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: 'c', code_verifier: verifier, client_id: 'dock', client_secret: 'anything', redirect_uri: REDIRECT }) })
  assert.equal(res.status, 401)
})
