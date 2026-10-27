import fs from 'node:fs';import os from 'node:os';import {serve} from '@hono/node-server';
process.env.SHIPYARD_PORTAL_DATA_DIR=fs.mkdtempSync(os.tmpdir()+'/portal-browser-callback-');
for(const k of Object.keys(process.env)) if(/^(SUPABASE_|PAYBOX_|USEPOD_|SHIPYARD_X402_|TENDER_|TYPESAFE_|OPENROUTER_|VERCEL_AI_)/.test(k)) delete process.env[k];
Object.assign(process.env,{SHIPYARD_SITE_SUPABASE_URL:'https://fictional.invalid',SHIPYARD_SITE_SUPABASE_ANON_KEY:'fictional',SHIPYARD_SITE_ALLOWED_EMAILS:'a@example.invalid,b@example.invalid'});
let state,challenge,redirect,exchange=0;
globalThis.fetch=async(url,opts={})=>{
 url=String(url);
 if(url==='https://fictional.invalid/auth/v1/user') {const token=opts.headers.authorization.slice(7);return Response.json({id:token,email:token+'@example.invalid',email_confirmed_at:'2026-01-01'});}
 if(url==='https://api.paybox.sh/.well-known/oauth-authorization-server') return Response.json({authorization_endpoint:'http://127.0.0.1:18949/fake-authorize',registration_endpoint:'https://fictional.invalid/register',token_endpoint:'https://fictional.invalid/token'});
 if(url==='https://fictional.invalid/register'){redirect=JSON.parse(opts.body).redirect_uris[0];return Response.json({client_id:'fictional-client'});}
 if(url==='https://fictional.invalid/token') {const form=new URLSearchParams(opts.body);const {createHash}=await import('node:crypto');if(form.get('redirect_uri')!==redirect || createHash('sha256').update(form.get('code_verifier')).digest('base64url')!==challenge)throw new Error('PKCE/redirect mismatch');exchange++;return Response.json({access_token:'fictional-only',refresh_token:'fictional-only',expires_in:300});}
 throw new Error('External network prohibited in fictional browser callback test');
};
const {portalApp}=await import('../examples/chat-portal/server.mjs');
const server=serve({port:18949,hostname:'127.0.0.1',fetch:async req=>{
 const url=new URL(req.url);
 if(url.pathname==='/api/auth/config')return Response.json({configured:true,url:'https://fictional.invalid',anonKey:'fictional'});
 if(url.pathname==='/fake-authorize'){state=url.searchParams.get('state');challenge=url.searchParams.get('code_challenge');return Response.redirect(redirect+'?code=fictional-code&state='+state);}
 if(url.pathname==='/fixture-result')return Response.json({exchange,pkce:true});
 const res=await portalApp.fetch(req);
 if(url.pathname==='/auth.js'){let text=await res.text();text=text.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:localStorage.getItem('fixture-owner')||'a'}}})}})})");return new Response(text,{headers:{'content-type':'text/javascript'}});}
 if(url.pathname==='/'){let text=await res.text();text=text.replace('<script src="./wallet-bundle.js"></script>','').replace('<script src="./upto-bundle.js"></script>','');return new Response(text,{headers:{'content-type':'text/html'}});}
 return res;
}});
process.on('SIGTERM',()=>{server.close();fs.rmSync(process.env.SHIPYARD_PORTAL_DATA_DIR,{recursive:true,force:true});process.exit(0)});
