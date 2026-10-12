import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PRICING, resolveModelMetadata } from '../src/router/pricing.js'
import { NOUS_GENERATED_PRICING } from '../src/catalog/nous.generated.js'

const isFiniteNumber = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0

test('DEFAULT_PRICING merges the generated Nous catalog', () => {
  assert.ok(Object.keys(NOUS_GENERATED_PRICING).length > 0, 'generated table is non-empty')
  // Every generated key is reachable through DEFAULT_PRICING.
  for (const [model, row] of Object.entries(NOUS_GENERATED_PRICING)) {
    assert.equal(DEFAULT_PRICING[model], row, `generated key ${model} merged into DEFAULT_PRICING`)
  }
})

test('generated rows are well-formed and priced (no Infinity, positive cost)', () => {
  for (const [model, row] of Object.entries(NOUS_GENERATED_PRICING)) {
    assert.ok(isFiniteNumber(row.inputCostPerMTok), `${model} finite input price`)
    assert.ok(isFiniteNumber(row.outputCostPerMTok), `${model} finite output price`)
    assert.ok(row.inputCostPerMTok + row.outputCostPerMTok > 0, `${model} costs > 0`)
    assert.ok(isFiniteNumber(row.contextWindow), `${model} finite context`)
    assert.ok(row.contextWindow >= 128_000, `${model} context >= 128k`)
    assert.ok(row.capabilities.includes('tools'), `${model} is tool-capable (routable in agent loops)`)
    assert.ok(['economy', 'standard', 'frontier'].includes(row.tier), `${model} has a valid tier`)
    if (row.cacheReadCostPerMTok !== undefined) {
      assert.ok(isFiniteNumber(row.cacheReadCostPerMTok), `${model} finite cache-read price`)
    }
  }
})

test('hand-curated keys win over generated ones on conflict', () => {
  // If a Nous id collides with a curated id, curated stays (spread order).
  assert.equal(DEFAULT_PRICING['claude-opus-4-5']?.inputCostPerMTok, 5, 'curated opus price kept')
  assert.equal(DEFAULT_PRICING['claude-haiku-4-5']?.inputCostPerMTok, 0.8, 'curated haiku price kept')
})

test('generated model resolves through resolveModelMetadata, curated stays priced', () => {
  const probe = Object.keys(NOUS_GENERATED_PRICING)[0]!
  const gen = resolveModelMetadata(probe, undefined, undefined)
  assert.equal(gen.priced, true, `${probe} is priced through DEFAULT_PRICING`)
  assert.equal(gen.meta.model, probe)

  const curated = resolveModelMetadata('claude-opus-4-5', undefined, undefined)
  assert.equal(curated.priced, true)
  assert.equal(curated.meta.tier, 'frontier')
})
