import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAnthropicUsage } from '../src/providers/anthropic.js'

test('maps Anthropic usage including cache fields', () => {
  const usage = parseAnthropicUsage({
    input_tokens: 100,
    output_tokens: 50,
    cache_read_input_tokens: 10,
    cache_creation_input_tokens: 5,
  } as never)
  assert.deepEqual(usage, {
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 10,
    cacheWriteTokens: 5,
  })
})

test('omits cache fields when the upstream does not report them', () => {
  const usage = parseAnthropicUsage({ input_tokens: 7, output_tokens: 3 } as never)
  assert.deepEqual(usage, { inputTokens: 7, outputTokens: 3 })
})

test('returns undefined when usage is absent', () => {
  assert.equal(parseAnthropicUsage(undefined), undefined)
  assert.equal(parseAnthropicUsage(null), undefined)
})
