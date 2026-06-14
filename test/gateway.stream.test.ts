import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import type { LLMStreamEvent, LLMProvider } from '../src/index.js'
import { GatewayTender, MemoryCreditStore, type Campaign } from '../src/tender/index.js'
import { candidate, model, streamingProvider } from './helpers.js'

/** A provider whose stream pauses `delayMs` before the final `done` event — so a
 * turn's total duration can be driven across the Tender wait threshold. */
function delayingProvider(delayMs: number): LLMProvider {
  const events: LLMStreamEvent[] = [
    { type: 'text_delta', text: 'Hi' },
    {
      type: 'done',
      response: { content: 'Hi', toolCalls: [], stopReason: 'end_turn', usage: { inputTokens: 5, outputTokens: 1 } },
    },
  ]
  return {
    async chat() {
      return { content: 'Hi', toolCalls: [], stopReason: 'end_turn' }
    },
    async *chatStream() {
      yield events[0]!
      await new Promise((r) => setTimeout(r, delayMs))
      yield events[1]!
    },
  }
}

function houseCampaign(): Campaign {
  return {
    campaignId: 'test-house',
    placementId: 'test-house',
    advertiserWallet: 'TenderHouse',
    endpointUrl: 'https://example.com/x402/thing',
    line: '🛰️  Sponsored — ship to prod over x402',
    usdcPerImpression: 0.005,
    remainingImpressions: 1000,
    fundedUsdc: 5,
    targeting: {},
  }
}

function parseSSE(text: string): { datas: string[]; chunks: Record<string, unknown>[] } {
  const datas = text
    .split('\n\n')
    .map((block) =>
      block
        .split('\n')
        .filter((l) => l.startsWith('data: '))
        .map((l) => l.slice('data: '.length))
        .join(''),
    )
    .filter((d) => d.length > 0)
  const chunks = datas
    .filter((d) => d !== '[DONE]')
    .map((d) => JSON.parse(d) as Record<string, unknown>)
  return { datas, chunks }
}

test('streaming completion emits SSE chunks, usage, x_shipyard trailer, and [DONE]', async () => {
  const events: LLMStreamEvent[] = [
    { type: 'text_delta', text: 'Hi' },
    { type: 'text_delta', text: ' there' },
    {
      type: 'done',
      response: {
        content: 'Hi there',
        toolCalls: [],
        stopReason: 'end_turn',
        usage: { inputTokens: 5, outputTokens: 2 },
      },
    },
  ]
  const app = createGatewayApp({
    candidates: [
      candidate('c', streamingProvider(events), [
        model('m', { inputCostPerMTok: 1, outputCostPerMTok: 1 }),
      ]),
    ],
    apiKeys: ['k'],
  })

  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
      stream_options: { include_usage: true },
    }),
  })

  assert.ok(res.headers.get('content-type')?.includes('text/event-stream'))
  const { datas, chunks } = parseSSE(await res.text())

  assert.ok(datas.includes('[DONE]'), 'terminates with [DONE]')

  const text = chunks
    .map((c) => {
      const choices = c.choices as Array<{ delta?: { content?: string } }> | undefined
      return choices?.[0]?.delta?.content ?? ''
    })
    .join('')
  assert.equal(text, 'Hi there')

  assert.ok(
    chunks.some((c) => (c.usage as { completion_tokens?: number } | undefined)?.completion_tokens === 2),
    'includes a usage chunk',
  )
  assert.ok(
    chunks.some((c) => (c.x_shipyard as { provider?: string } | undefined)?.provider === 'c'),
    'includes the x_shipyard trailer',
  )
})

async function streamThrough(tender: GatewayTender, delayMs: number): Promise<void> {
  const app = createGatewayApp({
    candidates: [
      candidate('c', delayingProvider(delayMs), [model('m', { inputCostPerMTok: 1, outputCostPerMTok: 1 })]),
    ],
    apiKeys: ['k'],
    keyStore: {
      // Attribute the request to a fixed account so Tender can accrue to it.
      async resolve() {
        return { userId: 'u_test', label: 't' }
      },
      async issue() {
        return { key: 'sk-shipyard-test', userId: 'u_test', wallet: null }
      },
    },
    tender,
  })
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer sk-shipyard-test', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }], stream: true }),
  })
  await res.text() // drain the stream so `finish()` runs
}

test('tender: a turn past minWaitMs serves a placement and accrues a kickback', async () => {
  const tender = new GatewayTender({
    campaigns: [houseCampaign()],
    minWaitMs: 20,
    creditStore: new MemoryCreditStore(),
  })
  await streamThrough(tender, 60) // total turn ≫ 20ms → qualifies

  assert.ok((await tender.balance('u_test')) > 0, 'kickback accrued for a real wait')
  assert.equal(
    await tender.currentLine('u_test'),
    '🛰️  Sponsored — ship to prod over x402',
    'the served sponsored line is remembered for the status line',
  )
})

test('tender: a sub-threshold turn serves nothing and bills nothing', async () => {
  const tender = new GatewayTender({
    campaigns: [houseCampaign()],
    minWaitMs: 500,
    creditStore: new MemoryCreditStore(),
  })
  await streamThrough(tender, 5) // total turn well under 500ms → no placement

  assert.equal(await tender.balance('u_test'), 0, 'a sub-perceptual turn accrues nothing')
  assert.equal(await tender.currentLine('u_test'), undefined, 'no sponsored line served')
})
