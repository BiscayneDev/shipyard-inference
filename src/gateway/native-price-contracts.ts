import type{StagePriceContract}from'./bounded-price.js'
const integer=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0
/** Native TypeSafe only, no long-context header, fixed rate reviewed from official
 * docs. Do not apply this to OpenRouter/Vercel/chain without exact native binding.
 * Full 64k context is reserved instead of guessing a UTF-8/token ratio.
 */
export function nativeJevPriceContract(input:{providerId:string;expiresAt:string;nativeAdapterVerified:boolean}):StagePriceContract{
 if(!input.nativeAdapterVerified||!input.providerId||!Number.isFinite(Date.parse(input.expiresAt)))throw Error('Exact native adapter binding required')
 return{evidence:'https://docs.typesafe.ai/models',expiresAt:input.expiresAt,maxCostMicros:2688,maxRequestBytes:170000,singleAttempt:true,noHiddenCharges:true,
  accepts:attempt=>attempt.provider===input.providerId&&['tier','guardrail'].includes(attempt.stage)&&!(attempt.request as{model?:string})?.model?.includes('preview'),
  actualCostMicros:output=>{const value=output as{model?:string;provider?:string;usage?:{inputTokens?:number;outputTokens?:number}};const u=value?.usage;if(!['jev-1.14.0','jev-1.13.0'].includes(value.model??'')||value.provider&&value.provider!=='typesafe'||!u||!integer(u.inputTokens)||!integer(u.outputTokens)||u.inputTokens>64000)return undefined;return Number((BigInt(u.inputTokens)*42n+999n)/1000n)}
 }
}
/** Native Anthropic standard-rate Haiku/Sonnet 4.5 only. The exact adapter must
 * have no beta long-context, priority/residency surcharge, tools hosted by the
 * provider, or custom fetch retries. Existing adapter sends only 5m cache TTL.
 * Rates verified against official model pages; no UsePod/OpenRouter inference.
 */
export function nativeClaude45PriceContract(input:{providerId:string;expiresAt:string;nativeAdapterVerified:boolean}):StagePriceContract{
 if(!input.nativeAdapterVerified||!input.providerId||!Number.isFinite(Date.parse(input.expiresAt)))throw Error('Exact native Anthropic adapter binding required')
 if(Date.parse(input.expiresAt)>=Date.parse('2026-11-30T00:00:00Z'))throw Error('Contract must expire before published Sonnet retirement')
 const rates:Record<string,{input:number;output:number;read:number;write:number}>={
  'claude-haiku-4-5':{input:1000,output:5000,read:100,write:1250},
  'claude-haiku-4-5-20251001':{input:1000,output:5000,read:100,write:1250},
  'claude-sonnet-4-5':{input:3000,output:15000,read:300,write:3750},
  'claude-sonnet-4-5-20250929':{input:3000,output:15000,read:300,write:3750},
 }
 return{evidence:'https://platform.claude.com/docs/en/models/sonnet-4-5/overview https://platform.claude.com/docs/en/models/haiku-4-5/overview',expiresAt:input.expiresAt,maxCostMicros:780720,maxRequestBytes:170000,singleAttempt:true,noHiddenCharges:true,
  accepts:attempt=>{const r=attempt.request as{model?:string;maxTokens?:number;messages?:Array<{images?:unknown}>};return attempt.stage==='coding'&&attempt.provider===input.providerId&&!!rates[r?.model??'']&&integer(r.maxTokens)&&r.maxTokens>0&&r.maxTokens<=2048&&!r.messages?.some(x=>x.images)},
  actualCostMicros:(output,attempt)=>{const request=attempt?.request as{model?:string}|undefined;const rate=rates[request?.model??''];const usage=(output as{usage?:{inputTokens?:number;outputTokens?:number;cacheReadTokens?:number;cacheWriteTokens?:number}})?.usage;if(!rate||!usage||![usage.inputTokens,usage.outputTokens,usage.cacheReadTokens,usage.cacheWriteTokens].every(integer))return undefined;const{inputTokens:a,outputTokens:b,cacheReadTokens:c,cacheWriteTokens:d}=usage as{inputTokens:number;outputTokens:number;cacheReadTokens:number;cacheWriteTokens:number};if(a+c+d>200000||b>2048)return undefined;return Number((BigInt(a)*BigInt(rate.input)+BigInt(b)*BigInt(rate.output)+BigInt(c)*BigInt(rate.read)+BigInt(d)*BigInt(rate.write)+999n)/1000n)}
 }
}
