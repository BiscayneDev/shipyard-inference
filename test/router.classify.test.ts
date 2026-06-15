import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Router, MemoryUsageRecorder } from '../src/index.js'
import type { RouterEvent } from '../src/index.js'
import { candidate, chatParams, model, mockProvider, staticProvider } from './helpers.js'

type Classified = Extract<RouterEvent, { type: 'classified' }>
type Completed = Extract<RouterEvent, { type: 'request_completed' }>

const codingTools = [{ name: 'read_file', description: '', inputSchema: {} }]

test('emits a classified event once per request with the ad signal', async () => {
  const events: RouterEvent[] = []
  const router = new Router({
    candidates: [candidate('c', staticProvider('ok'), [model('m')])],
    onEvent: (e) => events.push(e),
  })

  await router.chat(chatParams({ tools: codingTools }))

  const classified = events.filter((e) => e.type === 'classified') as Classified[]
  assert.equal(classified.length, 1)
  assert.equal(classified[0]?.loopCategory, 'coding')
  assert.equal(classified[0]?.loopTier, 'long')
  assert.equal(classified[0]?.autoRouted, false)
})

test('request_completed carries the loop category/tier', async () => {
  const events: RouterEvent[] = []
  const router = new Router({
    candidates: [candidate('c', staticProvider('ok'), [model('m')])],
    onEvent: (e) => events.push(e),
  })

  await router.chat(chatParams({ tools: codingTools }))

  const done = events.find((e) => e.type === 'request_completed') as Completed | undefined
  assert.equal(done?.loopCategory, 'coding')
  assert.equal(done?.loopTier, 'long')
})

test('autoRoute off (default): the request the provider sees is untouched', async () => {
  const provider = mockProvider(() => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' }))
  const router = new Router({ candidates: [candidate('c', provider, [model('m')])] })

  await router.chat(chatParams({ tools: codingTools }))

  assert.equal(provider.calls[0]?.routingHints, undefined)
})

test('autoRoute on: derived hints are applied, caller hints still win', async () => {
  const provider = mockProvider(() => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' }))
  const router = new Router({
    // A frontier-tier model so both the derived `standard` floor and an explicit
    // `frontier` floor stay capable.
    candidates: [candidate('c', provider, [model('m', { tier: 'frontier' })])],
    autoRoute: true,
  })

  await router.chat(chatParams({ tools: codingTools }))
  // Coding loop → derived standard floor applied.
  assert.equal(provider.calls[0]?.routingHints?.tier, 'standard')

  await router.chat(chatParams({ tools: codingTools, routingHints: { tier: 'frontier' } }))
  // Caller's explicit frontier wins over the derived standard.
  assert.equal(provider.calls[1]?.routingHints?.tier, 'frontier')
})

test('MemoryUsageRecorder aggregates per loop category', async () => {
  const recorder = new MemoryUsageRecorder()
  const router = new Router({
    candidates: [candidate('c', staticProvider('ok'), [model('m')])],
    usageRecorder: recorder,
  })

  await router.chat(chatParams({ tools: codingTools })) // coding
  await router.chat(chatParams()) // chat

  const totals = recorder.totals()
  assert.equal(totals.perCategory['coding']?.requests, 1)
  assert.equal(totals.perCategory['chat']?.requests, 1)
  assert.ok((totals.perCategory['coding']?.latencyMs ?? -1) >= 0)
})
