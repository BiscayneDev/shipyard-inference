import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import type { RouterEvent } from '../src/index.js'
import type { TelemetryReporter } from '../src/operator/reporter.js'
import { candidate, model, staticProvider } from './helpers.js'

/** A reporter stub that records the RouterEvents the gateway forwards to it. */
function recordingReporter(): TelemetryReporter & { events: RouterEvent[] } {
  const events: RouterEvent[] = []
  return {
    events,
    onEvent: (event) => events.push(event),
    recordSettlement: () => {},
    flush: async () => {},
    close: async () => {},
  }
}

function appWith(reporter: TelemetryReporter) {
  return createGatewayApp({
    candidates: [
      candidate('c', staticProvider('hello'), [
        model('m', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
      ]),
    ],
    apiKeys: ['secret'],
    telemetry: reporter,
  })
}

const auth = { authorization: 'Bearer secret', 'content-type': 'application/json' }

test('gateway forwards routing telemetry to the configured reporter', async () => {
  const reporter = recordingReporter()
  const res = await appWith(reporter).request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200)

  // The whole request lifecycle reaches the reporter, not just the final event.
  assert.ok(reporter.events.length > 0, 'expected the reporter to receive events')
  assert.ok(
    reporter.events.some((e) => e.type === 'route_selected'),
    'expected a route_selected event',
  )
  const completed = reporter.events.find((e) => e.type === 'request_completed')
  assert.ok(completed, 'expected a request_completed event')
  assert.equal(completed.candidateId, 'c')
  assert.equal(completed.model, 'm')
})

test('OpenAI `user` field is attributed as userId on completed telemetry', async () => {
  const reporter = recordingReporter()
  await appWith(reporter).request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      user: 'tenant-42',
    }),
  })
  const completed = reporter.events.find((e) => e.type === 'request_completed')
  assert.ok(completed, 'expected a request_completed event')
  assert.equal(completed.userId, 'tenant-42')
})

test('telemetry is optional — a gateway with no reporter still serves requests', async () => {
  const app = createGatewayApp({
    candidates: [candidate('c', staticProvider('hello'), [model('m')])],
    apiKeys: ['secret'],
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 200)
})
