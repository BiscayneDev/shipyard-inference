import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Router, MemoryUsageRecorder } from '../src/index.js'
import type { RouterEvent, UsageInfo } from '../src/index.js'
import { candidate, chatParams, model, mockProvider } from './helpers.js'

function usageProvider(usage: UsageInfo) {
  return mockProvider(() => ({
    content: 'ok',
    toolCalls: [],
    stopReason: 'end_turn',
    usage,
  }))
}

type Completed = Extract<RouterEvent, { type: 'request_completed' }>

test('emits request_completed with actual cost computed from real usage', async () => {
  const events: RouterEvent[] = []
  const router = new Router({
    candidates: [
      candidate('c', usageProvider({ inputTokens: 1_000_000, outputTokens: 1_000_000 }), [
        model('m', { inputCostPerMTok: 3, outputCostPerMTok: 15 }),
      ]),
    ],
    onEvent: (e) => events.push(e),
  })

  await router.chat(chatParams())

  const done = events.find((e) => e.type === 'request_completed') as Completed | undefined
  assert.ok(done, 'request_completed emitted')
  assert.equal(done.actualCostUsd, 18) // 1M*3/1M + 1M*15/1M
  assert.equal(done.usage?.inputTokens, 1_000_000)
  assert.ok((done.latencyMs ?? -1) >= 0)
})

test('MemoryUsageRecorder aggregates totals and per-model breakdown', async () => {
  const recorder = new MemoryUsageRecorder()
  const router = new Router({
    candidates: [
      candidate('c', usageProvider({ inputTokens: 500_000, outputTokens: 500_000 }), [
        model('m', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
      ]),
    ],
    usageRecorder: recorder,
  })

  await router.chat(chatParams())
  await router.chat(chatParams({ system: 'second' }))

  const totals = recorder.totals()
  assert.equal(totals.requests, 2)
  assert.equal(totals.inputTokens, 1_000_000)
  assert.equal(totals.outputTokens, 1_000_000)
  assert.equal(totals.costUsd, 2) // each request: 0.5 + 0.5
  assert.equal(totals.perModel['m']?.requests, 2)
})

test('request_completed flags whether the request was pinned', async () => {
  const events: RouterEvent[] = []
  const router = new Router({
    candidates: [
      candidate('c', usageProvider({ inputTokens: 100, outputTokens: 100 }), [
        model('m', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
      ]),
    ],
    onEvent: (e) => events.push(e),
  })

  await router.chat(chatParams())
  await router.chat(chatParams({ routingHints: { pin: { model: 'm' } } }))

  const done = events.filter((e) => e.type === 'request_completed') as Completed[]
  assert.equal(done[0].pinned, false) // auto-routed
  assert.equal(done[1].pinned, true) // explicitly pinned
})

test('actualCostUsd is undefined for an unpriced model', async () => {
  const events: RouterEvent[] = []
  const router = new Router({
    candidates: [
      candidate('c', usageProvider({ inputTokens: 100, outputTokens: 100 }), [
        model('mystery', { inputCostPerMTok: Infinity, outputCostPerMTok: Infinity }),
      ]),
    ],
    onEvent: (e) => events.push(e),
  })

  await router.chat(chatParams())

  const done = events.find((e) => e.type === 'request_completed') as Completed | undefined
  assert.ok(done)
  assert.equal(done.actualCostUsd, undefined)
})
