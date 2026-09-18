/**
 * Paybox OAuth connect for the chat portal — ported from Shipyard OS
 * (lib/paybox-connect.ts) to plain ESM for the Hono server.
 *
 * Flow: OAuth discovery → dynamic client registration (redirect_uri =
 * <origin>/api/paybox/connect/callback) → PKCE authorize redirect (user
 * approves with a passkey at Paybox) → callback exchanges the code for
 * tokens. Verifier/state/client_id ride in short-lived httpOnly cookies.
 */
import { createHash, randomBytes } from 'node:crypto'

export function payboxApiBase() {
  return (process.env.PAYBOX_BASE_URL ?? 'https://api.paybox.sh').replace(/\/+$/, '')
}

const base64url = (b) => Buffer.from(b).toString('base64url')

function pkce() {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

async function metadata(baseUrl) {
  const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)
  if (!res.ok) throw new Error(`could not read Paybox OAuth metadata (${res.status})`)
  return res.json()
}

async function registerClient(meta, clientName, redirectUri) {
  const res = await fetch(meta.registration_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }),
  })
  if (!res.ok) throw new Error(`Paybox client registration failed (${res.status})`)
  const { client_id: clientId } = await res.json()
  return clientId
}

// Persist dynamic-client registrations per origin: registering a throwaway
// client on every connect leads Paybox to revoke the account's clients
// ("client is revoked"). One stable, reused client per origin instead.
import { loadScope, saveScope } from './portal-store.mjs'
const registeredClients = await loadScope('paybox-clients')

export async function startConnect(origin, prefix = '') {
  const baseUrl = payboxApiBase()
  const meta = await metadata(baseUrl)
  const redirectUri = `${origin}${prefix}/api/paybox/connect/callback`
  let clientId = registeredClients[origin]
  if (clientId) {
    // Validate the stored client still exists; a revoked/deleted one 404s.
    try {
      const check = await fetch(`${meta.registration_endpoint}/${clientId}`)
      if (!check.ok) clientId = undefined
    } catch { clientId = undefined }
  }
  if (!clientId) {
    clientId = await registerClient(meta, process.env.PAYBOX_CLIENT_NAME ?? 'Shipyard Chat Portal', redirectUri)
    registeredClients[origin] = clientId
    saveScope('paybox-clients', registeredClients)
  }
  const { verifier, challenge } = pkce()
  const state = base64url(randomBytes(16))
  const resource = `${baseUrl}/mcp`
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'mcp offline_access',
    state,
    resource,
  })
  return {
    authorizeUrl: `${meta.authorization_endpoint}?${params.toString()}`,
    state,
    verifier,
    clientId,
  }
}

export async function completeConnect(origin, code, verifier, clientId, prefix = '') {
  const baseUrl = payboxApiBase()
  const meta = await metadata(baseUrl)
  const resource = `${baseUrl}/mcp`
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    // MUST byte-match the authorize call's redirect_uri — including the mount
    // prefix (/portal on prod) — or the exchange is rejected.
    redirect_uri: `${origin}${prefix}/api/paybox/connect/callback`,
    code_verifier: verifier,
    // Public clients (token_endpoint_auth_method: none) authenticate via the
    // client_id in the body — Paybox 422s without it.
    client_id: clientId,
    resource,
  })
  const res = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Paybox token exchange failed (${res.status}): ${body.slice(0, 400)}`)
  }
  const t = await res.json()
  if (!t.access_token) throw new Error('Paybox token exchange returned no access token')
  return {
    clientId,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_in ? Date.now() + t.expires_in * 1e3 : undefined,
    resource,
  }
}

export async function refreshOauth(current) {
  if (!current.refreshToken) throw new Error('no refresh token — reconnect Paybox')
  const baseUrl = payboxApiBase()
  const meta = await metadata(baseUrl)
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: current.refreshToken,
    client_id: current.clientId,
    resource: current.resource ?? `${baseUrl}/mcp`,
  })
  const res = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  if (!res.ok) throw new Error(`Paybox token refresh failed (${res.status})`)
  const t = await res.json()
  return {
    ...current,
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? current.refreshToken,
    expiresAt: t.expires_in ? Date.now() + t.expires_in * 1e3 : undefined,
  }
}

export const CONNECT_STATE_COOKIE = 'paybox_connect_state'
export const CONNECT_VERIFIER_COOKIE = 'paybox_connect_verifier'
export const CONNECT_CLIENT_COOKIE = 'paybox_connect_client'
