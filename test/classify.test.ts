import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify, mergeRoutingHints } from '../src/index.js'
import type { ToolDefinition } from '../src/index.js'
import { chatParams } from './helpers.js'

function tools(...names: string[]): ToolDefinition[] {
  return names.map((name) => ({ name, description: '', inputSchema: {} }))
}

test('no tools, short output → chat / short', () => {
  const { ad } = classify(chatParams())
  assert.equal(ad.loopCategory, 'chat')
  assert.equal(ad.loopTier, 'short')
})

test('no tools, large output budget → writing', () => {
  const { ad } = classify(chatParams({ maxTokens: 4000 }))
  assert.equal(ad.loopCategory, 'writing')
})

test('file/bash tools → coding / long', () => {
  const { ad } = classify(chatParams({ tools: tools('read_file', 'bash', 'edit_file') }))
  assert.equal(ad.loopCategory, 'coding')
  assert.equal(ad.loopTier, 'long')
})

test('web search / fetch tools → research / long', () => {
  const { ad } = classify(chatParams({ tools: tools('web_search', 'fetch_url') }))
  assert.equal(ad.loopCategory, 'research')
  assert.equal(ad.loopTier, 'long')
})

test('sql / query tools → data / long', () => {
  const { ad } = classify(chatParams({ tools: tools('execute_sql', 'query_table') }))
  assert.equal(ad.loopCategory, 'data')
  assert.equal(ad.loopTier, 'long')
})

test('dominant category wins on mixed toolsets', () => {
  // Two coding-ish tools, one research-ish → coding.
  const { ad } = classify(chatParams({ tools: tools('read_file', 'apply_patch', 'web_search') }))
  assert.equal(ad.loopCategory, 'coding')
})

test('a single unrecognized tool reads as simple function-calling chat', () => {
  const { ad } = classify(chatParams({ tools: tools('get_weather') }))
  assert.equal(ad.loopCategory, 'chat')
  assert.equal(ad.loopTier, 'short')
})

test('many unrecognized tools read as a generic (coding) agent loop', () => {
  const { ad } = classify(chatParams({ tools: tools('alpha', 'beta', 'gamma', 'delta') }))
  assert.equal(ad.loopCategory, 'coding')
  assert.equal(ad.loopTier, 'long')
})

test('derived hints: long loops get at least a standard tier floor', () => {
  const { hints } = classify(chatParams({ tools: tools('read_file', 'bash') }))
  assert.equal(hints.tier, 'standard')
})

test('derived hints: chat loops get no tier floor (cheapest model allowed)', () => {
  const { hints } = classify(chatParams())
  assert.equal(hints.tier, undefined)
})

test('derived hints: very large output justifies a frontier floor', () => {
  const { hints } = classify(chatParams({ maxTokens: 16_000 }))
  assert.equal(hints.tier, 'frontier')
})

test('derived hints always reserve context for prompt + output', () => {
  const { hints } = classify(chatParams({ maxTokens: 1000 }))
  assert.ok((hints.minContextWindow ?? 0) >= 1000)
})

test('mergeRoutingHints: caller-supplied fields always win', () => {
  const merged = mergeRoutingHints({ tier: 'frontier' }, { tier: 'standard', minContextWindow: 5000 })
  assert.equal(merged.tier, 'frontier') // caller wins
  assert.equal(merged.minContextWindow, 5000) // derived fills the gap
})

test('mergeRoutingHints: no caller hints → derived used as-is', () => {
  const merged = mergeRoutingHints(undefined, { tier: 'standard' })
  assert.equal(merged.tier, 'standard')
})
