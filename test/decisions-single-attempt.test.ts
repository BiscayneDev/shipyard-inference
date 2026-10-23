import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTypeSafeProvider, createOpenRouterDecisionProvider, createVercelGatewayDecisionProvider } from '../src/decisions/index.js'

for (const factory of [createTypeSafeProvider, createOpenRouterDecisionProvider, createVercelGatewayDecisionProvider]) {
  test(`${factory.name}: single-attempt failure issues exactly one fetch`, async () => {
    let calls = 0
    const provider = factory({ apiKey: 'fictional', fetch: async () => { calls++; return new Response('failure', { status: 503 }) } })
    await assert.rejects(provider.decideOnce!({ state: 'fictional', questions: { q: { type: 'noul', instructions: 'true?' } } }))
    assert.equal(calls, 1)
  })
}
