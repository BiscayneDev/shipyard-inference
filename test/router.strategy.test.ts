import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  costOptimized,
  failover,
  composite,
  resolveModelMetadata,
} from '../src/index.js'
import { candidate, chatParams, model, staticProvider } from './helpers.js'

test('costOptimized picks the cheapest capable model first', () => {
  const cheap = candidate('cheap', staticProvider('cheap'), [
    model('cheap-model', { outputCostPerMTok: 1 }),
  ])
  const pricey = candidate('pricey', staticProvider('pricey'), [
    model('pricey-model', { outputCostPerMTok: 50 }),
  ])

  const decisions = costOptimized().select({
    params: chatParams(),
    candidates: [pricey, cheap],
    attempt: 0,
    previousErrors: [],
  })

  assert.equal(decisions[0]?.candidate.id, 'cheap')
  assert.equal(decisions[1]?.candidate.id, 'pricey')
})

test('costOptimized sorts unpriced (Infinity) models last', () => {
  const priced = candidate('priced', staticProvider('a'), [
    model('priced-model', { outputCostPerMTok: 10 }),
  ])
  const unpriced = candidate('unpriced', staticProvider('b'), [
    model('unpriced-model', {
      inputCostPerMTok: Infinity,
      outputCostPerMTok: Infinity,
    }),
  ])

  const decisions = costOptimized().select({
    params: chatParams(),
    candidates: [unpriced, priced],
    attempt: 0,
    previousErrors: [],
  })

  assert.equal(decisions[0]?.candidate.id, 'priced')
  assert.equal(decisions.at(-1)?.candidate.id, 'unpriced')
})

test('failover respects the requested order, ignoring cost', () => {
  const a = candidate('a', staticProvider('a'), [model('am', { outputCostPerMTok: 99 })])
  const b = candidate('b', staticProvider('b'), [model('bm', { outputCostPerMTok: 1 })])

  const decisions = failover(['a', 'b']).select({
    params: chatParams(),
    candidates: [b, a],
    attempt: 0,
    previousErrors: [],
  })

  assert.deepEqual(
    decisions.map((d) => d.candidate.id),
    ['a', 'b'],
  )
})

test('failover includes metadata-less candidates with the request model', () => {
  const usepod = candidate('usepod', staticProvider('u')) // no models metadata
  const decisions = failover().select({
    params: chatParams({ model: 'claude-sonnet-4-5' }),
    candidates: [usepod],
    attempt: 0,
    previousErrors: [],
  })

  assert.equal(decisions.length, 1)
  assert.equal(decisions[0]?.candidate.id, 'usepod')
  assert.equal(decisions[0]?.model, 'claude-sonnet-4-5')
})

test('composite concatenates and de-duplicates by candidate+model', () => {
  const cheap = candidate('cheap', staticProvider('c'), [model('cm', { outputCostPerMTok: 1 })])
  const usepod = candidate('usepod', staticProvider('u'))

  const strategy = composite(costOptimized(), failover(['usepod']))
  const decisions = strategy.select({
    params: chatParams(),
    candidates: [cheap, usepod],
    attempt: 0,
    previousErrors: [],
  })

  const ids = decisions.map((d) => `${d.candidate.id}:${d.model}`)
  assert.deepEqual(new Set(ids).size, ids.length, 'no duplicates')
  assert.ok(ids.some((i) => i.startsWith('cheap')))
  assert.ok(ids.some((i) => i.startsWith('usepod')))
})

test('resolveModelMetadata flags unknown models as unpriced with Infinity cost', () => {
  const { meta, priced } = resolveModelMetadata('totally-unknown', undefined, undefined)
  assert.equal(priced, false)
  assert.equal(meta.outputCostPerMTok, Infinity)
})

test('resolveModelMetadata uses overrides over the default table', () => {
  const { meta } = resolveModelMetadata(
    'gpt-4o',
    undefined,
    { 'gpt-4o': { outputCostPerMTok: 0.01 } },
  )
  assert.equal(meta.outputCostPerMTok, 0.01)
})
