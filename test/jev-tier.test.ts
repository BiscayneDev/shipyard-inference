import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createJevTierInferrer, inferTier } from '../src/router/index.js'
import { Router } from '../src/router/index.js'
import { createStubDecisionProvider } from '../src/decisions/index.js'
import type { DecisionProvider, DecisionRequest, DecisionResponse } from '../src/decisions/types.js'
import type { ModelTier } from '../src/router/candidates.js'
import { candidate, model, mockProvider, chatParams } from './helpers.js'

// createJevTierInferrer: content-aware autoTier that asks a decision model
// which quality tier a request needs, safely layered over the structural
// heuristics (fallback on error/timeout/low-confidence; 'max' combine).

function answering(tier: ModelTier, opts: { noul?: number; confidence?: number } = {}): DecisionProvider {
  return {
    id: 'scripted',
    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      const answers: DecisionResponse['answers'] = {}
      for (const [id, q] of Object.entries(req.questions)) {
        if (q.type === 'choice') {
          answers[id] = {
            type: 'choice',
            choice: tier,
            probabilities: { [tier]: 1 },
            confidence: opts.confidence ?? 0.9,
          }
        } else {
          answers[id] = { type: 'noul', noul: opts.noul ?? 0.3 }
        }
      }
      return { model: 'scripted', answers }
    },
  }
}

const simple = chatParams({ messages: [{ role: 'user', content: 'hi' }] })
const bigPrompt = chatParams({
  messages: [{ role: 'user', content: 'a'.repeat(80_000) }], // > 16000 tokens → frontier
})

test('jev tier routes a simple prompt up when Jev judges it hard', async () => {
  const inferrer = createJevTierInferrer({ provider: answering('frontier') })
  assert.equal((await inferrer(simple)).tier, 'frontier')
})

test("'max' combine: structural floor wins when Jev underestimates a big prompt", async () => {
  const inferrer = createJevTierInferrer({ provider: answering('economy') })
  assert.equal((await inferrer(bigPrompt)).tier, 'frontier')
  assert.equal(inferTier(bigPrompt), 'frontier') // sanity: floor is structural
})

test("'jev' combine trusts Jev over the structural signal", async () => {
  const inferrer = createJevTierInferrer({ provider: answering('economy'), combine: 'jev' })
  assert.equal((await inferrer(bigPrompt)).tier, 'economy')
})

test('a strong needs_reasoning signal floors economy at standard', async () => {
  const inferrer = createJevTierInferrer({ provider: answering('economy', { noul: 0.9 }) })
  assert.equal((await inferrer(simple)).tier, 'standard')
})

test('provider failure falls back to the structural tier', async () => {
  const broken: DecisionProvider = {
    id: 'broken',
    async decide() {
      throw new Error('backend down')
    },
  }
  const onResults: Array<{ tier: ModelTier; fallback: boolean }> = []
  const inferrer = createJevTierInferrer({
    provider: broken,
    onResult: (r) => onResults.push({ tier: r.tier, fallback: r.fallback }),
  })
  assert.equal((await inferrer(simple)).tier, 'economy')
  assert.equal((await inferrer(bigPrompt)).tier, 'frontier')
  assert.ok(onResults.every((r) => r.fallback))
})

test('timeout falls back to the structural tier', async () => {
  const hanging: DecisionProvider = {
    id: 'hanging',
    decide: () => new Promise<DecisionResponse>(() => {}),
  }
  const inferrer = createJevTierInferrer({ provider: hanging, timeoutMs: 20 })
  assert.equal((await inferrer(simple)).tier, 'economy')
})

test('low-confidence Jev answer falls back to the structural tier', async () => {
  const inferrer = createJevTierInferrer({ provider: answering('frontier', { confidence: 0.1 }), minConfidence: 0.5 })
  assert.equal((await inferrer(simple)).tier, 'economy')
})

test('async autoTier works through the Router: Jev judgment picks the frontier model', async () => {
  const premium = mockProvider(async () => ({ content: 'premium', toolCalls: [], stopReason: 'end_turn' as const }))
  const cheap = mockProvider(async () => ({ content: 'cheap', toolCalls: [], stopReason: 'end_turn' as const }))
  const router = new Router({
    candidates: [
      candidate('premium', premium, [model('frontier-model', { inputCostPerMTok: 10, outputCostPerMTok: 10, tier: 'frontier' })]),
      candidate('cheap', cheap, [model('economy-model', { inputCostPerMTok: 0.1, outputCostPerMTok: 0.1, tier: 'economy' })]),
    ],
    autoTier: createJevTierInferrer({ provider: answering('frontier') }),
  })
  const res = await router.chat(simple)
  assert.equal(res.content, 'premium')
  assert.equal(cheap.calls.length, 0)

  const cheapRouter = new Router({
    candidates: [
      candidate('premium', premium, [model('frontier-model', { inputCostPerMTok: 10, outputCostPerMTok: 10, tier: 'frontier' })]),
      candidate('cheap', cheap, [model('economy-model', { inputCostPerMTok: 0.1, outputCostPerMTok: 0.1, tier: 'economy' })]),
    ],
    autoTier: createJevTierInferrer({ provider: answering('economy') }),
  })
  const res2 = await cheapRouter.chat(simple)
  assert.equal(res2.content, 'cheap')
})

test('explicit routingHints.tier still overrides the inferrer', async () => {
  let decided = 0
  const counting: DecisionProvider = {
    id: 'counting',
    async decide(req) {
      decided++
      return answering('frontier').decide(req)
    },
  }
  const premium = mockProvider(async () => ({ content: 'premium', toolCalls: [], stopReason: 'end_turn' as const }))
  const cheap = mockProvider(async () => ({ content: 'cheap', toolCalls: [], stopReason: 'end_turn' as const }))
  const router = new Router({
    candidates: [
      candidate('premium', premium, [model('frontier-model', { inputCostPerMTok: 10, outputCostPerMTok: 10, tier: 'frontier' })]),
      candidate('cheap', cheap, [model('economy-model', { inputCostPerMTok: 0.1, outputCostPerMTok: 0.1, tier: 'economy' })]),
    ],
    autoTier: createJevTierInferrer({ provider: counting }),
  })
  const res = await router.chat({ ...simple, routingHints: { tier: 'economy' } })
  assert.equal(res.content, 'cheap')
  assert.equal(decided, 0) // never even consulted
})

test('stub provider as Jev backend yields the structural tier (offline dev path)', async () => {
  const inferrer = createJevTierInferrer({ provider: createStubDecisionProvider() })
  assert.equal((await inferrer(simple)).tier, 'economy')
  assert.equal((await inferrer(bigPrompt)).tier, 'frontier')
})

test('rich decision evidence flows through the Router as a tier_decided event', async () => {
  const events: Array<Record<string, unknown>> = []
  const provider = answering('standard')
  const premium = mockProvider(async () => ({ content: 'premium', toolCalls: [], stopReason: 'end_turn' as const }))
  const cheap = mockProvider(async () => ({ content: 'cheap', toolCalls: [], stopReason: 'end_turn' as const }))
  const router = new Router({
    candidates: [
      candidate('premium', premium, [model('frontier-model', { inputCostPerMTok: 10, outputCostPerMTok: 10, tier: 'frontier' })]),
      candidate('cheap', cheap, [model('economy-model', { inputCostPerMTok: 0.1, outputCostPerMTok: 0.1, tier: 'economy' })]),
    ],
    autoTier: createJevTierInferrer({ provider }),
    onEvent: (e) => {
      if (e.type === 'tier_decided') events.push(e as unknown as Record<string, unknown>)
    },
  })
  const res = await router.chat(simple)
  assert.equal(res.content, 'premium') // standard cleared the frontier model
  assert.equal(events.length, 1)
  const ev = events[0]!
  assert.equal(ev['type'], 'tier_decided')
  assert.equal(ev['source'], 'jev')
  assert.equal(ev['tier'], 'standard')
  assert.equal(ev['structuralTier'], 'economy')
  assert.equal(typeof ev['latencyMs'], 'number')
})
