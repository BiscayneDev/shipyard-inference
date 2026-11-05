/** Hopscotch's own recorded ALL-IN charge, never reconstructed from token prices.
 * Source: https://docs.hopscotchlabs.ai/features/usage-lookup
 * This is settlement evidence only, NOT a pre-dispatch maximum or rate lock.
 */
export interface HopscotchReceipt {
  requestId: string
  model: string
  costMicros: number
  rateRevision: string
}
export function parseHopscotchReceipt(raw: unknown, expected: {requestId:string;model:string}): HopscotchReceipt | undefined {
  const r=raw as {object?:unknown;request_id?:unknown;model?:unknown;outcome?:unknown;served_on_own_key?:unknown;paid_from_allowance?:unknown;charge?:{amount_micros?:unknown;currency?:unknown;rate_revision_id?:unknown}}
  const c=r?.charge
  if(r?.object!=='usage.request'||r.request_id!==expected.requestId||r.model!==expected.model||r.outcome!=='served'||r.served_on_own_key!==false||r.paid_from_allowance!==false||!c||c.currency!=='USD'||typeof c.amount_micros!=='number'||!Number.isSafeInteger(c.amount_micros)||c.amount_micros<0||typeof c.rate_revision_id!=='string'||!c.rate_revision_id.trim())return undefined
  return {requestId:expected.requestId,model:expected.model,costMicros:c.amount_micros,rateRevision:c.rate_revision_id}
}
export function createHopscotchReceiptReader(input:{apiKey:string;fetch?:typeof fetch;pause?:(ms:number)=>Promise<void>}) {
  if(!input.apiKey)throw Error('Existing Hopscotch credential required')
  const f=input.fetch??fetch,pause=input.pause??(ms=>new Promise(r=>setTimeout(r,ms)))
  return async (expected:{requestId:string;model:string}):Promise<HopscotchReceipt|undefined>=>{
    if(!/^[A-Za-z0-9_-]{1,200}$/.test(expected.requestId)||!expected.model)return undefined
    for(let attempt=0;attempt<2;attempt++) {
      try {
        const r=await f('https://api.hopscotchlabs.ai/v1/usage/'+encodeURIComponent(expected.requestId),{headers:{authorization:'Bearer '+input.apiKey},redirect:'error',signal:AbortSignal.timeout(10000)})
        if(r.status===404&&attempt===0){await pause(1000);continue}
        if(!r.ok)return undefined
        return parseHopscotchReceipt(await r.json(),expected)
      }catch{return undefined}
    }
    return undefined
  }
}
