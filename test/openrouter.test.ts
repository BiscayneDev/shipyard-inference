import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOpenRouterProvider } from '../src/index.js'

test('createOpenRouterProvider returns a streaming-capable provider', () => {
  const provider = createOpenRouterProvider({ apiKey: 'test-key' })
  assert.equal(typeof provider.chat, 'function')
  assert.equal(typeof provider.chatStream, 'function')
})

test('createOpenRouterProvider throws without an API key or baseURL', () => {
  const saved = process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_API_KEY
  try {
    assert.throws(() => createOpenRouterProvider({}), /OPENROUTER_API_KEY/)
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved
  }
})

test('createOpenRouterProvider allows a baseURL override without a key', () => {
  const saved = process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_API_KEY
  try {
    assert.doesNotThrow(() => createOpenRouterProvider({ baseURL: 'http://localhost:9/v1' }))
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved
  }
})
