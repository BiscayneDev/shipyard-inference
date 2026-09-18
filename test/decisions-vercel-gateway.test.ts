import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createVercelGatewayDecisionProvider, VercelGatewayDecisionError } from '../src/decisions/index.js'

// Vercel AI Gateway provider — raw contract captured from the AI SDK's
// experimental_evaluate: POST /v4/ai/evaluation-model, spec-v4 headers,
// `boolean` (not `noul`) as the yes/no question type.

test('vercel gateway provider posts the captured raw contract', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(
      JSON.stringify({
        answers: {
          is_urgent: { type: 'boolean', boolean: 0.91 },
          department: {
            type: 'choice',
            choice: 'technical',
            probabilities: { billing: 0.06, technical: 0.92, sales: 0.02 },
            confidence: 0.77,
          },
        },
        usage: { inputTokens: 44, outputTokens: 8 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }) as typeof fetch

  const provider = createVercelGatewayDecisionProvider({ apiKey: 'vck_test', fetch: fetchMock })
  const res = await provider.decide({
    state: 'Payouts failing for 3 days.',
    questions: {
      is_urgent: { type: 'noul', instructions: 'Does this convey urgency?' },
      department: {
        type: 'choice',
        instructions: 'Which team?',
        criteria: { billing: 'payments', technical: 'bugs' },
      },
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.url, 'https://ai-gateway.vercel.sh/v4/ai/evaluation-model')
  const h = calls[0]!.init.headers as Record<string, string>
  assert.equal(h['authorization'], 'Bearer vck_test')
  assert.equal(h['ai-model-id'], 'typesafe-ai/jev')
  assert.equal(h['ai-evaluation-model-specification-version'], '4')
  assert.equal(h['ai-gateway-auth-method'], 'api-key')
  assert.equal(h['ai-gateway-protocol-version'], '0.0.1')
  const sent = JSON.parse(String(calls[0]!.init.body)) as {
    state: string
    questions: Record<string, { type: string }>
  }
  assert.equal(sent.state, 'Payouts failing for 3 days.')
  // noul maps to the gateway's boolean
  assert.equal(sent.questions['is_urgent']!.type, 'boolean')
  assert.equal(sent.questions['department']!.type, 'choice')

  // answers map back: boolean → noul
  assert.equal(res.answers['is_urgent']?.type, 'noul')
  assert.equal(res.answers['is_urgent']?.type === 'noul' && res.answers['is_urgent'].noul > 0.9, true)
  assert.equal(res.answers['department']?.type === 'choice' && res.answers['department'].choice, 'technical')
  assert.deepEqual(res.usage, { inputTokens: 44, outputTokens: 8 })
})

test('vercel gateway provider maps native noul answers too (tolerant parse)', async () => {
  const fetchMock = (async () =>
    new Response(
      JSON.stringify({ answers: { q: { type: 'noul', noul: 0.42 } } }),
      { status: 200 },
    )) as typeof fetch
  const provider = createVercelGatewayDecisionProvider({ apiKey: 'k', fetch: fetchMock })
  const res = await provider.decide({
    state: 'x',
    questions: { q: { type: 'noul', instructions: 'i' } },
  })
  assert.equal(res.answers['q']?.type, 'noul')
  assert.equal(res.answers['q']?.type === 'noul' && res.answers['q'].noul, 0.42)
})

test('vercel gateway provider surfaces errors with status', async () => {
  const fetchMock = (async () =>
    new Response(
      JSON.stringify({ error: { message: 'AI Gateway requires a valid credit card on file', type: 'customer_verification_required' } }),
      { status: 403 },
    )) as typeof fetch
  const provider = createVercelGatewayDecisionProvider({ apiKey: 'k', fetch: fetchMock })
  await assert.rejects(
    provider.decide({ state: 'x', questions: { q: { type: 'noul', instructions: 'i' } } }),
    (err: unknown) => {
      assert.ok(err instanceof VercelGatewayDecisionError)
      assert.equal((err as VercelGatewayDecisionError).status, 403)
      assert.match((err as VercelGatewayDecisionError).message, /credit card/)
      return true
    },
  )
})

test('vercel gateway provider times out cleanly', async () => {
  const fetchMock = (async (_url: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  }) as typeof fetch
  const provider = createVercelGatewayDecisionProvider({ apiKey: 'k', fetch: fetchMock, timeoutMs: 20 })
  await assert.rejects(
    provider.decide({ state: 'x', questions: { q: { type: 'noul', instructions: 'i' } } }),
    VercelGatewayDecisionError,
  )
})

test('jev tier inferrer works over the vercel gateway provider (routing path)', async () => {
  const { createJevTierInferrer } = await import('../src/router/jev-tier.js')
  const fetchMock = (async () =>
    new Response(
      JSON.stringify({
        answers: {
          tier: { type: 'choice', choice: 'frontier', probabilities: { frontier: 0.9 }, confidence: 0.9 },
          needs_reasoning: { type: 'boolean', boolean: 0.8 },
        },
      }),
      { status: 200 },
    )) as typeof fetch
  const provider = createVercelGatewayDecisionProvider({ apiKey: 'k', fetch: fetchMock })
  const inferrer = createJevTierInferrer({ provider })
  const decision = await inferrer({
    system: 'sys',
    messages: [{ role: 'user', content: 'Design a multi-tenant billing schema' }],
    tools: [],
  })
  assert.equal(decision.tier, 'frontier')
})
