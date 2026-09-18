import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import type { GatewayConfig, GuardrailResult } from '../src/gateway/index.js'
import { MemoryDecisionFeedback } from '../src/router/index.js'
import { createJevTierInferrer } from '../src/router/index.js'
import type { DecisionProvider, DecisionRequest, DecisionResponse } from '../src/decisions/types.js'
import type { ModelTier } from '../src/router/candidates.js'
import { candidate, model, staticProvider, chatParams } from './helpers.js'

// The judgment loop: Jev decides the tier, guardrails score the output, and
// the feedback recorder joins them per request id into a calibration report.

function answering(tier: ModelTier, quality: number): DecisionProvider {
  let calls = 0
  return {
    id: 'scripted',
    decideCount() {
      return calls
    },
    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      calls++
      const answers: DecisionResponse['answers'] = {}
      for (const [id, q] of Object.entries(req.questions)) {
        if (q.type === 'choice') {
          answers[id] = { type: 'choice', choice: tier, probabilities: { [tier]: 1 }, confidence: 0.9 }
        } else if (q.type === 'noul') {
          answers[id] = { type: 'noul', noul: 0.2 }
        } else {
          answers[id] = { type: 'score', score: quality, probabilities: [1 - quality / 2, quality / 2, 0] }
        }
      }
      return { model: 'scripted', answers }
    },
  } as unknown as DecisionProvider
}

function guardrailAnswering(quality: number): DecisionProvider {
  return {
    id: 'guard-scripted',
    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      const answers: DecisionResponse['answers'] = {}
      for (const [id, q] of Object.entries(req.questions)) {
        if (q.type === 'noul') answers[id] = { type: 'noul', noul: 0.05 }
        else answers[id] = { type: 'score', score: Math.round(quality * 2), probabilities: [0, 0, 1] }
      }
      return { model: 'guard-scripted', answers }
    },
  }
}

function appConfig(provider: DecisionProvider, feedback: MemoryDecisionFeedback, guardProvider?: DecisionProvider): GatewayConfig {
  return {
    candidates: [candidate('chat', staticProvider('a response'), [model('chat-model')])],
    apiKeys: ['k'],
    autoTier: createJevTierInferrer({ provider }),
    guardrails: guardProvider ? { provider: guardProvider } : undefined,
    decisionFeedback: feedback,
  }
}

async function chat(app: ReturnType<typeof createGatewayApp>): Promise<Response> {
  return app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'hello' }] }),
  })
}

test('feedback endpoint 404s when no recorder is configured', async () => {
  const app = createGatewayApp({
    candidates: [candidate('chat', staticProvider('x'), [model('chat-model')])],
    apiKeys: ['k'],
  })
  const res = await app.request('/v1/decisions/feedback')
  assert.equal(res.status, 404)
})

test('joins tier decisions with guardrail outcomes into a per-tier report', async () => {
  const feedback = new MemoryDecisionFeedback()
  const app = createGatewayApp(appConfig(answering('economy', 0.5), feedback, guardrailAnswering(0.4)))
  const res = await chat(app)
  assert.equal(res.status, 200)
  // guardrail evaluation is fire-and-forget — give the microtask queue a beat
  await new Promise((r) => setTimeout(r, 20))

  const report = (await (
    await app.request('/v1/decisions/feedback')
  ).json()) as ReturnType<MemoryDecisionFeedback['report']>
  assert.equal(report.tierDecisions, 1)
  assert.equal(report.joined, 1)
  assert.equal(report.jev.decisions, 1)
  assert.equal(report.jev.fallbacks, 0)
  assert.ok(report.perTier.economy, 'economy tier recorded')
  assert.ok((report.perTier.economy!.avgQuality ?? 0) > 0, 'guardrail quality joined in')
  assert.equal(report.guardrails.evaluations, 1)
})

test('records Jev fallbacks and structural-source decisions', async () => {
  const feedback = new MemoryDecisionFeedback()
  const broken: DecisionProvider = {
    id: 'broken',
    async decide() {
      throw new Error('backend down')
    },
  }
  const app = createGatewayApp(appConfig(broken, feedback))
  await chat(app)
  const report = (await (
    await app.request('/v1/decisions/feedback')
  ).json()) as ReturnType<MemoryDecisionFeedback['report']>
  assert.equal(report.jev.decisions, 0)
  assert.equal(report.jev.fallbacks, 1)
})

test('decision cache: an identical request skips the backend call', async () => {
  const feedback = new MemoryDecisionFeedback()
  const provider = answering('economy', 0.5)
  const inferrer = createJevTierInferrer({ provider, cacheTtlMs: 60_000 })
  const p = chatParams({ messages: [{ role: 'user', content: 'same prompt' }] })
  const first = await inferrer(p)
  const second = await inferrer(p)
  assert.equal(first.cached, undefined)
  assert.equal(second.cached, true)
  assert.equal(second.tier, first.tier)
})

test('decision cache: a different request state misses', async () => {
  const provider = answering('economy', 0.5)
  const inferrer = createJevTierInferrer({ provider, cacheTtlMs: 60_000 })
  await inferrer(chatParams({ messages: [{ role: 'user', content: 'prompt a' }] }))
  const other = await inferrer(chatParams({ messages: [{ role: 'user', content: 'prompt b' }] }))
  assert.equal(other.cached, undefined)
})

test('decision cache: expired entries miss (TTL)', async () => {
  const provider = answering('economy', 0.5)
  const inferrer = createJevTierInferrer({ provider, cacheTtlMs: 5 })
  const p = chatParams({ messages: [{ role: 'user', content: 'ttl prompt' }] })
  await inferrer(p)
  await new Promise((r) => setTimeout(r, 20))
  const again = await inferrer(p)
  assert.equal(again.cached, undefined)
})
