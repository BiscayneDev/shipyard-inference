import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inferTier, Router, costOptimized, type RouterEvent } from '../src/index.js'
import { candidate, chatParams, model, staticProvider } from './helpers.js'

const aTool = { name: 't', description: 'a tool', inputSchema: {} }

test('inferTier: short, no tools => economy', () => {
  assert.equal(inferTier(chatParams()), 'economy')
})

test('inferTier: tools present => standard', () => {
  assert.equal(inferTier(chatParams({ tools: [aTool] })), 'standard')
})

test('inferTier: large requested output => frontier', () => {
  assert.equal(inferTier(chatParams({ maxTokens: 8000 })), 'frontier')
})

test('inferTier: large prompt => frontier', () => {
  const big = 'x '.repeat(60_000) // well past the frontier input threshold
  assert.equal(inferTier(chatParams({ messages: [{ role: 'user', content: big }] })), 'frontier')
})

test('Router autoTier floors a tool request to standard (skips cheaper economy)', async () => {
  const econ = candidate('econ', staticProvider('econ'), [
    model('econ-m', { tier: 'economy', outputCostPerMTok: 1 }),
  ])
  const std = candidate('std', staticProvider('std'), [
    model('std-m', { tier: 'standard', outputCostPerMTok: 5 }),
  ])
  const router = new Router({ candidates: [econ, std], strategy: costOptimized(), autoTier: true })

  // Cheaper economy model exists, but a tool request infers a 'standard' floor.
  const res = await router.chat(chatParams({ tools: [aTool] }))
  assert.equal(res.content, 'std')
})

test('explicit routingHints.tier overrides autoTier', async () => {
  const econ = candidate('econ', staticProvider('econ'), [
    model('econ-m', { tier: 'economy', outputCostPerMTok: 1 }),
  ])
  const std = candidate('std', staticProvider('std'), [
    model('std-m', { tier: 'standard', outputCostPerMTok: 5 }),
  ])
  const router = new Router({ candidates: [econ, std], strategy: costOptimized(), autoTier: true })

  // Tools would infer 'standard', but an explicit economy floor lets the cheap one win.
  const res = await router.chat(
    chatParams({ tools: [aTool], routingHints: { tier: 'economy' } }),
  )
  assert.equal(res.content, 'econ')
})

test('autoTier off (default) routes purely by cost', async () => {
  const econ = candidate('econ', staticProvider('econ'), [
    model('econ-m', { tier: 'economy', outputCostPerMTok: 1 }),
  ])
  const std = candidate('std', staticProvider('std'), [
    model('std-m', { tier: 'standard', outputCostPerMTok: 5 }),
  ])
  const events: RouterEvent[] = []
  const router = new Router({ candidates: [econ, std], strategy: costOptimized(), onEvent: (e) => events.push(e) })

  const res = await router.chat(chatParams({ tools: [aTool] }))
  assert.equal(res.content, 'econ') // cheapest wins, no floor
})
