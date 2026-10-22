import { createHmac, timingSafeEqual } from 'node:crypto'

// Token handoff from the Shipyard web app to the gateway's OAuth consent flow.
//
// The web app (signed-in user only) mints a short-lived token:
//   payload = { sub, aud: 'shipyard-inference-oauth', iss, iat, exp (+120s), jti }
//   token   = base64url(JSON(payload)) + '.' + base64url(HMAC-SHA256(SHIPYARD_HANDOFF_SECRET, body))
// The gateway verifies signature, iss, aud, exp, and consumes jti once. A
// successful handoff sets a short consent-session cookie (10 min) that only
// /oauth/authorize reads. A user id from a query parameter is never trusted.

export const HANDOFF_AUD = 'shipyard-inference-oauth'
export const HANDOFF_TTL_S = 120
export const CONSENT_TTL_S = 600
export const CONSENT_COOKIE = 'shipyard_consent'

export interface HandoffPayload {
  sub: string
  aud: string
  iss: string
  iat: number
  exp: number
  jti: string
}

export type HandoffVerdict =
  | { ok: true; payload: HandoffPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'wrong_aud' | 'wrong_iss' | 'expired' | 'missing_claims' }

const b64u = (buf: Buffer | string) => Buffer.from(buf).toString('base64url')

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url')
}

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Mint a handoff token. Caller must have already verified the user is signed in. */
export function signHandoff(p: { sub: string; iss: string; jti: string; nowMs: number; secret: string }): string {
  if (!p.secret || p.secret.length < 32) throw new Error('handoff secret must be at least 32 chars')
  const iat = Math.floor(p.nowMs / 1000)
  const payload: HandoffPayload = { sub: p.sub, aud: HANDOFF_AUD, iss: p.iss, iat, exp: iat + HANDOFF_TTL_S, jti: p.jti }
  const body = b64u(JSON.stringify(payload))
  return `${body}.${sign(body, p.secret)}`
}

export function verifyHandoff(token: string, o: { secret: string; expectedIss: string; nowMs: number }): HandoffVerdict {
  if (!o.secret || o.secret.length < 32) return { ok: false, reason: 'bad_signature' }
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' }
  const [body, sig] = parts as [string, string]
  if (!safeEq(sign(body, o.secret), sig)) return { ok: false, reason: 'bad_signature' }
  let p: Partial<HandoffPayload>
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<HandoffPayload>
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (typeof p.sub !== 'string' || !p.sub || typeof p.jti !== 'string' || !p.jti || typeof p.exp !== 'number' || typeof p.iss !== 'string') {
    return { ok: false, reason: 'missing_claims' }
  }
  if (p.aud !== HANDOFF_AUD) return { ok: false, reason: 'wrong_aud' }
  if (p.iss !== o.expectedIss) return { ok: false, reason: 'wrong_iss' }
  if (Math.floor(o.nowMs / 1000) >= p.exp) return { ok: false, reason: 'expired' }
  return { ok: true, payload: p as HandoffPayload }
}

/** Consent-session cookie value: userId.exp.hmac. Signed with a key derived from the CSRF secret. */
export function signConsent(userId: string, secret: string, nowMs: number): string {
  const exp = Math.floor(nowMs / 1000) + CONSENT_TTL_S
  const body = `${b64u(userId)}.${exp}`
  return `${body}.${sign(`consent\u0000${body}`, secret)}`
}

export function readConsent(value: string | undefined, secret: string, nowMs: number): string | undefined {
  if (!value || !secret) return undefined
  const parts = value.split('.')
  if (parts.length !== 3) return undefined
  const [u, expStr, sig] = parts as [string, string, string]
  const body = `${u}.${expStr}`
  if (!safeEq(sign(`consent\u0000${body}`, secret), sig)) return undefined
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || Math.floor(nowMs / 1000) >= exp) return undefined
  return Buffer.from(u, 'base64url').toString('utf8') || undefined
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return undefined
}

export function consentCookieHeader(value: string): string {
  return `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_TTL_S}; Path=/; HttpOnly; Secure; SameSite=Lax`
}
