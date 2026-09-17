import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTypeSafeProvider, TypeSafeError, createStubDecisionProvider } from '../src/decisions/index.js'
import type { DecisionResponse } from '../src/decisions/index.js'

// The decisions module: the DecisionProvider interface plus the two
// implementations — the offline stub (deterministic neutral answers) and the
// TypeSafe/Jev REST provider (verified against the documented wire format).

const SAMPLE_WIRE_RESPONSE = {
  model: 'jev-latest',
  answers: {
    department: {
      type: 'choice',
      choice: 'billing',
      probabilities: { billing: 0.84, technical: 0.159, sales: 0.001 },
      confidence: 0.596,
    },
    frustration: {
      type: 'score',
      score: 1.035,
      legend: { '0': 'Calm', '1': 'Frustrated but civil', '2': 'Very angry' },
      probabilities: { '0': 0.1, '1': 0.8, '2': 0.1 },
      confidence: 0.842,
    },
    is_urgent: { type: 'noul', noul: 0.999 },
  },
  usage: { input_tokens: 312, output_tokens: 48 },
}

test('stub provider returns neutral typed answers and records calls', async () => {
  const stub = createStubDecisionProvider()
  const res = await stub.decide({
    state: 'customer is angry',
    questions: {
      department: {
        type: 'choice',
        instructions: 'Which team?',
        criteria: { billing: 'payments', technical: 'bugs' },
      },
      anger: {
        type: 'score',
        instructions: 'How angry?',
        criteria: ['calm', 'annoyed', 'furious'],
      },
      urgent: { type: 'noul', instructions: 'Is it urgent?' },
    },
  })
  assert.equal(res.answers['department']?.type, 'choice')
  const dept = res.answers['department']
  assert.equal(dept.type === 'choice' && dept.choice, 'billing') // first option
  const anger = res.answers['anger']
  assert.equal(anger.type === 'score' && anger.score, 1) // midpoint of 3 levels
  const urgent = res.answers['urgent']
  assert.equal(urgent.type === 'noul' && urgent.noul, 0.5) // total uncertainty
  assert.equal(stub.calls.length, 1)
  assert.equal(res.usage?.inputTokens, 5) // 20-char state / 4
})

test('typeSafe provider posts the documented wire format', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify(SAMPLE_WIRE_RESPONSE), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  const provider = createTypeSafeProvider({ apiKey: 'tsk-test', fetch: fetchMock })
  const res = await provider.decide({
    state: 'stripe connect failing for 3 days',
    questions: {
      department: {
        type: 'choice',
        instructions: 'Which team should handle this',
        criteria: {
          billing: 'Payment or subscription issues',
          technical: 'Bugs or integration problems',
          sales: 'Pricing or account questions',
        },
      },
      is_urgent: { type: 'noul', instructions: 'Does this message express urgency?' },
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.url, 'https://api.typesafe.ai/v1/systemone')
  const auth = (calls[0]!.init.headers as Record<string, string>)['authorization']
  assert.equal(auth, 'Bearer tsk-test')
  const sent = JSON.parse(String(calls[0]!.init.body)) as {
    model: string
    state: unknown
    questions: Record<string, { type: string; criteria?: unknown }>
  }
  assert.equal(sent.model, 'jev-latest')
  assert.equal(sent.state, 'stripe connect failing for 3 days')
  assert.equal(sent.questions['department']!.type, 'choice')
  assert.equal(sent.questions['is_urgent']!.type, 'noul')

  assert.equal(res.model, 'jev-latest')
  const dept = res.answers['department']
  assert.equal(dept.type === 'choice' && dept.choice, 'billing')
  assert.equal(dept.type === 'choice' && dept.confidence, 0.596)
  const urg = res.answers['is_urgent']
  assert.equal(urg.type === 'noul' && urg.noul, 0.999)
  assert.deepEqual(res.usage, { inputTokens: 312, outputTokens: 48 })
})

test('typeSafe provider surfaces API errors with status', async () => {
  const fetchMock = (async () =>
    new Response(JSON.stringify({ error: 'invalid api key' }), { status: 401 })) as typeof fetch
  const provider = createTypeSafeProvider({ apiKey: 'bad', fetch: fetchMock })
  await assert.rejects(provider.decide({ state: 'x', questions: { a: { type: 'noul', instructions: 'x?' } } }), (err: unknown) => {
    assert.ok(err instanceof TypeSafeError)
    assert.equal((err as TypeSafeError).status, 401)
    return true
  })
})

test('typeSafe provider times out with TypeSafeError', async () => {
  const fetchMock = (async (_url: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  }) as typeof fetch
  const provider = createTypeSafeProvider({ apiKey: 'k', fetch: fetchMock, timeoutMs: 20 })
  await assert.rejects(
    provider.decide({ state: 'x', questions: { a: { type: 'noul', instructions: 'x?' } } }),
    TypeSafeError,
  )
})

test('typeSafe provider rejects bodies without answers', async () => {
  const fetchMock = (async () => new Response('{"model":"jev-latest"}', { status: 200 })) as typeof fetch
  const provider = createTypeSafeProvider({ apiKey: 'k', fetch: fetchMock })
  await assert.rejects(
    provider.decide({ state: 'x', questions: { a: { type: 'noul', instructions: 'x?' } } }),
    /missing `answers`/,
  )
})

test('scripted stub handler passes through for tests', async () => {
  const provider = createStubDecisionProvider({
    handler: () => ({ model: 'x', answers: { q: { type: 'noul', noul: 0.95 } } }) as DecisionResponse,
  })
  const res = await provider.decide({ state: 's', questions: { q: { type: 'noul', instructions: 'i' } } })
  assert.equal(res.answers['q']?.type === 'noul' && res.answers['q'].noul, 0.95)
})
