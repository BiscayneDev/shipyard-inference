import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import { candidate, model, staticProvider, throwingProvider } from './helpers.js'

const auth = {
  authorization: 'Bearer k',
  'content-type': 'application/json',
}

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

/** Parse an SSE body into raw data strings and parsed JSON chunks. */
function parseSSE(body: string): { datas: string[]; chunks: Array<Record<string, unknown>> } {
  const datas = body
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => l.slice(6).trim())
  const chunks = datas
    .filter((d) => d !== '[DONE]')
    .map((d) => JSON.parse(d) as Record<string, unknown>)
  return { datas, chunks }
}

test('x_shipyard telemetry includes a failover receipt after a provider 429', async () => {
  // flaky throws a retryable 429 at request start; solid serves the stream.
  const flaky = candidate('flaky-primary', throwingProvider(httpError(429)), [
    model('fm', { inputCostPerMTok: 0.1, outputCostPerMTok: 0.1 }),
  ])
  const solid = candidate('solid-fallback', staticProvider('ok'), [
    model('sm', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
  ])

  const app = createGatewayApp({ candidates: [flaky, solid], apiKeys: ['k'] })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      // 'auto' (not an explicit model id) lets the strategy route — required
      // for cross-candidate failover; explicit models pin to one candidate.
      model: 'auto',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    }),
  })
  assert.equal(res.status, 200)
  const { chunks } = parseSSE(await res.text())

  const trailer = chunks.find((c) => c.x_shipyard !== undefined)
  assert.ok(trailer, 'expected an x_shipyard trailer chunk')
  // The trailer must still be a valid OpenAI chunk shape.
  assert.equal(trailer.object, 'chat.completion.chunk')
  assert.ok(Array.isArray(trailer.choices))
  const receipt = trailer.x_shipyard as {
    provider?: string
    failover?: { from?: string; to?: string; reason?: string }
  }
  assert.ok(receipt.failover, 'expected receipt.failover on the trailer')
  assert.equal(receipt.failover!.from, 'flaky-primary')
  assert.equal(receipt.failover!.to, 'solid-fallback')
  assert.equal(receipt.failover!.reason, 'rate_limited')
})

test('no failover receipt when the primary serves cleanly', async () => {
  const app = createGatewayApp({
    candidates: [candidate('c', staticProvider('hello'), [model('m')])],
    apiKeys: ['k'],
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    }),
  })
  assert.equal(res.status, 200)
  const { chunks } = parseSSE(await res.text())
  // No chunk may carry a failover receipt when nothing failed over.
  const anyFailover = chunks.some(
    (c) => (c.x_shipyard as { failover?: unknown } | undefined)?.failover !== undefined,
  )
  assert.ok(!anyFailover, 'did not expect a failover receipt')
})
