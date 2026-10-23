import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import { createJevTierInferrer } from '../src/router/jev-tier.js'
import { createChainedDecisionProvider } from '../src/decisions/chain.js'
import { candidate, model, staticProvider } from './helpers.js'
import type { DecisionProvider, DecisionRequest, DecisionResponse } from '../src/decisions/types.js'

function setup(fail?: 'tier'|'code'|'guard') {
  const calls: string[] = []
  const decision = (stage: string): DecisionProvider => ({
    id: stage,
    async decide() { calls.push(stage + ':regular'); throw new Error('must not run') },
    async decideOnce(req: DecisionRequest): Promise<DecisionResponse> {
      calls.push(stage)
      if (stage === fail) throw new Error(stage + ' failed')
      return { model: 'fictional-jev', answers: Object.fromEntries(Object.entries(req.questions).map(([id,q]) => [id, q.type === 'choice' ? {type:'choice',choice:'economy',confidence:1,probabilities:{economy:1}} : {type:'noul',noul:.1}])) }
    },
  })
  const tier = createChainedDecisionProvider({ providers: [decision('tier'),decision('tier-fallback')] })
  const guard = createChainedDecisionProvider({ providers: [decision('guard'),decision('guard-fallback')] })
  const provider = { ...staticProvider('fictional'), async chatOnce() { calls.push('code'); if(fail==='code') throw new Error('code failed'); return { content:'fictional',toolCalls:[],stopReason:'end_turn' as const } } }
  const app = createGatewayApp({apiKeys:['k'], candidates:[candidate('first',provider,[model('first')]),candidate('fallback',provider,[model('fallback')])],autoTier:createJevTierInferrer({provider:tier}),guardrails:{provider:guard}})
  return {app,calls}
}
const request = { model:'auto',messages:[{role:'user',content:'fictional'}],shipyard:{no_fallback:true},stream:false }
async function run(app: ReturnType<typeof createGatewayApp>,body:unknown=request) {
 return app.request('/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer k','content-type':'application/json'},body:JSON.stringify(body)})
}
test('bounded chat preserves Jev choice: one tier, one code, one guardrail attempt',async()=>{
 const {app,calls}=setup()
 const pre=await app.request('/v1/models',{headers:{authorization:'Bearer k'}})
 assert.equal(pre.headers.get('x-shipyard-chat-attempt-limit'),'3')
 const res=await run(app);assert.equal(res.status,200)
 assert.equal(res.headers.get('x-shipyard-chat-attempt-limit'),'3')
 await new Promise(r=>setTimeout(r,10))
 assert.deepEqual(calls,['tier','code','guard'])
})
for(const stage of ['tier','code','guard'] as const) test(`bounded ${stage} failure never falls back`,async()=>{
 const {app,calls}=setup(stage);const res=await run(app)
 assert.equal(res.status,stage==='guard'?200:500)
 await new Promise(r=>setTimeout(r,10))
 assert.deepEqual(calls,stage==='tier'?['tier']:stage==='code'?['tier','code']:['tier','code','guard'])
})
test('bounded streaming and malformed switch rejected without any inference',async()=>{
 const {app,calls}=setup()
 assert.equal((await run(app,{...request,stream:true})).status,400)
 assert.equal((await run(app,{...request,shipyard:{no_fallback:'true'}})).status,400)
 assert.deepEqual(calls,[])
})
test('unsupported tier config rejects bounded request before any calls',async()=>{
 const app=createGatewayApp({apiKeys:['k'],candidates:[candidate('x',staticProvider('x'),[model('x')])],autoTier:async()=> 'economy'})
 assert.equal((await run(app)).status,400)
})
test('unsupported chosen coding adapter refuses without fallback invocation',async()=>{
 let calls=0
 const tier=createJevTierInferrer({provider:{id:'fictional',async decide(){throw new Error('not used')},async decideOnce(){return {model:'jev',answers:{tier:{type:'choice',choice:'economy',confidence:1,probabilities:{economy:1}}}}}}})
 const provider={async chat(){calls++;throw new Error('must not run')}}
 const app=createGatewayApp({apiKeys:['k'],candidates:[candidate('legacy',provider,[model('legacy')])],autoTier:tier})
 assert.equal((await run(app)).status,500)
 assert.equal(calls,0)
})
test('default chat still uses normal tier/coding/guardrail methods',async()=>{
 const calls:string[]=[]
 const judge:DecisionProvider={id:'normal',async decide(req){calls.push('decision');return {model:'normal',answers:Object.fromEntries(Object.entries(req.questions).map(([id,q])=>[id,q.type==='choice'?{type:'choice',choice:'economy',confidence:1,probabilities:{economy:1}}:{type:'noul',noul:.1}]))}}}
 const provider={...staticProvider('normal'),async chat(){calls.push('code');return {content:'normal',toolCalls:[],stopReason:'end_turn' as const}}}
 const app=createGatewayApp({apiKeys:['k'],candidates:[candidate('normal',provider,[model('normal')])],autoTier:createJevTierInferrer({provider:judge}),guardrails:{provider:judge}})
 assert.equal((await run(app,{...request,shipyard:{}})).status,200)
 await new Promise(r=>setTimeout(r,10))
 assert.deepEqual(calls,['decision','code','decision'])
})
