import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchLocalModels } from '../src/connect/ollama-probe.js'

const LADDER = {
  maxParametersB: 4,
  models: [
    { model: 'llama3.2:3b', parametersB: 3, tier: 'economy' as const, contextWindow: 128_000 },
    { model: 'qwen2.5:14b-instruct', parametersB: 14, tier: 'standard' as const, contextWindow: 32_000 },
  ],
  source: 'probed' as const,
}

test('matches pulled Ollama models against the ladder', async () => {
  const result = await matchLocalModels({
    fetchImpl: async (url: string) => {
      if (url.endsWith('/api/tags')) {
        return new Response(
          JSON.stringify({ models: [{ name: 'llama3.2:3b' }, { name: 'nomic-embed-text' }] }),
        )
      }
      throw new Error('unexpected ' + url)
    },
    baseUrl: 'http://127.0.0.1:11434',
    ladder: LADDER,
  })
  assert.deepEqual(result.available.map((m) => m.model), ['llama3.2:3b'])
  assert.deepEqual(result.missing.map((m) => m.model), ['qwen2.5:14b-instruct'])
  assert.equal(result.ollamaUp, true)
})

test('reports ollama down without throwing', async () => {
  const result = await matchLocalModels({
    fetchImpl: async () => {
      throw new Error('ECONNREFUSED')
    },
    baseUrl: 'http://127.0.0.1:11434',
    ladder: { maxParametersB: 3, models: [], source: 'fallback' },
  })
  assert.equal(result.ollamaUp, false)
  assert.deepEqual(result.available, [])
})
