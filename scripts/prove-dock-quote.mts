// Optional cross-repository local proof. No remote model/network calls.
import{createHash}from'node:crypto'
import{pathToFileURL}from'node:url'
import{createGatewayApp}from'../src/gateway/server.js'
import{createJevTierInferrer}from'../src/router/jev-tier.js'
import{candidate,model,staticProvider}from'../test/helpers.js'
import type{BoundedQuote,StagePriceContract}from'../src/gateway/bounded-price.js'
import type{DecisionProvider}from'../src/decisions/types.js'
const root=process.env.DOCK_SOURCE_ROOT;if(!root)throw Error('DOCK_SOURCE_ROOT required')
const{quotedShipyardTransport}=await import(pathToFileURL(root+'/node/dock-node/src/execution/shipyard-model.mjs').href)
const{boundedModelGateway}=await import(pathToFileURL(root+'/node/dock-node/src/execution/gateway.mjs').href)
const{boundChatRequest}=await import(pathToFileURL(root+'/node/dock-node/src/execution/chat-contract.mjs').href)
const calls:string[]=[],quotes=new Map<string,BoundedQuote>(),used=new Set<string>()
const price:StagePriceContract={evidence:'fictional-only',expiresAt:new Date(Date.now()+600000).toISOString(),maxCostMicros:100,maxRequestBytes:170000,singleAttempt:true,noHiddenCharges:true,accepts:()=>true,actualCostMicros:()=>20}
const judge:DecisionProvider={id:'jev',async decide(){throw Error('regular forbidden')},async decideOnce(req){calls.push('jev');return{model:'fictional',answers:Object.fromEntries(Object.entries(req.questions).map(([id,q])=>[id,q.type==='choice'?{type:'choice',choice:'economy',confidence:1,probabilities:{economy:1}}:{type:'noul',noul:.1}]))}}}
const provider={...staticProvider('fictional'),async chatOnce(){calls.push('coding');return{content:'Cross-repository quote proof',toolCalls:[],stopReason:'end_turn' as const}}}
const app=createGatewayApp({apiKeys:['fictional'],candidates:[candidate('coding',provider,[model('coding')])],autoTier:createJevTierInferrer({provider:judge}),guardrails:{provider:judge},boundedPrice:{principals:[createHash('sha256').update('fictional').digest('hex')],revision:'fixture',contracts:{'tier:jev':price,'coding:coding':price,'guardrail:jev':price},store:{save:async q=>{quotes.set(q.id,q)},get:async id=>quotes.get(id),consume:async q=>{if(used.has(q.id))return false;used.add(q.id);calls.push('inference reserve');return true},settle:async()=>{calls.push('inference settle')},reconcile:async()=>{throw Error('unexpected reconcile')}}}})
const transport=quotedShipyardTransport({endpoint:'https://fictional.invalid/v1/chat/completions',apiKey:'fictional',contract:{kind:'shipyard-stage-quote',evidence:'fictional-only',revision:'fixture',expiresAt:new Date(Date.now()+120000).toISOString()},fetchImpl:async(url:URL,init:RequestInit)=>app.request(url,init)})
const gateway=boundedModelGateway({...transport,store:{reserve:async()=>{calls.push('dock reserve');return{allowed:true,holdId:'h'}},settle:async()=>{calls.push('dock settle')},reconcile:async()=>{throw Error('unexpected reconcile')}}})
const body=boundChatRequest({model:'auto',messages:[{role:'user',content:'fictional'}]});const result=JSON.parse(await gateway({executionId:'fictional',requestId:body.requestId,model:'auto',prompt:body.prompt}));if(result.choices[0].message.content!=='Cross-repository quote proof'||calls.join('|')!=='dock reserve|inference reserve|jev|coding|jev|inference settle|dock settle')throw Error('Consumed path proof failed '+calls)
console.log(JSON.stringify({actualDockConsumerAndInferenceGateway:true,jevRoutingPreserved:true,calls,priceContractsFictional:true,liveRequests:false}))
