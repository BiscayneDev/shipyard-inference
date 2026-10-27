import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Hono} from 'hono'
import ts from 'typescript'
test('all portal paths/methods pause before imports or storage while inference API remains separate',async()=>{
 const source=readFileSync(new URL('../app.ts',import.meta.url),'utf8')
 const start=source.indexOf('const portalMount = new _Hono()')
 const end=source.indexOf("app.route('/portal', portalMount)",start)+"app.route('/portal', portalMount)".length
 const mount=source.slice(start,end)
 assert.equal(mount.includes('import('),false);assert.equal(mount.includes('portalApp.fetch'),false)
 const app=new Hono()
 new Function('app','_Hono',ts.transpileModule(mount,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)(app,Hono)
 app.get('/healthz',c=>c.json({status:'ok'})); app.get('/v1/models',c=>c.json({models:[]}))
 for(const path of ['/portal','/portal/','/portal/api/threads','/portal/api/tender/payout','/portal//api/threads']){
  for(const method of ['GET','POST','DELETE','OPTIONS','HEAD']) assert.equal((await app.request(path,{method})).status,503,`${method} ${path}`)
 }
 assert.equal((await app.request('/healthz')).status,200);assert.equal((await app.request('/v1/models')).status,200)
 assert.equal((await app.request('/portal-other')).status,404)
})
