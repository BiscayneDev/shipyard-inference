import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyOutcome } from '../src/router/outcome.ts'

test('pre-flight rejection when router plan produced no candidates', () => {
  assert.equal(
    classifyOutcome({ attempted: 0, tokensEmitted: false }),
    'rejected_pre_flight',
  )
})

test('truncated when first token flushed then upstream broke', () => {
  assert.equal(
    classifyOutcome({ attempted: 1, tokensEmitted: true, clientAborted: false, completed: false }),
    'truncated',
  )
})

test('client abort excluded from error classification', () => {
  assert.equal(
    classifyOutcome({ attempted: 1, tokensEmitted: true, clientAborted: true, completed: false }),
    'client_abort',
  )
})

test('pre-token client abort classifies as client_abort, not provider_error', () => {
  // Disconnect after route_selected but before the first delta: attempted>0,
  // nothing billable emitted, no completion — the caller walked away, so this
  // must not inflate the provider error rate.
  assert.equal(
    classifyOutcome({ attempted: 1, tokensEmitted: false, clientAborted: true, completed: false }),
    'client_abort',
  )
})

test('ok on clean completion', () => {
  assert.equal(
    classifyOutcome({ attempted: 1, tokensEmitted: true, clientAborted: false, completed: true }),
    'ok',
  )
})

test('provider_error when a provider was attempted but nothing was emitted', () => {
  assert.equal(
    classifyOutcome({ attempted: 2, tokensEmitted: false, clientAborted: false, completed: false }),
    'provider_error',
  )
})
