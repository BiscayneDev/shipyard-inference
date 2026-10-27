import fs from 'node:fs'
import os from 'node:os'
process.env.SHIPYARD_PORTAL_DATA_DIR=fs.mkdtempSync(os.tmpdir()+'/portal-integration-')
for(const k of Object.keys(process.env)) if (/^(SUPABASE_|PAYBOX_|USEPOD_|SHIPYARD_X402_|TENDER_|TYPESAFE_|OPENROUTER_|VERCEL_AI_)/.test(k)) delete process.env[k]
Object.assign(process.env,{SHIPYARD_SITE_SUPABASE_URL:'https://example.invalid',SHIPYARD_SITE_SUPABASE_ANON_KEY:'fictional',SHIPYARD_SITE_ALLOWED_EMAILS:'a@example.invalid,b@example.invalid'})
globalThis.fetch=async(url,opts)=>{
 if(String(url)==='https://example.invalid/auth/v1/user'){const token=opts.headers.authorization.slice(7);return new Response(JSON.stringify({id:token,email:token+'@example.invalid',email_confirmed_at:'2026-01-01'}),{status:200})}
 throw new Error('External network prohibited in fictional portal test')
}
const {portalApp}=await import(new URL('../examples/chat-portal/server.mjs',import.meta.url))
import assert from 'node:assert/strict'
const request=async(path,owner,method='GET',body)=>portalApp.fetch(new Request('https://example.invalid'+path,{method,headers:{...(owner?{authorization:'Bearer '+owner}:{}),'content-type':'application/json'},body:body?JSON.stringify(body):undefined}))
try{
 assert.equal((await request('/api/threads')).status,401)
 const create=await request('/api/wallet/connect','a','POST',{wallet:'metamask'});assert.equal(create.status,200)
 const a=await create.json();assert.ok(a.sessionId)
 assert.equal((await request('/api/wallet/'+a.sessionId,'a')).status,200)
 assert.equal((await request('/api/wallet/'+a.sessionId,'b')).status,404)
 for(const route of ['/api/chat','/api/settle','/api/tender/click','/api/wallet/topup','/api/wallet/deposit/build','/api/wallet/deposit/submit','/api/decisions','/api/route-preview']) assert.equal((await request(route,'b','POST',{sessionId:a.sessionId})).status,404,route)
 const chat=await request('/api/chat','a','POST',{sessionId:a.sessionId,mode:'demo',messages:[{role:'user',content:'fictional fixture hello'}]})
 assert.equal(chat.status,200);await chat.text()
 const ownThreads=await (await request('/api/threads','a')).json();assert.equal(ownThreads.threads.length,1)
 assert.equal((await request('/api/threads/'+a.sessionId,'b')).status,404)
 await request('/api/threads/'+a.sessionId,'b','DELETE')
 assert.equal((await request('/api/threads/'+a.sessionId,'a')).status,200)
 assert.deepEqual((await (await request('/api/activity','b')).json()).events,[])
 assert.equal((await (await request('/api/insights','b')).json()).messages,0)
 assert.equal((await request('/api/chat','a','POST',{mode:'production',messages:[]})).status,503)
 assert.equal((await request('/api/tender/payout','a','POST',{sessionId:a.sessionId})).status,503)
 assert.deepEqual((await (await request('/api/threads','b')).json()).threads,[])
 console.log('Fictional full portal: auth/session ownership/private methods/payout pause PASS')
}finally{fs.rmSync(process.env.SHIPYARD_PORTAL_DATA_DIR,{recursive:true,force:true})}
