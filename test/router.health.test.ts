import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ProviderHealthTracker } from '../src/router/health.js'
import { Router } from '../src/index.js'
import { candidate, chatParams, model, staticProvider, throwingProvider } from './helpers.js'

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

test('opens circuit after 3 consecutive failures and closes after cooldown', async () => {
  const t = new ProviderHealthTracker({ failureThreshold: 3, cooldownMs: 50 })
  const id = 'ollama-local'
  t.recordFailure(id)
  t.recordFailure(id)
  assert.equal(t.isAvailable(id), true)
  t.recordFailure(id)
  assert.equal(t.isAvailable(id), false) // circuit open
  t.recordSuccess(id) // ignored while open
  assert.equal(t.isAvailable(id), false)
  await new Promise((r) => setTimeout(r, 60))
  assert.equal(t.isAvailable(id), true) // half-open after cooldown
})

test('consecutive failures reset on success', () => {
  const t = new ProviderHealthTracker({ failureThreshold: 2, cooldownMs: 1000 })
  t.recordFailure('a')
  t.recordSuccess('a')
  t.recordFailure('a')
  assert.equal(t.isAvailable('a'), true) // only 1 consecutive, threshold is 2
})

test('failure while half-open re-opens the circuit', async () => {
  const t = new ProviderHealthTracker({ failureThreshold: 1, cooldownMs: 30 })
  t.recordFailure('a')
  assert.equal(t.isAvailable('a'), false)
  await new Promise((r) => setTimeout(r, 40))
  assert.equal(t.isAvailable('a'), true) // half-open probe allowed
  t.recordFailure('a')
  assert.equal(t.isAvailable('a'), false) // re-opened
})

test('unknown providers are always available', () => {
  const t = new ProviderHealthTracker()
  assert.equal(t.isAvailable('never-seen'), true)
})

test('Router skips circuit-open candidates during selection', async () => {
  // flaky throws 429 (retryable) so each request fails over to solid and
  // records exactly one flaky failure; two requests open the circuit.
  const flaky = candidate('flaky', throwingProvider(httpError(429)), [model('fm')])
  const solid = candidate('solid', staticProvider('ok'), [model('sm')])

  const health = new ProviderHealthTracker({ failureThreshold: 2, cooldownMs: 60_000 })
  const warmup = new Router({ candidates: [flaky, solid], health })
  for (let i = 0; i < 2; i++) {
    await warmup.chat(chatParams())
  }
  assert.equal(health.isAvailable('flaky'), false, 'circuit open after 2 recorded failures')

  // Third request: flaky is skipped entirely — solid serves it on attempt 0.
  const events: Array<{ type: string; candidateId?: string }> = []
  const router = new Router({
    candidates: [flaky, solid],
    health,
    onEvent: (e) => events.push({ type: e.type, candidateId: (e as { candidateId?: string }).candidateId }),
  })
  const res = await router.chat(chatParams())
  assert.equal(res.content, 'ok')
  const selected = events.filter((e) => e.type === 'route_selected')
  assert.deepEqual(selected.map((e) => e.candidateId), ['solid'])
})
