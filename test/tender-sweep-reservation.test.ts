import {test} from 'node:test'
import assert from 'node:assert/strict'
import {CreditLedger} from '../src/tender/ledger.js'
import {sweepCredits} from '../src/tender/settle.js'
function funded(){const l=new CreditLedger(); l.creditInference('fictional-wallet',1,{requestId:'fictional',placementId:'fictional'},0); return l}
test('parallel SDK sweeps reserve once, preserving credits arriving during transfer',async()=>{
 const l=funded();let calls=0; let release!:()=>void
 const barrier=new Promise<void>(r=>release=r)
 const deps={treasury:'fictional',settle:async()=>{calls++;await barrier;return{signature:'fictional'}}}
 const a=sweepCredits(l,'fictional-wallet',deps)
 const b=await sweepCredits(l,'fictional-wallet',deps)
 assert.equal(b,null);assert.equal(calls,1)
 l.creditInference('fictional-wallet',0.5,{requestId:'new',placementId:'fictional'},1)
 release();await a
 assert.equal(l.balance('fictional-wallet'),0.5)
 assert.equal(l.sweepState('fictional-wallet')?.state,'paid')
})
test('unknown settlement failure is retained and cannot automatically retry',async()=>{
 const l=funded();let calls=0
 const deps={treasury:'fictional',settle:async()=>{calls++;throw Error('unknown outcome')}}
 await assert.rejects(sweepCredits(l,'fictional-wallet',deps))
 assert.equal(await sweepCredits(l,'fictional-wallet',deps),null)
 assert.equal(calls,1);assert.equal(l.sweepState('fictional-wallet')?.state,'pending');assert.equal(l.balance('fictional-wallet'),0)
})
