import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAgentWiring, resolveConnectTargets } from '../src/connect/agent-wiring.js'

test('openclaw/hermes wiring sets AGENT_MODEL_VIC=auto', () => {
  const w = buildAgentWiring('openclaw', { url: 'http://127.0.0.1:8787/v1', key: 'sk-1' })
  assert.equal(w.env.AGENT_MODEL_VIC, 'auto')
  assert.equal(w.env.SHIPYARD_INFERENCE_URL, 'http://127.0.0.1:8787/v1')
  assert.equal(w.env.SHIPYARD_INFERENCE_API_KEY, 'sk-1')
  assert.ok(w.instructions.includes('.env.local'))
})

test('generic env wiring is OpenAI-compatible', () => {
  const w = buildAgentWiring('env', { url: 'http://127.0.0.1:8787/v1', key: 'sk-2' })
  assert.equal(w.env.OPENAI_BASE_URL, 'http://127.0.0.1:8787/v1')
  assert.equal(w.env.OPENAI_API_KEY, 'sk-2')
  assert.ok(w.instructions.includes('model: auto'))
})

test('claude route wiring only describes settings takeover (bin.ts owns the write)', () => {
  const w = buildAgentWiring('claude', { url: 'http://127.0.0.1:8787/v1', key: 'sk-3' })
  assert.equal(w.env.ANTHROPIC_BASE_URL, 'http://127.0.0.1:8787') // no /v1 — Claude appends /v1
  assert.equal(w.env.ANTHROPIC_AUTH_TOKEN, 'sk-3')
  assert.ok(w.instructions.includes('--route'))
})

test('resolveConnectTargets returns one wiring per agent kind requested', () => {
  const targets = resolveConnectTargets({
    agents: ['openclaw', 'env'],
    url: 'http://127.0.0.1:8787/v1',
    key: 'sk-1',
  })
  assert.equal(targets.length, 2)
  assert.equal(targets[0].kind, 'openclaw')
  assert.ok(targets[0].wiring.env.AGENT_MODEL_VIC === 'auto')
  assert.equal(targets[1].kind, 'env')
})
