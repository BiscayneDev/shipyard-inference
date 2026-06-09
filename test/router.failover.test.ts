import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Router, withFailover, NoCapableModelError } from '../src/index.js'
import {
  candidate,
  chatParams,
  model,
  staticProvider,
  throwingProvider,
} from './helpers.js'

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

test('retryable error (429) fails over to the next candidate', async () => {
  const primary = candidate('primary', throwingProvider(httpError(429)), [model('pm')])
  const fallback = candidate('fallback', staticProvider('from-fallback'), [model('fm')])

  const router = withFailover(primary, fallback)
  const res = await router.chat(chatParams())

  assert.equal(res.content, 'from-fallback')
})

test('non-retryable error (400) propagates without failover', async () => {
  const primary = candidate('primary', throwingProvider(httpError(400)), [model('pm')])
  const fallback = candidate('fallback', staticProvider('unused'), [model('fm')])

  const router = withFailover(primary, fallback)
  await assert.rejects(() => router.chat(chatParams()), /HTTP 400/)
  assert.equal((fallback.provider as { calls: unknown[] }).calls.length, 0)
})

test('emits failover and route events through onEvent', async () => {
  const events: string[] = []
  const primary = candidate('primary', throwingProvider(httpError(503)), [model('pm')])
  const fallback = candidate('fallback', staticProvider('ok'), [model('fm')])

  const router = new Router({
    candidates: [primary, fallback],
    strategy: (await import('../src/index.js')).failover(['primary', 'fallback']),
    onEvent: (e) => events.push(e.type),
  })
  await router.chat(chatParams())

  assert.ok(events.includes('failover'))
  assert.ok(events.includes('route_success'))
})

test('over-constrained hints throw NoCapableModelError', async () => {
  const only = candidate('only', staticProvider('x'), [
    model('m', { tier: 'economy', capabilities: [] }),
  ])
  const router = new Router({ candidates: [only] })

  await assert.rejects(
    () => router.chat(chatParams({ routingHints: { tier: 'frontier' } })),
    NoCapableModelError,
  )
})
