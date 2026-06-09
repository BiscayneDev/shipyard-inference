import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import type { LLMStreamEvent } from '../src/index.js'
import { candidate, model, streamingProvider } from './helpers.js'

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
