import {test} from 'node:test'
import assert from 'node:assert/strict'
import {OpenAIProvider} from '../src/providers/openai.js'
import {AnthropicProvider} from '../src/providers/anthropic.js'
import {chatParams} from './helpers.js'
for(const Provider of [OpenAIProvider,AnthropicProvider]) test(`${Provider.name} chatOnce disables SDK retries on 503`,async()=>{
 let calls=0
 const provider=new Provider({apiKey:'fictional',fetch:async()=>{calls++;return new Response('{"error":{"message":"fictional failure"}}',{status:503,headers:{'content-type':'application/json'}})}})
 await assert.rejects(provider.chatOnce(chatParams()))
 assert.equal(calls,1)
})
