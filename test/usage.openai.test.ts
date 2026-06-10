import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseOpenAIUsage } from '../src/providers/openai.js'

test('normalizes OpenAI usage so inputTokens excludes cached prompt tokens', () => {
  const usage = parseOpenAIUsage({
    prompt_tokens: 100, // OpenAI counts cached within prompt_tokens…
    completion_tokens: 40,
    total_tokens: 140,
    prompt_tokens_details: { cached_tokens: 12 },
  } as never)
  // …we split them so inputTokens (full-rate) and cacheReadTokens are disjoint.
  assert.deepEqual(usage, {
    inputTokens: 88,
    outputTokens: 40,
    cacheReadTokens: 12,
  })
})

test('omits cache field when not reported', () => {
  const usage = parseOpenAIUsage({
    prompt_tokens: 9,
    completion_tokens: 1,
    total_tokens: 10,
  } as never)
  assert.deepEqual(usage, { inputTokens: 9, outputTokens: 1 })
})

test('returns undefined when usage is absent', () => {
  assert.equal(parseOpenAIUsage(undefined), undefined)
  assert.equal(parseOpenAIUsage(null), undefined)
})
