import { AsyncLocalStorage } from 'node:async_hooks'
export const portalOwner = new AsyncLocalStorage()
export const currentOwner = () => portalOwner.getStore()
export const owned = (record) => Boolean(currentOwner() && record?.ownerId === currentOwner())
export const bindOwner = (record) => {
  const ownerId = currentOwner()
  if (!ownerId) throw new Error('Portal authentication required')
  if (record.ownerId && record.ownerId !== ownerId) throw new Error('Portal owner mismatch')
  return { ...record, ownerId }
}
export function protectMap(map) {
  const get = map.get.bind(map), set = map.set.bind(map), del = map.delete.bind(map), values = map.values.bind(map)
  map.get = (key) => { const record = get(key); return owned(record) ? record : undefined }
  map.set = (key, record) => {
    const existing = get(key)
    if (existing && !owned(existing)) throw new Error('Portal owner mismatch')
    set(key, bindOwner(record)); return map
  }
  map.delete = (key) => owned(get(key)) ? del(key) : false
  map.values = function* () { for (const record of values()) if (owned(record)) yield record }
  // Hydration cannot assign an owner to unowned legacy data.
  return { hydrate: (key, record) => set(key, record) }
}
export async function authenticatePortal(request, env = process.env, fetchImpl = fetch) {
  const url = env.SHIPYARD_SITE_SUPABASE_URL?.trim()
  const anonKey = env.SHIPYARD_SITE_SUPABASE_ANON_KEY?.trim()
  const allowed = (env.SHIPYARD_SITE_ALLOWED_EMAILS || '').split(/[,\s]+/).map(s=>s.trim().toLowerCase()).filter(Boolean)
  if (!url || !anonKey || !allowed.length) return { status: 503 }
  let token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1]
  // Only the OAuth callback may use the short-lived httpOnly identity cookie.
  if (!token && new URL(request.url).pathname.endsWith('/api/paybox/connect/callback')) {
    token = request.headers.get('cookie')?.match(/(?:^|;\s*)portal\.oauth-auth=([^;]+)/)?.[1]
  }
  if (!token) return { status: 401 }
  try {
    const response = await fetchImpl(url.replace(/\/$/,'')+'/auth/v1/user',{headers:{apikey:anonKey,authorization:'Bearer '+token}})
    if (!response.ok) return { status: 401 }
    const user = await response.json()
    if (typeof user.id !== 'string' || !user.id || !user.email_confirmed_at || !allowed.includes(String(user.email||'').toLowerCase())) return {status:403}
    return { status:200, ownerId:user.id, token }
  } catch { return {status:503} }
}
export function portalIdentityMiddleware(env = process.env, fetchImpl = fetch) {
  return async (c,next) => {
    const identity = await authenticatePortal(c.req.raw,env,fetchImpl)
    if (identity.status !== 200) return c.json({error:'Sign in to an allowed Shipyard account'},identity.status)
    c.header('Cache-Control','no-store')
    return portalOwner.run(identity.ownerId,async()=>{
      if (['POST','PUT','PATCH','DELETE'].includes(c.req.method)) {
        const origin = c.req.header('origin')
        if (origin && origin !== new URL(c.req.url).origin) return c.json({error:'Cross-origin portal write refused'},403)
      }
      if (c.req.path === '/api/wallet/connect') {
        c.header('set-cookie',`portal.oauth-auth=${identity.token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,{append:true})
      }
      if (c.req.path === '/api/paybox/connect/callback') c.header('set-cookie','portal.oauth-auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',{append:true})
      await next()
    })
  }
}
