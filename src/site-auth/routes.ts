import { Hono } from 'hono'
import { isAllowedEmail } from './allow.js'

/**
 * Sign-in for the Shipyard website. Email one-time code through Supabase Auth; the server then checks the
 * signed-in address against SHIPYARD_SITE_ALLOWED_EMAILS. Nothing here grants API access by itself.
 *
 * Env (names only): SHIPYARD_SITE_SUPABASE_URL, SHIPYARD_SITE_SUPABASE_ANON_KEY, SHIPYARD_SITE_ALLOWED_EMAILS.
 * Unset env = the page says sign-in is not configured and every check denies.
 */
export function siteAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const url = env.SHIPYARD_SITE_SUPABASE_URL?.trim() ?? ''
  const anonKey = env.SHIPYARD_SITE_SUPABASE_ANON_KEY?.trim() ?? ''
  const allowed = (env.SHIPYARD_SITE_ALLOWED_EMAILS ?? '').trim().length > 0
  return { configured: Boolean(url && anonKey && allowed), url, anonKey }
}

export const siteAuth = new Hono()

/** Public browser config. The anon key is designed to be public; the allowlist is enforced server-side. */
siteAuth.get('/api/auth/config', (c) => {
  const cfg = siteAuthConfig()
  return c.json(cfg.configured ? { configured: true, url: cfg.url, anonKey: cfg.anonKey } : { configured: false })
})

/** Checks a Supabase access token: asks Supabase who it belongs to, then checks the allowlist. */
siteAuth.post('/api/auth/allowed', async (c) => {
  const cfg = siteAuthConfig()
  if (!cfg.configured) return c.json({ allowed: false, reason: 'not_configured' }, 503)
  const header = c.req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return c.json({ allowed: false, reason: 'missing_token' }, 401)
  try {
    const res = await fetch(`${cfg.url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: cfg.anonKey, authorization: `Bearer ${token}` },
    })
    if (!res.ok) return c.json({ allowed: false, reason: 'invalid_session' }, 401)
    const user = (await res.json()) as { email?: string | null }
    const email = user.email ?? null
    if (!isAllowedEmail(email, process.env.SHIPYARD_SITE_ALLOWED_EMAILS)) {
      return c.json({ allowed: false, reason: 'not_on_list' }, 403)
    }
    return c.json({ allowed: true, email })
  } catch {
    return c.json({ allowed: false, reason: 'auth_unreachable' }, 502)
  }
})
