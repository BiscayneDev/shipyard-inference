import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyUsePodModel,
  selectUsePodModels,
  usePodFallbackCatalog,
  fetchUsePodModels,
  createUsePodCandidate,
  costOptimized,
} from '../src/index.js'
import { chatParams } from './helpers.js'

function jsonFetch(
  body: unknown,
  opts: { status?: number; capture?: (url: string) => void } = {},
): typeof fetch {
  return (async (url: unknown) => {
    opts.capture?.(String(url))
    return new Response(JSON.stringify(body), {
      status: opts.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

// --- classification -------------------------------------------------------

test('classifyUsePodModel tiers known model families', () => {
  assert.equal(classifyUsePodModel('gpt-5.5')?.tier, 'frontier')
  assert.equal(classifyUsePodModel('claude-opus-4-5')?.tier, 'frontier')
  assert.equal(classifyUsePodModel('claude-sonnet-4-5')?.tier, 'standard')
  assert.equal(classifyUsePodModel('deepseek-v4')?.tier, 'standard')
  assert.equal(classifyUsePodModel('qwen-3.5-397b')?.tier, 'standard')
  assert.equal(classifyUsePodModel('claude-haiku-4-5')?.tier, 'economy')
  assert.equal(classifyUsePodModel('llama-4')?.tier, 'economy')
  assert.equal(classifyUsePodModel('mistral-small-4')?.tier, 'economy')
})

test('classifyUsePodModel returns null for unrecognized ids', () => {
  assert.equal(classifyUsePodModel('totally-made-up-model'), null)
})

test('classifyUsePodModel marks claude servable on both surfaces, open-weight on openai only', () => {
  assert.deepEqual(classifyUsePodModel('claude-sonnet-4-5')?.surfaces.sort(), ['anthropic', 'openai'])
  assert.deepEqual(classifyUsePodModel('llama-4')?.surfaces, ['openai'])
  assert.deepEqual(classifyUsePodModel('gpt-5.5')?.surfaces, ['openai'])
})

test('gpt-4o-mini is economy, gpt-4o is standard (mini rule wins)', () => {
  assert.equal(classifyUsePodModel('gpt-4o-mini')?.tier, 'economy')
  assert.equal(classifyUsePodModel('gpt-4o')?.tier, 'standard')
})

// --- selection (best-per-tier) -------------------------------------------

const MIXED = [
  'claude-haiku-4-5',
  'llama-4',
  'deepseek-v4',
  'qwen-3.5-397b',
  'gpt-5.5',
  'claude-opus-4-5',
  'some-unknown-model',
]

test('selectUsePodModels picks one best model per tier on the openai surface', () => {
  const models = selectUsePodModels(MIXED, { family: 'openai' })
  const byTier = Object.fromEntries(models.map((m) => [m.tier, m.model]))
  // economy: llama-4 preferred over claude-haiku; standard: deepseek-v4 preferred; frontier: gpt-5.5 preferred
  assert.equal(byTier.economy, 'llama-4')
  assert.equal(byTier.standard, 'deepseek-v4')
  assert.equal(byTier.frontier, 'gpt-5.5')
  assert.equal(models.length, 3)
})

test('selectUsePodModels filters to claude on the anthropic surface', () => {
  const models = selectUsePodModels(MIXED, { family: 'anthropic' })
  assert.deepEqual(
    models.map((m) => m.model).sort(),
    ['claude-haiku-4-5', 'claude-opus-4-5'],
  )
})

test('selectUsePodModels falls back to cheapest in-tier when no preferred id is present', () => {
  // No preferred standard id here; deepseek ($0.3+$1.2) beats qwen ($0.4+$1.2).
  const models = selectUsePodModels(['deepseek-v4', 'qwen-3.5-397b'], { family: 'openai' })
  assert.equal(models.length, 1)
  assert.equal(models[0]?.tier, 'standard')
  assert.equal(models[0]?.model, 'deepseek-v4')
})

test('prefer override changes the per-tier pick', () => {
  const models = selectUsePodModels(MIXED, {
    family: 'openai',
    prefer: { economy: ['claude-haiku-4-5'] },
  })
  assert.equal(models.find((m) => m.tier === 'economy')?.model, 'claude-haiku-4-5')
})

// --- curated fallback catalog --------------------------------------------

test('usePodFallbackCatalog returns a best-per-tier set for each surface', () => {
  const openai = usePodFallbackCatalog({ family: 'openai' })
  assert.deepEqual(openai.map((m) => m.tier), ['economy', 'standard', 'frontier'])

  const anthropic = usePodFallbackCatalog({ family: 'anthropic' })
  // anthropic surface lands on claude-* across all three tiers
  assert.deepEqual(anthropic.map((m) => m.tier), ['economy', 'standard', 'frontier'])
  assert.ok(anthropic.every((m) => m.model.includes('claude')))
})

// --- live discovery -------------------------------------------------------

test('fetchUsePodModels parses the /v1/models data array', async () => {
  let calledUrl = ''
  const ids = await fetchUsePodModels({
    token: 'tok-1',
    fetch: jsonFetch(
      { object: 'list', data: [{ id: 'gpt-5.5' }, { id: 'llama-4' }, { id: 'deepseek-v4' }] },
      { capture: (u) => (calledUrl = u) },
    ),
  })
  assert.deepEqual(ids, ['gpt-5.5', 'llama-4', 'deepseek-v4'])
  assert.ok(calledUrl.endsWith('/proxy/tok-1/v1/models'))
})

test('fetchUsePodModels throws on a non-ok response (e.g. unactivated token)', async () => {
  await assert.rejects(
    fetchUsePodModels({ token: 'tok-1', fetch: jsonFetch({ error: 'unauthorized' }, { status: 401 }) }),
    /\/v1\/models failed: 401/,
  )
})

// --- candidate builder ----------------------------------------------------

test('createUsePodCandidate uses discovery when the listing is reachable', async () => {
  const cand = await createUsePodCandidate({
    token: 'tok-1',
    fetch: jsonFetch({ data: [{ id: 'llama-4' }, { id: 'deepseek-v4' }, { id: 'gpt-5.5' }] }),
  })
  assert.equal(cand.id, 'usepod')
  assert.deepEqual(cand.models?.map((m) => m.model), ['llama-4', 'deepseek-v4', 'gpt-5.5'])
})

test('createUsePodCandidate falls back to the curated catalog when discovery fails', async () => {
  const cand = await createUsePodCandidate({
    token: 'tok-1',
    fetch: jsonFetch({ error: 'unauthorized' }, { status: 401 }),
  })
  assert.equal(cand.models?.length, 3)
  assert.deepEqual(cand.models?.map((m) => m.tier), ['economy', 'standard', 'frontier'])
})

test('createUsePodCandidate honors an explicit models[] and skips discovery', async () => {
  let fetched = false
  const cand = await createUsePodCandidate({
    token: 'tok-1',
    models: [
      { model: 'pinned', inputCostPerMTok: 1, outputCostPerMTok: 1, contextWindow: 1000, tier: 'standard', capabilities: ['tools'] },
    ],
    fetch: jsonFetch({ data: [] }, { capture: () => (fetched = true) }),
  })
  assert.equal(fetched, false)
  assert.equal(cand.models?.[0]?.model, 'pinned')
})

// --- end-to-end with the cost router -------------------------------------

test('costOptimized over a discovered UsePod candidate picks the cheapest capable model', async () => {
  const cand = await createUsePodCandidate({
    token: 'tok-1',
    fetch: jsonFetch({ data: [{ id: 'llama-4' }, { id: 'deepseek-v4' }, { id: 'gpt-5.5' }] }),
  })
  const decisions = costOptimized().select({
    params: chatParams(),
    candidates: [cand],
    attempt: 0,
    previousErrors: [],
  })
  // cheapest capable for a trivial prompt → the economy open-weight model
  assert.equal(decisions[0]?.model, 'llama-4')
})

test('a frontier tier hint routes the UsePod candidate to its frontier model', async () => {
  const cand = await createUsePodCandidate({
    token: 'tok-1',
    fetch: jsonFetch({ data: [{ id: 'llama-4' }, { id: 'deepseek-v4' }, { id: 'gpt-5.5' }] }),
  })
  const decisions = costOptimized().select({
    params: chatParams({ routingHints: { tier: 'frontier' } }),
    candidates: [cand],
    attempt: 0,
    previousErrors: [],
  })
  assert.equal(decisions[0]?.model, 'gpt-5.5')
  assert.ok(decisions.every((d) => d.meta?.tier === 'frontier'))
})
