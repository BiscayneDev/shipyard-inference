import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Router,
  costOptimized,
  computeActualCostUsd,
  computeBaselineCostUsd,
  MemoryUsageRecorder,
  type LLMProvider,
  type ModelMetadata,
  type RouterEvent,
} from '../src/index.js'
import { candidate, chatParams, model } from './helpers.js'

// A provider that returns usage with cache reads, so cost math is exercised.
function providerWithUsage(): LLMProvider {
  return {
    async chat() {
      return {
        content: 'ok',
        toolCalls: [],
        stopReason: 'end_turn' as const,
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          cacheReadTokens: 1_000_000,
        },
      }
    },
  }
}

const priced = (over: Partial<ModelMetadata> = {}): ModelMetadata =>
  model('m', { inputCostPerMTok: 10, outputCostPerMTok: 30, ...over })

test('computeActualCostUsd credits cache reads/writes at discounted rates', () => {
  const meta = priced() // input 10, output 30 per MTok → cacheRead 1.0, cacheWrite 12.5 (defaults)
  const cost = computeActualCostUsd(meta, {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheReadTokens: 1_000_000,
    cacheWriteTokens: 1_000_000,
  })
  // 10 (input) + 1.0 (cache read = 0.1×) + 12.5 (cache write = 1.25×) + 30 (output)
  assert.equal(cost, 53.5)
})

test('explicit cache rates override the defaults', () => {
  const meta = priced({ cacheReadCostPerMTok: 5, cacheWriteCostPerMTok: 0 })
  const cost = computeActualCostUsd(meta, {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 1_000_000,
    cacheWriteTokens: 1_000_000,
  })
  assert.equal(cost, 5)
})

test('computeBaselineCostUsd bills all prompt tokens at the full input rate (no cache)', () => {
  const meta = priced() // input 10, output 30
  const usage = {
    inputTokens: 200_000,
    outputTokens: 1_000_000,
    cacheReadTokens: 700_000,
    cacheWriteTokens: 100_000,
  }
  // total prompt = 1,000,000 → 10 (input) + 30 (output)
  assert.equal(computeBaselineCostUsd(meta, usage), 40)
})

test('savings = baseline (premium, uncached) − actual (routed + cached); recorded per user', async () => {
  // Routed model is cheap (input 1 / output 1); baseline is premium (input 10 / output 30).
  const cheap = candidate('cheap', providerWithUsage(), [
    model('cheap', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
  ])

  const recorder = new MemoryUsageRecorder()
  const events: RouterEvent[] = []
  const router = new Router({
    candidates: [cheap],
    strategy: costOptimized(),
    baselineModel: 'premium',
    pricingOverrides: { premium: { inputCostPerMTok: 10, outputCostPerMTok: 30 } },
    usageRecorder: recorder,
    onEvent: (e) => events.push(e),
  })

  await router.chat({ ...chatParams(), metadata: { userId: 'alice' } })

  const done = events.find((e) => e.type === 'request_completed')
  assert.ok(done && done.type === 'request_completed')
  // usage from the stub: input 1M, output 1M, cacheRead 1M (see providerWithUsage)
  // actual on cheap: 1 (input) + 0.1 (cache read 0.1×1) + 1 (output) = 2.1
  // baseline on premium: total prompt 2M × 10 + 1M × 30 = 50
  assert.ok(Math.abs((done.actualCostUsd ?? 0) - 2.1) < 1e-9)
  assert.equal(done.baselineCostUsd, 50)
  assert.ok(Math.abs((done.savedUsd ?? 0) - 47.9) < 1e-9)
  assert.equal(done.userId, 'alice')

  const totals = recorder.totals()
  assert.equal(totals.requests, 1)
  assert.ok(Math.abs(totals.savedUsd - 47.9) < 1e-9)
  assert.ok(totals.perUser['alice'])
  assert.ok(Math.abs(totals.perUser['alice']!.savedUsd - 47.9) < 1e-9)
})

test('no baselineModel → no savings claim (baseline/saved undefined)', async () => {
  const cheap = candidate('cheap', providerWithUsage(), [
    model('cheap', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
  ])
  const events: RouterEvent[] = []
  const router = new Router({ candidates: [cheap], onEvent: (e) => events.push(e) })
  await router.chat(chatParams())
  const done = events.find((e) => e.type === 'request_completed')
  assert.ok(done && done.type === 'request_completed')
  assert.equal(done.baselineCostUsd, undefined)
  assert.equal(done.savedUsd, undefined)
})
