import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backoffDelayMs, retryAfterMs, nextRetryDelayMs } from '../src/index.js'

test('backoffDelayMs grows exponentially and caps (jitter off)', () => {
  const p = { baseDelayMs: 100, maxDelayMs: 500, jitter: false }
  assert.equal(backoffDelayMs(0, p), 100)
  assert.equal(backoffDelayMs(1, p), 200)
  assert.equal(backoffDelayMs(2, p), 400)
  assert.equal(backoffDelayMs(3, p), 500) // capped
  assert.equal(backoffDelayMs(9, p), 500)
})

test('backoffDelayMs with jitter stays within [0, capped]', () => {
  for (let i = 0; i < 50; i++) {
    const d = backoffDelayMs(2, { baseDelayMs: 100, maxDelayMs: 1000 }) // capped at 400
    assert.ok(d >= 0 && d <= 400)
  }
})

test('retryAfterMs parses seconds, ms, Headers, and a record', () => {
  assert.equal(retryAfterMs({ headers: { 'retry-after': '2' } }), 2000)
  assert.equal(retryAfterMs({ headers: { 'retry-after-ms': '1500' } }), 1500)
  assert.equal(retryAfterMs({ headers: new Headers({ 'retry-after': '3' }) }), 3000)
  assert.equal(retryAfterMs({}), undefined)
  assert.equal(retryAfterMs(new Error('x')), undefined)
  assert.equal(retryAfterMs(null), undefined)
})

test('retryAfterMs parses an HTTP-date', () => {
  const d = retryAfterMs({ headers: { 'retry-after': new Date(Date.now() + 5000).toUTCString() } })
  assert.ok(d !== undefined && d > 0 && d <= 6000)
})

test('nextRetryDelayMs prefers Retry-After, capped by maxDelayMs', () => {
  assert.equal(
    nextRetryDelayMs(0, { baseDelayMs: 100, jitter: false }, { headers: { 'retry-after': '2' } }),
    2000,
  )
  assert.equal(
    nextRetryDelayMs(5, { maxDelayMs: 1000, jitter: false }, { headers: { 'retry-after': '60' } }),
    1000, // 60s capped to maxDelayMs
  )
  assert.equal(
    nextRetryDelayMs(
      0,
      { baseDelayMs: 100, jitter: false, respectRetryAfter: false },
      { headers: { 'retry-after': '2' } },
    ),
    100, // ignores Retry-After
  )
})
