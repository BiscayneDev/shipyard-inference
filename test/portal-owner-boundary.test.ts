import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Hono} from 'hono'
// @ts-expect-error JavaScript portal module
import {portalOwner,protectMap,bindOwner,owned,portalIdentityMiddleware,authenticatePortal} from '../examples/chat-portal/owner-boundary.mjs'
const env={SHIPYARD_SITE_SUPABASE_URL:'https://example.invalid',SHIPYARD_SITE_SUPABASE_ANON_KEY:'fictional',SHIPYARD_SITE_ALLOWED_EMAILS:'a@example.invalid,b@example.invalid'}
const f=async(_url:any,o:any)=>{const token=o.headers.authorization.slice(7);return {ok:token==='a'||token==='b',json:async()=>({id:token,email:token+'@example.invalid',email_confirmed_at:'2026-01-01'})}}
test('all private route methods require verified allowed identity; callback cookie is restricted',async()=>{
 const app=new Hono();app.use('/api/*',portalIdentityMiddleware(env,f));app.all('/api/*',c=>c.json({ok:true}))
 for(const method of ['GET','POST','DELETE','OPTIONS']) for(const path of ['/api/threads','/api/settings','/api/activity','/api/guardrails','/api/insights','/api/paybox/wallet','/api/settle','/api/tender/payout']){
  assert.equal((await app.request(path,{method})).status,401)
  assert.equal((await app.request(path,{method,headers:{authorization:'Bearer a'}})).status,200)
 }
 assert.equal((await app.request('/api/threads',{headers:{cookie:'portal.oauth-auth=a'}})).status,401)
 assert.equal((await app.request('/api/paybox/connect/callback',{headers:{cookie:'portal.oauth-auth=a'}})).status,200)
 assert.equal((await authenticatePortal(new Request('https://example.invalid/api/x',{headers:{authorization:'Bearer wrong'}}),env,f)).status,401)
})
test('owner-bound maps filter every get/list/delete/write; unowned legacy data is not adopted',async()=>{
 const map=new Map<string,any>([['legacy',{id:'legacy'}],['foreign',{id:'foreign',ownerId:'b'}]])
 const raw=protectMap(map)
 await portalOwner.run('a',async()=>{
  assert.throws(()=>map.set('legacy',{id:'legacy'}));assert.throws(()=>map.set('foreign',{id:'foreign'}));assert.equal(map.get('legacy'),undefined);assert.equal(map.get('foreign'),undefined)
  assert.equal(map.delete('foreign'),false)
  assert.deepEqual([...map.values()],[])
  map.set('mine',{id:'mine'})
  assert.equal(map.get('mine').ownerId,'a')
  assert.throws(()=>map.set('attack',{ownerId:'b'}))
  raw.hydrate('old',{id:'old'})
  assert.equal(map.get('old'),undefined)
  assert.equal(owned(bindOwner({fixture:true})),true)
 })
 await portalOwner.run('b',async()=>{assert.equal(map.get('mine'),undefined);assert.deepEqual([...map.values()].map(x=>x.id),['foreign'])})
 assert.deepEqual([...map.values()],[])
})
test('concurrent request owner contexts cannot cross',async()=>{
 await Promise.all(['a','b'].map(owner=>portalOwner.run(owner,async()=>{await new Promise(r=>setTimeout(r,10));assert.equal(bindOwner({}).ownerId,owner)})))
})

test('missing config, unconfirmed email and non-allowed account fail closed',async()=>{
 const r=new Request('https://example.invalid/api/settings',{headers:{authorization:'Bearer a'}})
 assert.equal((await authenticatePortal(r,{},f)).status,503)
 for(const user of [{id:'a',email:'a@example.invalid'},{id:'a',email:'elsewhere@example.invalid',email_confirmed_at:'2026-01-01'}]){
  assert.equal((await authenticatePortal(r,env,async()=>({ok:true,json:async()=>user}))).status,403)
 }
})
