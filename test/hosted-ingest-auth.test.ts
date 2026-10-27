import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createOperatorConsole} from '../src/operator/server.js'
import {TelemetryHub} from '../src/operator/hub.js'
const body=JSON.stringify({source:'fictional',events:[]})
test('hosted ingest fails closed without tokens, refuses missing/wrong token and accepts valid reporter',async()=>{
 for(const tokens of [[],['fictional-reporter-token']]){
  const app=createOperatorConsole({hub:new TelemetryHub(),operatorTokens:['fictional-operator'],ingestTokens:tokens,requireIngestAuth:true})
  for(const authorization of ['', 'Bearer wrong']) assert.equal((await app.request('/ingest',{method:'POST',headers:{authorization,'content-type':'application/json'},body})).status,401)
  if(tokens.length) assert.equal((await app.request('/ingest',{method:'POST',headers:{authorization:'Bearer '+tokens[0],'content-type':'application/json'},body})).status,200)
  assert.equal((await app.request('/api/meta')).status,401)
  assert.equal((await app.request('/api/meta',{headers:{authorization:'Bearer fictional-operator'}})).status,200)
 }
})
test('local explicit development convenience remains available',async()=>{
 const app=createOperatorConsole({hub:new TelemetryHub(),ingestTokens:[]})
 assert.equal((await app.request('/ingest',{method:'POST',headers:{'content-type':'application/json'},body})).status,200)
})
