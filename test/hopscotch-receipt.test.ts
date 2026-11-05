import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseHopscotchReceipt,createHopscotchReceiptReader} from '../src/providers/hopscotch-receipt.js'
const expected={requestId:'req_fictional',model:'fictional/model'}
const receipt={object:'usage.request',request_id:expected.requestId,model:expected.model,outcome:'served',served_on_own_key:false,paid_from_allowance:false,charge:{amount_micros:123,currency:'USD',rate_revision_id:'rr_fictional'}}
test('exact receipt uses provider all-in microdollars, not token math',()=>{
 assert.equal(parseHopscotchReceipt({...receipt,usage:{prompt_tokens:null,completion_tokens:null}},expected)?.costMicros,123)
 for(const change of [{request_id:'other'},{model:'other'},{outcome:'failed'},{served_on_own_key:true},{paid_from_allowance:true},{charge:null},{charge:{...receipt.charge,amount_micros:1.5}},{charge:{...receipt.charge,amount_micros:-1}},{charge:{...receipt.charge,currency:'EUR'}},{charge:{...receipt.charge,rate_revision_id:''}}])assert.equal(parseHopscotchReceipt({...receipt,...change},expected),undefined)
})
test('late record retries a 404 once without repeating model call',async()=>{
 let calls=0,pauses=0
 const read=createHopscotchReceiptReader({apiKey:'fictional',pause:async()=>{pauses++},fetch:async(url,init)=>{assert.equal(url,'https://api.hopscotchlabs.ai/v1/usage/req_fictional');assert.equal(init?.redirect,'error');calls++;return calls===1?new Response('',{status:404}):Response.json(receipt)}})
 assert.equal((await read(expected))?.costMicros,123);assert.equal(calls,2);assert.equal(pauses,1)
})
test('unknown/forbidden/unavailable never becomes zero, redirects or unbounded polling',async()=>{
 for(const status of [401,403,404,429,500]){let calls=0;const read=createHopscotchReceiptReader({apiKey:'fictional',pause:async()=>{},fetch:async()=>{calls++;return new Response('',{status})}});assert.equal(await read(expected),undefined);assert.equal(calls,status===404?2:1)}
 let calls=0;const read=createHopscotchReceiptReader({apiKey:'fictional',fetch:async()=>{calls++;throw Error('offline')}});assert.equal(await read(expected),undefined);assert.equal(calls,1);assert.equal(await read({...expected,requestId:'../../other'}),undefined);assert.equal(calls,1)
})

test('actual bounded adapter withholds text until exact receipt; ordinary chat unchanged',async()=>{
 const {createHopscotchProvider,hopscotchReceipt}=await import('../src/providers/hopscotch.js')
 const params={system:'fictional',messages:[{role:'user' as const,content:'fictional'}],tools:[],model:expected.model,maxTokens:32}
 let calls=0,lookups=0
 const f:typeof fetch=async()=>{calls++;return Response.json({id:'fictional-completion-id',object:'chat.completion',model:expected.model,choices:[{index:0,message:{role:'assistant',content:'fictional answer'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}},{headers:{'x-hopscotch-request-id':expected.requestId}})}
 const provider=createHopscotchProvider({apiKey:'fictional',fetch:f,receiptReader:async e=>{lookups++;assert.deepEqual(e,expected);return {...expected,costMicros:123,rateRevision:'rr_fictional'}}})
 const result=await provider.chatOnce(params)
 assert.equal(result.content,'fictional answer');assert.equal(hopscotchReceipt(result)?.costMicros,123)
 assert.equal(hopscotchReceipt({...result}),undefined);assert.equal(JSON.stringify(result).includes('rr_fictional'),false)
 await provider.chat(params);assert.equal(lookups,1);assert.equal(calls,2)
 const missing=createHopscotchProvider({apiKey:'fictional',fetch:f,receiptReader:async()=>undefined})
 await assert.rejects(missing.chatOnce(params),/authoritative charge unavailable/)
 assert.equal(calls,3)
})
test('missing transport receipt id fails without receipt lookup and no SDK retry',async()=>{
 const {createHopscotchProvider}=await import('../src/providers/hopscotch.js');let calls=0,lookups=0
 const p=createHopscotchProvider({apiKey:'fictional',fetch:async()=>{calls++;return Response.json({id:'fictional',choices:[{message:{content:'hidden'},finish_reason:'stop'}]})},receiptReader:async()=>{lookups++;return undefined}})
 await assert.rejects(p.chatOnce({system:'fictional',messages:[],tools:[]}),/missing request id/);assert.equal(calls,1);assert.equal(lookups,0)
})

test('real adapter receipt consumed by bounded ledger before output; unknown retains full reserve',async()=>{
 const {createHopscotchProvider,hopscotchReceipt}=await import('../src/providers/hopscotch.js')
 const {issueBoundedPrice,consumeBoundedPrice}=await import('../src/gateway/bounded-price.js')
 for(const known of [true,false]){
 let settled:number|undefined,reconcile=false,reserved=false
 const store={save:async()=>{},get:async()=>undefined,consume:async()=>{reserved=true;return true},settle:async(_q:unknown,cost:number)=>{settled=cost},reconcile:async()=>{reconcile=true}}
 const params={system:'fictional',messages:[],tools:[],model:expected.model,maxTokens:32}
 const config={revision:'fictional-review',principals:['fictional-principal'],store,contracts:{'coding:hopscotch':{evidence:'fictional externally enforced cap, NOT an assertion about live Hopscotch',expiresAt:new Date(Date.now()+60000).toISOString(),maxCostMicros:200,maxRequestBytes:10000,singleAttempt:true as const,noHiddenCharges:true as const,accepts:()=>true,actualCostMicros:(out:unknown)=>hopscotchReceipt(out as import('../src/types.js').LLMResponse)?.costMicros}}}
 const q=await issueBoundedPrice(config,'fictional-principal',params,['coding:hopscotch']);const bound=await consumeBoundedPrice(config,q,'fictional-principal',params,['coding:hopscotch'])
 const provider=createHopscotchProvider({apiKey:'fictional',fetch:async()=>{assert.equal(reserved,true);return Response.json({id:'fictional',choices:[{message:{content:'fictional'},finish_reason:'stop'}]},{headers:{'x-hopscotch-request-id':expected.requestId}})},receiptReader:async()=>known?{...expected,costMicros:123,rateRevision:'rr_fictional'}:undefined})
 if(known){await bound.boundary.invoke({stage:'coding',provider:'hopscotch',request:params},()=>provider.chatOnce(params));assert.equal(await bound.settle(),123);assert.equal(settled,123)}
 else{await assert.rejects(bound.boundary.invoke({stage:'coding',provider:'hopscotch',request:params},()=>provider.chatOnce(params)));await assert.rejects(bound.settle());await bound.reconcile();assert.equal(reconcile,true);assert.equal(settled,undefined)}
 }
})

test('receipt-enabled adapter refuses custom upstream origin',async()=>{
 const {createHopscotchProvider}=await import('../src/providers/hopscotch.js')
 assert.throws(()=>createHopscotchProvider({apiKey:'fictional',baseURL:'https://other.invalid/v1',receiptReader:async()=>undefined}),/canonical transport/)
})
