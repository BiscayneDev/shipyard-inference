import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCapable } from '../src/index.js'
import { chatParams, model } from './helpers.js'

test('no hints and no tools: any model is capable', () => {
  assert.equal(isCapable(model('m'), undefined, chatParams()), true)
})

test('a tool-bearing request requires a tool-capable model', () => {
  const params = chatParams({
    tools: [{ name: 't', description: 'd', inputSchema: {} }],
  })
  assert.equal(isCapable(model('m', { capabilities: [] }), undefined, params), false)
  assert.equal(isCapable(model('m', { capabilities: ['tools'] }), undefined, params), true)
})

test('tier floor filters lower-tier models', () => {
  const economy = model('eco', { tier: 'economy' })
  const frontier = model('front', { tier: 'frontier' })
  assert.equal(isCapable(economy, { tier: 'frontier' }, chatParams()), false)
  assert.equal(isCapable(frontier, { tier: 'frontier' }, chatParams()), true)
})

test('minContextWindow filters small-context models', () => {
  const small = model('s', { contextWindow: 8_000 })
  assert.equal(isCapable(small, { minContextWindow: 100_000 }, chatParams()), false)
})

test('tags must all be present in capabilities', () => {
  const m = model('m', { capabilities: ['tools', 'vision'] })
  assert.equal(isCapable(m, { tags: ['vision'] }, chatParams()), true)
  assert.equal(isCapable(m, { tags: ['json'] }, chatParams()), false)
})

test('maxCostPerMTokOut rejects expensive models', () => {
  const m = model('m', { outputCostPerMTok: 20 })
  assert.equal(isCapable(m, { maxCostPerMTokOut: 5 }, chatParams()), false)
})

test('context-window fit guard rejects when prompt+output exceed the window', () => {
  const m = model('m', { contextWindow: 1000 })
  const params = chatParams({ maxTokens: 5000 })
  assert.equal(isCapable(m, undefined, params), false)
})
