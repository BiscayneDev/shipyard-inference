import { createHash, randomUUID } from 'node:crypto'
import type { AttemptBoundary, AttemptInvocation } from './bounded-attempt.js'
/** A reviewed operator contract, not catalog prices or route estimates. */
export interface StagePriceContract {
  evidence: string
  expiresAt: string
  maxCostMicros: number
  maxRequestBytes: number
  singleAttempt: true
  noHiddenCharges: true
  /** Validates exact complete input before dispatch (incl schemas/cache/reasoning). */
  accepts(input: AttemptInvocation): boolean
  /** Authoritative ALL-IN charge, including cached/reasoning tokens. Undefined = unknown. */
  actualCostMicros(output: unknown, input?:AttemptInvocation): number | undefined
}
export interface BoundedQuote { id:string; principal:string; digest:string; revision:string; expiresAt:string; maxCostMicros:number }
/** Production must supply durable atomic storage. No default/in-memory activation. */
export interface BoundedPriceStore {
  save(quote:BoundedQuote):Promise<void>
  get(id:string):Promise<BoundedQuote|undefined>
  /** Atomic consume + reserve against scoped budget. Replays, expired, mismatches refuse. */
  consume(input:BoundedQuote):Promise<boolean>
  /** Awaited, exact/idempotent; may not exceed reserved max. */
  settle(quote:BoundedQuote,costMicros:number):Promise<void>
  /** Unknown/error retains full reserve; never automatic release/retry. */
  reconcile(quote:BoundedQuote):Promise<void>
}
export interface BoundedPriceConfig { revision:string; /** SHA256 bearer principals that MUST use this path; raw keys never persisted. */ principals:string[]; store:BoundedPriceStore; contracts:Record<string,StagePriceContract> }
export function requestDigest(body:unknown){return createHash('sha256').update(JSON.stringify(body)).digest('hex')}
const valid=(c:StagePriceContract,now:number)=>c.evidence&&Date.parse(c.expiresAt)>now&&c.singleAttempt===true&&c.noHiddenCharges===true&&Number.isSafeInteger(c.maxCostMicros)&&c.maxCostMicros>=0&&Number.isSafeInteger(c.maxRequestBytes)&&c.maxRequestBytes>0
export function boundedPricePlan(config:BoundedPriceConfig,keys:string[],now=Date.now()){
 if(!config.revision||!config.principals?.length||!keys.length)throw Error('Reviewed revision required')
 const stages=new Map<string,number>();for(const key of keys){const c=config.contracts[key];if(!c||!valid(c,now))throw Error('Current authoritative stage price contract required');const stage=key.split(':')[0];stages.set(stage,Math.max(stages.get(stage)??0,c.maxCostMicros))}
 const maxCostMicros=[...stages.values()].reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(maxCostMicros))throw Error('Invalid total bound');return{maxCostMicros,expiresAt:new Date(Math.min(now+60000,...keys.map(k=>Date.parse(config.contracts[k]!.expiresAt)))).toISOString()}
}
export async function issueBoundedPrice(config:BoundedPriceConfig,principal:string,body:unknown,keys:string[]){if(!config.principals.includes(principal))throw Error('Scoped price principal required');const plan=boundedPricePlan(config,keys);const q={...plan,id:randomUUID(),principal,digest:requestDigest(body),revision:config.revision};await config.store.save(q);return q}
export async function consumeBoundedPrice(config:BoundedPriceConfig,q:BoundedQuote,principal:string,body:unknown,keys:string[]){
 const plan=boundedPricePlan(config,keys);if(!config.principals.includes(principal)||q.principal!==principal||q.digest!==requestDigest(body)||q.revision!==config.revision||Date.parse(q.expiresAt)<=Date.now()||q.maxCostMicros!==plan.maxCostMicros||!await config.store.consume(q))throw Error('Exact unused reserved quote required')
 const contracts=new Map(keys.map(key=>[key,{...config.contracts[key]!}]));
 let cost=0,unknown=false;const seen=new Set<string>();const boundary:AttemptBoundary={async invoke(input,run){const key=input.stage+':'+input.provider,c=contracts.get(key);try{if(!keys.includes(key)||!c||!valid(c,Date.now())||seen.has(input.stage)||Buffer.byteLength(JSON.stringify(input.request))>c.maxRequestBytes||!c.accepts(input))throw Error('Unqualified exact stage')}catch(e){unknown=true;throw e};seen.add(input.stage);try{const out=await run(),actual=c.actualCostMicros(out,input);if(typeof actual!=='number'||!Number.isSafeInteger(actual)||actual<0||actual>c.maxCostMicros){unknown=true;throw Error('Authoritative stage charge unavailable')};cost+=actual;return out}catch(e){unknown=true;throw e}}}
 return{boundary,async settle(){if(unknown||cost>q.maxCostMicros)throw Error('Unknown stage charge');await config.store.settle(q,cost);return cost},async reconcile(){await config.store.reconcile(q)}}
}
/** Explicit private service-role adapter. Credentials stay server-side. */
export class SupabaseBoundedPriceStore implements BoundedPriceStore {
 private readonly base:string;private readonly headers:Record<string,string>
 constructor(url:string,key:string,private readonly f:typeof fetch=fetch){if(!url||!key)throw Error('Private price ledger required');this.base=url.replace(/\/+$/,'')+'/rest/v1';this.headers={apikey:key,authorization:'Bearer '+key,'content-type':'application/json'}}
 private async call(path:string,method='GET',body?:unknown){const r=await this.f(this.base+path,{method,headers:this.headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});if(!r.ok)throw Error('Price ledger unavailable');const text=await r.text();return text?JSON.parse(text):undefined}
 async save(q:BoundedQuote){await this.call('/inference_price_quotes','POST',{id:q.id,principal:q.principal,digest:q.digest,revision:q.revision,expires_at:q.expiresAt,max_cost_micros:q.maxCostMicros})}
 async get(id:string){if(!/^[a-f0-9-]{36}$/.test(id))return undefined;const rows=await this.call('/inference_price_quotes?id=eq.'+id+'&select=id,principal,digest,revision,expires_at,max_cost_micros');const q=rows?.[0];return q?{id:q.id,principal:q.principal,digest:q.digest,revision:q.revision,expiresAt:q.expires_at,maxCostMicros:Number(q.max_cost_micros)}:undefined}
 async consume(q:BoundedQuote){return await this.call('/rpc/inference_price_consume','POST',{p_id:q.id,p_principal:q.principal,p_digest:q.digest,p_revision:q.revision,p_max:q.maxCostMicros})===true}
 async settle(q:BoundedQuote,costMicros:number){await this.call('/rpc/inference_price_settle','POST',{p_id:q.id,p_cost:costMicros})}
 async reconcile(q:BoundedQuote){await this.call('/inference_price_quotes?id=eq.'+q.id+'&state=eq.reserved','PATCH',{state:'reconcile'})}
}
