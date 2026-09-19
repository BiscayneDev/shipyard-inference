import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAdvisorReport } from '../src/connect/advisor.js'

test('builds a full report when hardware and ollama are up', () => {
  const report = buildAdvisorReport({
    hardware: { chip: 'Apple M2', totalRamGb: 8, platform: 'darwin' },
    ladder: {
      maxParametersB: 3,
      source: 'probed',
      models: [
        { model: 'llama3.2:3b', parametersB: 3, tier: 'economy', contextWindow: 128_000 },
        { model: 'qwen2.5:14b-instruct', parametersB: 14, tier: 'standard', contextWindow: 32_000 },
      ],
    },
    runtime: {
      ollamaUp: true,
      available: [
        { model: 'llama3.2:3b', parametersB: 3, tier: 'economy', contextWindow: 128_000 },
      ],
      missing: [
        { model: 'qwen2.5:14b-instruct', parametersB: 14, tier: 'standard', contextWindow: 32_000 },
      ],
    },
  })
  assert.ok(report.includes('Apple M2'))
  assert.ok(report.includes('8 GB'))
  assert.ok(report.includes('llama3.2:3b'))
  assert.ok(report.includes('ollama pull qwen2.5:14b-instruct'))
  // The auto-model instruction is the Survive-critical line.
  assert.ok(report.includes('model: auto'))
})

test('degrades gracefully when ollama is down', () => {
  const report = buildAdvisorReport({
    hardware: { chip: 'Apple M2', totalRamGb: 8, platform: 'darwin' },
    ladder: { maxParametersB: 3, source: 'probed', models: [] },
    runtime: { ollamaUp: false, available: [], missing: [] },
  })
  assert.ok(report.includes('Ollama is not running'))
  assert.ok(report.includes('ollama serve'))
})

test('degrades gracefully when hardware is unknown', () => {
  const report = buildAdvisorReport({
    hardware: null,
    ladder: {
      maxParametersB: 3,
      source: 'fallback',
      models: [
        { model: 'llama3.2:3b', parametersB: 3, tier: 'economy', contextWindow: 128_000 },
      ],
    },
    runtime: { ollamaUp: true, available: [], missing: [] },
  })
  assert.ok(report.includes('fallback'))
})
