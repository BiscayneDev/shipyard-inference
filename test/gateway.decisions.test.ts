import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import type { GatewayConfig, GuardrailResult } from '../src/gateway/index.js'
import { createStubDecisionProvider } from '../src/decisions/index.js'
import type { DecisionProvider, DecisionRequest, DecisionResponse } from '../src/decisions/types.js'
import { candidate, model, staticProvider } from './helpers.js'

// The /v1/decisions product surface and the observe-only guardrail hook.

function baseAppConfig(over: Partial<GatewayConfig> = {}): GatewayConfig {
  return {
    candidates: [candidate('chat', staticProvider('hello there'), [model('chat-model')])],
    apiKeys: ['k'],
    ...over,
  }
}

const DECISION_BODY = {
  state: 'Hi, my Stripe connect keeps failing and I am losing sales.',
  questions: {
    urgency: { type: 'noul', instructions: 'Does this message express urgency?' },
    team: {
      type: 'choice',
      instructions: 'Which team should handle this',
      criteria: { billing: 'Payment issues', technical: 'Bugs or integration problems' },
    },
    anger: {
      type: 'score',
      instructions: 'How frustrated is the customer',
      criteria: ['Calm', 'Frustrated but civil', 'Very angry'],
    },
  },
}

async function postDecisions(app: ReturnType<typeof createGatewayApp>, body: unknown, auth = true): Promise<Response> {
  return app.request('/v1/decisions', {
    method: 'POST',
    headers: {
      ...(auth ? { authorization: 'Bearer k' } : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

test('GET /v1/models advertises the decision model alongside chat models', async () => {
  const app = createGatewayApp(baseAppConfig({ decisions: { provider: createStubDecisionProvider() } }))
  const res = await app.request('/v1/models', { headers: { authorization: 'Bearer k' } })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { data: Array<{ id: string; owned_by: string }> }
  const ids = body.data.map((m) => m.id)
  assert.ok(ids.includes('chat-model'))
  assert.ok(ids.includes('stub-latest'))
  const stub = body.data.find((m) => m.id === 'stub-latest')!
  assert.equal(stub.owned_by, 'stub')
})

test('POST /v1/decisions returns typed answers through the stub backend', async () => {
  const stub = createStubDecisionProvider()
  const app = createGatewayApp(baseAppConfig({ decisions: { provider: stub } }))
  const res = await postDecisions(app, DECISION_BODY)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('x-shipyard-model'), 'stub-latest')
  assert.equal(res.headers.get('x-shipyard-provider'), 'stub')
  const body = (await res.json()) as {
    model: string
    answers: Record<string, { type: string }>
    usage: { inputTokens: number; outputTokens: number }
  }
  assert.equal(body.model, 'stub-latest')
  assert.deepEqual(Object.keys(body.answers).sort(), ['anger', 'team', 'urgency'])
  assert.equal(body.usage.outputTokens, 3)
  assert.ok(body.usage.inputTokens > 0)
  assert.equal(stub.calls.length, 1)
  assert.equal(stub.calls[0]!.state, DECISION_BODY.state)
})

test('POST /v1/decisions requires auth when api keys are set', async () => {
  const app = createGatewayApp(baseAppConfig({ decisions: { provider: createStubDecisionProvider() } }))
  const res = await postDecisions(app, DECISION_BODY, false)
  assert.equal(res.status, 401)
})

test('POST /v1/decisions validates the request body', async () => {
  const app = createGatewayApp(baseAppConfig({ decisions: { provider: createStubDecisionProvider() } }))

  const noState = await postDecisions(app, { questions: DECISION_BODY.questions })
  assert.equal(noState.status, 400)

  const noQuestions = await postDecisions(app, { state: 'x' })
  assert.equal(noQuestions.status, 400)

  const badQuestion = await postDecisions(app, {
    state: 'x',
    questions: { q: { type: 'essay', instructions: 'write me an essay' } },
  })
  assert.equal(badQuestion.status, 400)

  const badJson = await app.request('/v1/decisions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: '{nope',
  })
  assert.equal(badJson.status, 400)
})

test('POST /v1/decisions 404s when the route is not configured', async () => {
  const app = createGatewayApp(baseAppConfig())
  const res = await postDecisions(app, DECISION_BODY)
  assert.equal(res.status, 404)
})

test('POST /v1/decisions surfaces backend failure as 502', async () => {
  const broken: DecisionProvider = {
    id: 'broken',
    async decide() {
      throw new Error('jev unreachable')
    },
  }
  const app = createGatewayApp(baseAppConfig({ decisions: { provider: broken } }))
  const res = await postDecisions(app, DECISION_BODY)
  assert.equal(res.status, 502)
  const body = (await res.json()) as { error: { message: string } }
  assert.match(body.error.message, /jev unreachable/)
})

test('guardrails evaluate a completed (non-streaming) chat completion', async () => {
  const results: GuardrailResult[] = []
  const judge = createStubDecisionProvider()
  const app = createGatewayApp({
    candidates: [candidate('chat', staticProvider('here is your answer'), [model('chat-model')])],
    apiKeys: ['k'],
    guardrails: { provider: judge, onResult: (r) => results.push(r) },
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'give me an answer' }] }),
  })
  assert.equal(res.status, 200)

  const deadline = Date.now() + 2000
  while (results.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20))
  assert.equal(results.length, 1)
  assert.equal(results[0]!.model, 'chat-model')
  assert.equal(results[0]!.unsafe, 0.5) // stub: total uncertainty
  assert.equal(results[0]!.quality, 0.5) // stub: ladder midpoint 1.0 / 2
  assert.equal(results[0]!.flagged, false)
  assert.equal(judge.calls.length, 1)
})

test('guardrails flag unsafe output per threshold', async () => {
  const results: GuardrailResult[] = []
  const harsh: DecisionProvider = {
    id: 'harsh-judge',
    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      const answers: DecisionResponse['answers'] = {}
      for (const [id, q] of Object.entries(req.questions)) {
        answers[id] =
          q.type === 'noul'
            ? { type: 'noul', noul: 0.95 } // clearly unsafe
            : { type: 'score', score: 0, legend: {}, probabilities: {}, confidence: 1 } // worst level
      }
      return { model: 'harsh', answers }
    },
  }
  const app = createGatewayApp({
    candidates: [candidate('chat', staticProvider('bad stuff'), [model('chat-model')])],
    apiKeys: ['k'],
    guardrails: { provider: harsh, onResult: (r) => results.push(r) },
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'something' }] }),
  })
  assert.equal(res.status, 200)

  const deadline = Date.now() + 2000
  while (results.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20))
  assert.equal(results.length, 1)
  assert.equal(results[0]!.unsafe, 0.95)
  assert.equal(results[0]!.quality, 0)
  assert.equal(results[0]!.flagged, true)
})

test('guardrails never break the request when the judge fails', async () => {
  const broken: DecisionProvider = {
    id: 'broken-judge',
    async decide() {
      throw new Error('judge down')
    },
  }
  const app = createGatewayApp({
    candidates: [candidate('chat', staticProvider('still works'), [model('chat-model')])],
    apiKeys: ['k'],
    guardrails: { provider: broken },
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  assert.equal(body.choices[0]!.message.content, 'still works')
})

test('guardrail failure in streaming path is silent too', async () => {
  const broken: DecisionProvider = {
    id: 'broken-judge',
    async decide() {
      throw new Error('judge down')
    },
  }
  const app = createGatewayApp({
    candidates: [candidate('chat', staticProvider('streamed fine'), [model('chat-model')])],
    apiKeys: ['k'],
    guardrails: { provider: broken },
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', stream: true, messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200)
  const text = await res.text()
  assert.match(text, /streamed fine/)
  assert.match(text, /\[DONE\]/)
})
