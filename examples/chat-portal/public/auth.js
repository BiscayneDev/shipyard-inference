// Reuse the site's existing Supabase OTP login. No new portal passwords/keys.
const nativeFetch = window.fetch.bind(window)
const cfgResponse = await nativeFetch('/api/auth/config',{cache:'no-store'})
const cfg = await cfgResponse.json()
if (!cfg.configured) throw new Error('Shipyard sign-in is not configured')
const {createClient} = await import('https://esm.sh/@supabase/supabase-js@2')
const client = createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})
const {data} = await client.auth.getSession()
if (!data.session) { location.replace('/login?next=portal'); throw new Error('Sign in required') }
window.fetch = async (input,init={}) => {
 const url = new URL(input instanceof Request ? input.url : input,location.href)
 if (url.origin === location.origin && /\/(?:portal\/)?api\//.test(url.pathname)) {
  const {data} = await client.auth.getSession()
  if (!data.session) { location.replace('/login?next=portal'); throw new Error('Sign in required') }
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  new Headers(init.headers).forEach((v,k)=>headers.set(k,v))
  headers.set('authorization','Bearer '+data.session.access_token)
  return nativeFetch(input,{...init,headers,cache:'no-store'})
 }
 return nativeFetch(input,init)
}
