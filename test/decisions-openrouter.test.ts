import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOpenRouterDecisionProvider, OpenRouterDecisionError } from '../src/decisions/index.js'

// OpenRouter-backed Jev: POST https://openrouter.ai/api/alpha/decisions with
// the SAME wire shape as TypeSafe native — verified against the documented
// quick-start request/response.

const OR_RESPONSE = {
  model: '~typesafe/jev-latest',
  answers: {
    is_urgent: { type: 'noul', noul: 0.93 },
    department: {
      type: 'choice',
      choice: 'technical',
      probabilities: { billing: 0.07, technical: 0.9, sales: 0.03 },
      confidence: 0.72,
    },
    frustration: {
      type: 'score',
      score: 1.4,
      legend: { '0': 'Calm', '1': 'Frustrated', '2': 'Very angry' },
      probabilities: { '0': 0.15, '1': 0.7, '2': 0.15 },
      confidence: 0.66,
    },
  },
  usage: { input_tokens: 51, output_tokens: 9 },
}

test('openRouter decisions provider posts the documented wire format', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify(OR_RESPONSE), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  const provider = createOpenRouterDecisionProvider({
    apiKey: 'sk-or-v1-test',
    fetch: fetchMock,
    siteUrl: 'https://shipyard-inference.vercel.app',
    siteTitle: 'Shipyard',
  })
  const res = await provider.decide({
    state: 'Help! My payouts have been failing for 3 days.',
    questions: {
      is_urgent: { type: 'noul', instructions: 'Does this message convey urgency?' },
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.url, 'https://openrouter.ai/api/alpha/decisions')
  const headers = calls[0]!.init.headers as Record<string, string>
  assert.equal(headers['authorization'], 'Bearer sk-or-v1-test')
  assert.equal(headers['http-referer'], 'https://shipyard-inference.vercel.app')
  assert.equal(headers['x-openrouter-title'], 'Shipyard')
  const sent = JSON.parse(String(calls[0]!.init.body)) as { model: string; state: string }
  assert.equal(sent.model, '~typesafe/jev-latest')
  assert.equal(sent.state, 'Help! My payouts have been failing for 3 days.')

  assert.equal(res.model, '~typesafe/jev-latest')
  const urg = res.answers['is_urgent']
  assert.equal(urg.type === 'noul' && urg.noul, 0.93)
  const dept = res.answers['department']
  assert.equal(dept.type === 'choice' && dept.choice, 'technical')
  assert.deepEqual(res.usage, { inputTokens: 51, outputTokens: 9 })
})

test('openRouter provider allows a pinned model id', async () => {
  const calls: Array<RequestInit> = []
  const fetchMock = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init ?? {})
    return new Response(JSON.stringify(OR_RESPONSE), { status: 200 })
  }) as typeof fetch
  const provider = createOpenRouterDecisionProvider({
    apiKey: 'k',
    model: 'typesafe/jev-1.13',
    fetch: fetchMock,
  })
  await provider.decide({ state: 'x', questions: { a: { type: 'noul', instructions: 'i' } } })
  const sent = JSON.parse(String(calls[0]!.body)) as { model: string }
  assert.equal(sent.model, 'typesafe/jev-1.13')
})

test('openRouter provider surfaces API errors with status', async () => {
  const fetchMock = (async () =>
    new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 })) as typeof fetch
  const provider = createOpenRouterDecisionProvider({ apiKey: 'bad', fetch: fetchMock })
  await assert.rejects(
    provider.decide({ state: 'x', questions: { a: { type: 'noul', instructions: 'i' } } }),
    (err: unknown) => {
      assert.ok(err instanceof OpenRouterDecisionError)
      assert.equal((err as OpenRouterDecisionError).status, 401)
      return true
    },
  )
})

test('openRouter provider times out with an error', async () => {
  const fetchMock = (async (_url: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  }) as typeof fetch
  const provider = createOpenRouterDecisionProvider({ apiKey: 'k', fetch: fetchMock, timeoutMs: 20 })
  await assert.rejects(
    provider.decide({ state: 'x', questions: { a: { type: 'noul', instructions: 'i' } } }),
    OpenRouterDecisionError,
  )
})

test('openRouter provider satisfies the DecisionProvider interface (swap-compatible with the stub)', async () => {
  const fetchMock = (async () =>
    new Response(JSON.stringify(OR_RESPONSE), { status: 200 })) as typeof fetch
  const p = createOpenRouterDecisionProvider({ apiKey: 'k', fetch: fetchMock })
  // The jev-tier inferrer + gateway /v1/decisions route consume this shape.
  assert.equal(typeof p.decide, 'function')
  assert.equal(p.id, 'openrouter-decisions')
  assert.deepEqual(p.models, ['~typesafe/jev-latest'])
})
