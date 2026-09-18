import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createChainedDecisionProvider } from '../src/decisions/chain.js'
import { createStubDecisionProvider } from '../src/decisions/stub.js'
import type { DecisionProvider, DecisionRequest, DecisionResponse } from '../src/decisions/types.js'

function fake(id: string, opts: { fail?: boolean; model?: string } = {}): DecisionProvider {
  return {
    id,
    models: opts.model ? [opts.model] : undefined,
    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      if (opts.fail) throw new Error(`${id} is blocked (e.g. customer_verification_required)`)
      return {
        model: opts.model ?? `${id}-model`,
        answers: Object.fromEntries(
          Object.keys(req.questions).map((k) => [k, { type: 'noul', probability: 0.9, confidence: 0.9 }]),
        ),
      }
    },
  }
}

test('chain: first healthy provider wins and tags the response', async () => {
  const chain = createChainedDecisionProvider({
    providers: [fake('gateway', { fail: true }), fake('openrouter'), fake('stub')],
  })
  const res = await chain.decide({
    state: 's',
    questions: { q: { type: 'noul', instructions: 'ok?' } },
  })
  assert.equal(res.provider, 'openrouter')
  assert.equal(res.model, 'openrouter-model')
})

test('chain: falls through to the terminal stub when every live provider fails', async () => {
  const chain = createChainedDecisionProvider({
    providers: [fake('gateway', { fail: true }), createStubDecisionProvider()],
  })
  const res = await chain.decide({
    state: 's',
    questions: { q: { type: 'noul', instructions: 'ok?' } },
  })
  assert.equal(res.provider, 'stub')
  // Stub answers are neutral — noul 0.5, complete uncertainty.
  const a = res.answers.q
  assert.equal(a?.type, 'noul')
  if (a?.type === 'noul') assert.equal(a.noul, 0.5)
})

test('chain: onFallback reports the failure and the next member', async () => {
  const events: string[] = []
  const chain = createChainedDecisionProvider({
    providers: [fake('gateway', { fail: true }), fake('openrouter')],
    onFallback: (failed, next) => events.push(`${failed.provider} → ${next}`),
  })
  await chain.decide({ state: 's', questions: { q: { type: 'noul', instructions: 'ok?' } } })
  assert.deepEqual(events, ['gateway → openrouter'])
})

test('chain: throws only when every member fails (no infallible tail)', async () => {
  const chain = createChainedDecisionProvider({
    providers: [fake('a', { fail: true }), fake('b', { fail: true })],
  })
  await assert.rejects(
    chain.decide({ state: 's', questions: { q: { type: 'noul', instructions: 'ok?' } } }),
    /b is blocked/,
  )
})

test('chain: requires at least one provider', () => {
  assert.throws(() => createChainedDecisionProvider({ providers: [] }))
})
