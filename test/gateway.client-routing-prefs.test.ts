import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import { clientRoutingHints } from '../src/gateway/server.js'
import { clampTier, filterByProviders } from '../src/router/router.js'
import { candidate, mockProvider, model } from './helpers.js'

// Client routing preferences on `auto` requests: a candidate allowlist and a
// floor/cap on the auto-tier decision (Dinghy keeps traffic on Hopscotch and
// sends research up a tier, chat down).

function app(autoTier: boolean | (() => 'economy' | 'standard' | 'frontier') = true) {
  const mk = (name: string) => mockProvider(async () => ({ content: name, toolCalls: [], stopReason: 'end_turn' as const }))
  const a = mk('a-cheap'), b = mk('b-cheap'), bBig = mk('b-big')
  const gw = createGatewayApp({
    candidates: [
      candidate('a', a, [model('a-cheap', { inputCostPerMTok: 0.01, outputCostPerMTok: 0.01, tier: 'economy' })]),
      candidate('b', b, [model('b-cheap', { inputCostPerMTok: 1, outputCostPerMTok: 1, tier: 'economy' })]),
      candidate('bb', bBig, [model('b-big', { inputCostPerMTok: 5, outputCostPerMTok: 5, tier: 'frontier' })]),
    ],
    apiKeys: ['k'],
    autoTier,
  })
  return gw
}

async function ask(gw: ReturnType<typeof createGatewayApp>, body: Record<string, unknown>): Promise<string> {
  const res = await gw.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'hi' }], ...body }),
  })
  assert.equal(res.status, 200)
  const j = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return j.choices[0]!.message.content
}

test('no prefs: cheapest capable model wins', async () => {
  assert.equal(await ask(app(), {}), 'a-cheap')
})

test('providers allowlist keeps routing on the named candidates', async () => {
  assert.equal(await ask(app(), { shipyard: { providers: ['b'] } }), 'b-cheap')
})

test('an allowlist that matches nothing is ignored', async () => {
  assert.equal(await ask(app(), { shipyard: { providers: ['nope'] } }), 'a-cheap')
})

test('min_tier raises the auto decision', async () => {
  assert.equal(await ask(app(), { shipyard: { min_tier: 'frontier' } }), 'b-big')
})

test('max_tier caps the auto decision', async () => {
  assert.equal(await ask(app(() => 'frontier'), { shipyard: { max_tier: 'economy' } }), 'a-cheap')
})

test('a named catalog model ignores prefs', async () => {
  assert.equal(await ask(app(), { model: 'b-big', shipyard: { max_tier: 'economy', providers: ['a'] } }), 'b-big')
})

test('helpers', () => {
  assert.equal(clampTier('economy', 'standard', undefined), 'standard')
  assert.equal(clampTier('frontier', undefined, 'standard'), 'standard')
  assert.equal(clampTier(undefined, 'frontier', undefined), 'frontier')
  assert.equal(clampTier(undefined, undefined, 'economy'), undefined)
  assert.deepEqual(filterByProviders([{ id: 'x' }, { id: 'y' }], ['Y']), [{ id: 'y' }])
  assert.equal(clientRoutingHints({ min_tier: 'bogus', providers: [1, ''] }), undefined)
  assert.deepEqual(clientRoutingHints({ providers: ['hopscotch'], max_tier: 'economy' }), { providers: ['hopscotch'], maxTier: 'economy' })
})
