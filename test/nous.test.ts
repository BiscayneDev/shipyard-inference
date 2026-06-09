import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNousProvider } from '../src/index.js'

test('createNousProvider returns a streaming-capable provider', () => {
  const provider = createNousProvider({ apiKey: 'test-key' })
  assert.equal(typeof provider.chat, 'function')
  assert.equal(typeof provider.chatStream, 'function')
})

test('createNousProvider throws without an API key or baseURL', () => {
  const saved = process.env.NOUS_API_KEY
  delete process.env.NOUS_API_KEY
  try {
    assert.throws(() => createNousProvider({}), /NOUS_API_KEY/)
  } finally {
    if (saved !== undefined) process.env.NOUS_API_KEY = saved
  }
})

test('createNousProvider allows a baseURL override without a key', () => {
  const saved = process.env.NOUS_API_KEY
  delete process.env.NOUS_API_KEY
  try {
    assert.doesNotThrow(() => createNousProvider({ baseURL: 'http://localhost:1234/v1' }))
  } finally {
    if (saved !== undefined) process.env.NOUS_API_KEY = saved
  }
})
