import {test} from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error local JavaScript utility has no TS declaration
import {credentialRules} from '../scripts/check-credentials.mjs'
test('redacted credential tripwire detects runtime state and token literals',()=>{
 const fake=Buffer.from(JSON.stringify({alg:'test-fixture'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({fixture:true,exp:1})).toString('base64url')+'.'+'x'.repeat(32)
 assert.deepEqual(credentialRules('example/.data/sessions.json','{}'),['runtime-state-path'])
 assert.deepEqual(credentialRules('example.js',fake),['jwt-literal'])
 assert.deepEqual(credentialRules('example.json',JSON.stringify({refreshToken:'x'.repeat(64)})),['oauth-token-literal'])
 assert.deepEqual(credentialRules('example.js','github'+'_pat_'+'x'.repeat(40)),['service-token-literal'])
 assert.deepEqual(credentialRules('key','-----BEGIN '+'PRIVATE KEY-----'),['private-key'])
})
test('short fictional examples and environment references are allowed',()=>{
 assert.deepEqual(credentialRules('src/oauth.ts',`const token=process.env.ACCESS_TOKEN; const fixture={refreshToken:'fictional'};`),[])
})
test('CLI scans staged blobs rather than modified working files and never prints secret values',async()=>{
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs')
 const {execFileSync,spawnSync}=await import('node:child_process')
 const {tmpdir}=await import('node:os');const {join}=await import('node:path')
 const dir=mkdtempSync(join(tmpdir(),'credential-guard-'))
 try{
  execFileSync('git',['init','--quiet'],{cwd:dir})
  const fictional='x'.repeat(65)
  writeFileSync(join(dir,'example.json'),JSON.stringify({accessToken:fictional}))
  execFileSync('git',['add','example.json'],{cwd:dir})
  writeFileSync(join(dir,'example.json'),'{}')
  const result=spawnSync(process.execPath,[new URL('../scripts/check-credentials.mjs',import.meta.url).pathname,'--staged'],{cwd:dir,encoding:'utf8'})
  assert.equal(result.status,1)
  assert.equal(result.stdout,'')
  assert.equal(result.stderr.includes(fictional),false)
  assert.deepEqual(JSON.parse(result.stderr),{path:'example.json',rule:'oauth-token-literal'})
 }finally{rmSync(dir,{recursive:true,force:true})}
})
