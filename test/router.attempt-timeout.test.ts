import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Router } from '../src/router/router.js'
import { candidate, chatParams, model, staticProvider } from './helpers.js'
import type { LLMProvider } from '../src/types.js'

function hanging(): LLMProvider & { aborted: number; calls: number } {
  return { aborted: 0, calls: 0, chat(_params, opts) {
    this.calls++
    opts?.signal?.addEventListener('abort', () => { this.aborted++ }, { once: true })
    return new Promise(() => {})
  } }
}
test('timeout aborts slow model and fails over within tier and allowlist, without retrying it', async () => {
 const slow = hanging()
 const wrong = staticProvider('wrong')
 const events: string[] = []
 const router = new Router({ candidates: [
   candidate('hop', slow, [model('slow', {tier:'frontier',inputCostPerMTok:1,outputCostPerMTok:1}),model('slow2', {tier:'frontier',inputCostPerMTok:2,outputCostPerMTok:2})]),
   candidate('elsewhere', wrong,[model('cheap',{tier:'frontier',inputCostPerMTok:0,outputCostPerMTok:0})]),
   candidate('hop', staticProvider('ok'),[model('fallback',{tier:'frontier',inputCostPerMTok:3,outputCostPerMTok:3})]),
 ], retry:{maxRetries:3},onEvent:e=>events.push(e.type) })
 const result=await router.chat(chatParams({routingHints:{tier:'frontier',providers:['hop'],attemptTimeoutMs:15}}))
 assert.equal(result.content,'ok');assert.equal(slow.calls,2);assert.equal(slow.aborted,2)
 assert.equal((wrong as {calls:unknown[]}).calls.length,0);assert.ok(events.includes('failover'));assert.ok(!events.includes('retry'))
})
test('caller abort never starts fallback', async()=>{
 const slow=hanging(), fallback=staticProvider('unused'), controller=new AbortController()
 const router=new Router({candidates:[candidate('a',slow,[model('a')]),candidate('b',fallback,[model('b',{inputCostPerMTok:100})])],attemptTimeoutMs:500})
 const promise=router.chat(chatParams(),{signal:controller.signal})
 setTimeout(()=>controller.abort(new Error('caller gone')),10)
 await assert.rejects(promise,/caller gone/);assert.equal(slow.aborted,1);assert.equal((fallback as {calls:unknown[]}).calls.length,0)
})
test('default has no timeout; pinned request does not fall back on budget', async()=>{
 const provider=staticProvider('pinned')
 const router=new Router({candidates:[candidate('a',provider,[model('a')])],attemptTimeoutMs:1})
 assert.equal((await router.chat(chatParams({routingHints:{pin:{provider:'a',model:'a'}}}))).content,'pinned')
})

test('already aborted caller does not invoke any provider',async()=>{
 const provider=staticProvider('unused'), controller=new AbortController();controller.abort(new Error('gone'))
 const router=new Router({candidates:[candidate('a',provider,[model('a')])]})
 await assert.rejects(router.chat(chatParams(),{signal:controller.signal}),/gone/)
 assert.equal((provider as {calls:unknown[]}).calls.length,0)
})
test('pinned slow request ignores attempt timeout but honors caller abort',async()=>{
 const slow=hanging(), controller=new AbortController()
 const router=new Router({candidates:[candidate('a',slow,[model('a')])],attemptTimeoutMs:1})
 const promise=router.chat(chatParams({routingHints:{pin:{provider:'a',model:'a'}}}),{signal:controller.signal})
 setTimeout(()=>controller.abort(new Error('gone')),15)
 await assert.rejects(promise,/gone/);assert.equal(slow.aborted,1)
})
