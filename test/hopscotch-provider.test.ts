import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createHopscotchCandidate,
  createHopscotchProvider,
  HOPSCOTCH_BASE_URL,
  HOPSCOTCH_MODELS,
} from '../src/providers/hopscotch.js'
import { createUsePodProvider } from '../src/providers/usepod.js'

test('constructs the OpenAI-compatible provider with an explicit key', () => {
  const provider = createHopscotchProvider({ apiKey: 'test-key' })
  assert.equal(typeof provider.chat, 'function')
  assert.equal(typeof provider.chatStream, 'function')
  assert.equal(HOPSCOTCH_BASE_URL, 'https://api.hopscotchlabs.ai/v1')
})

test('candidate is absent without HOPSCOTCH_API_KEY', () => {
  assert.equal(createHopscotchCandidate({}), undefined)
})

test('candidate is present only with HOPSCOTCH_API_KEY', () => {
  const candidate = createHopscotchCandidate({ HOPSCOTCH_API_KEY: 'test-key' })
  assert.equal(candidate?.id, 'hopscotch')
  assert.deepEqual(candidate?.models, HOPSCOTCH_MODELS)
})

test('catalog contains only real provider/model IDs with useful metadata', () => {
  assert.ok(HOPSCOTCH_MODELS.length >= 6)
  const families = new Set<string>()
  for (const model of HOPSCOTCH_MODELS) {
    assert.match(model.model, /^[^/]+\/.+$/)
    assert.ok(!model.model.startsWith('hopscotch/'))
    assert.ok(model.inputCostPerMTok > 0)
    assert.ok(model.outputCostPerMTok > 0)
    assert.ok(model.contextWindow > 0)
    families.add(model.model.split('/')[0])
  }
  assert.deepEqual([...families].sort(), ['anthropic', 'google-aistudio', 'openai-main'])
})

test('UsePod and Hopscotch coexist when both credentials are set', () => {
  const candidates = [
    {
      id: 'usepod',
      provider: createUsePodProvider({ token: 'test-token', family: 'anthropic' }),
    },
    createHopscotchCandidate({ HOPSCOTCH_API_KEY: 'test-key' }),
  ].filter(Boolean)
  assert.deepEqual(candidates.map((candidate) => candidate?.id), ['usepod', 'hopscotch'])
})
