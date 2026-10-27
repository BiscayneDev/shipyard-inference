import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,statSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const moduleUrl = new URL('../examples/chat-portal/portal-store.mjs', import.meta.url).href
test('local portal state stays outside source with owner-only permissions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'portal-state-'))
 try {
  const run=execFileSync(process.execPath,['--input-type=module','-e',`const s=await import(${JSON.stringify(moduleUrl)});s.saveScope('sessions',{fake:{fixture:true}});await new Promise(r=>setTimeout(r,350));console.log(JSON.stringify(await s.loadScope('sessions')))`],{env:{...process.env,SUPABASE_URL:'',SUPABASE_SERVICE_KEY:'',SHIPYARD_PORTAL_DATA_DIR:dir},encoding:'utf8'})
  assert.equal(JSON.parse(run).fake.fixture,true)
  assert.equal(statSync(dir).mode&0o777,0o700)
  assert.equal(statSync(join(dir,'sessions.json')).mode&0o777,0o600)
  assert.equal(JSON.parse(readFileSync(join(dir,'sessions.json'),'utf8')).fake.fixture,true)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
test('refuses source-tree storage rather than persisting credentials in repo',()=>{
 assert.throws(()=>execFileSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(moduleUrl)})`],{env:{...process.env,SHIPYARD_PORTAL_DATA_DIR:process.cwd()},stdio:'pipe'}),/Command failed/)
})
test('source-tree symlink destination cannot bypass boundary',async()=>{
 const {symlinkSync}=await import('node:fs')
 const dir=mkdtempSync(join(tmpdir(),'portal-link-'))
 try{
  symlinkSync(process.cwd(),join(dir,'alias'),'dir')
  assert.throws(()=>execFileSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(moduleUrl)})`],{env:{...process.env,SHIPYARD_PORTAL_DATA_DIR:join(dir,'alias','new-runtime')},stdio:'pipe'}),/Command failed/)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
test('Supabase remains the production store and does not write local files',()=>{
 const dir=mkdtempSync(join(tmpdir(),'portal-sb-'))
 try{
  const output=execFileSync(process.execPath,['--input-type=module','-e',`let methods=[];globalThis.fetch=async(u,o)=>{methods.push(o.method||'GET');return {ok:true,json:async()=>[{key:'fake',value:{fixture:true}}]}};const s=await import(${JSON.stringify(moduleUrl)});console.log(JSON.stringify(await s.loadScope('sessions')));s.saveScope('sessions',{fake:{fixture:true}});await new Promise(r=>setTimeout(r,20));console.log(JSON.stringify(methods))`],{env:{...process.env,SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_KEY:'fictional-test-key',SHIPYARD_PORTAL_DATA_DIR:dir},encoding:'utf8'})
  assert.equal(JSON.parse(output.split('\n')[0]).fake.fixture,true)
  assert.deepEqual(JSON.parse(output.split('\n')[1]),['GET','POST'])
  assert.throws(()=>statSync(join(dir,'sessions.json')))
 }finally{rmSync(dir,{recursive:true,force:true})}
})
