import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import { createHopscotchProvider } from '../src/providers/hopscotch.js'
import { AnthropicProvider, toAnthropicImage } from '../src/providers/anthropic.js'
import { openAIRequestToChatParams } from '../src/openai-compat/messages.js'
import { candidate, mockProvider, model } from './helpers.js'

// Images sent in OpenAI content-part shape must survive the gateway and reach
// the upstream provider as real image parts, not get flattened to text.

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const imageRequest = (modelId: string) => ({
  model: modelId,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'what is in this photo?' },
        { type: 'image_url', image_url: { url: PIXEL } },
        { type: 'image_url', image_url: { url: 'https://example.com/cat.jpg', detail: 'low' } },
      ],
    },
  ],
})

/** fetch stub that records each upstream JSON body and answers with `reply`. */
function capturingFetch(reply: unknown) {
  const bodies: any[] = []
  const f = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { f, bodies }
}

async function post(app: ReturnType<typeof createGatewayApp>, body: unknown) {
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  assert.equal(res.status, 200, await res.clone().text())
  return res
}

test('parser keeps image_url parts alongside the flattened text', () => {
  const params = openAIRequestToChatParams(imageRequest('x') as any)
  const user = params.messages[0]!
  assert.equal(user.content, 'what is in this photo?')
  assert.deepEqual(user.images, [{ url: PIXEL }, { url: 'https://example.com/cat.jpg', detail: 'low' }])
})

test('text-only content arrays still produce plain text with no images', () => {
  const params = openAIRequestToChatParams({ model: 'x', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] } as any)
  assert.equal(params.messages[0]!.content, 'hi')
  assert.equal(params.messages[0]!.images, undefined)
})

test('image survives the gateway to Hopscotch as OpenAI image_url parts', async () => {
  const { f, bodies } = capturingFetch({
    id: 'c1', object: 'chat.completion', created: 0, model: 'anthropic/claude-haiku-4-5-20251001',
    choices: [{ index: 0, message: { role: 'assistant', content: 'a pixel' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
  })
  const provider = createHopscotchProvider({ apiKey: 'test', fetch: f })
  const app = createGatewayApp({
    candidates: [candidate('hopscotch', provider, [model('anthropic/claude-haiku-4-5-20251001')])],
    apiKeys: ['k'],
  })
  const res = await post(app, imageRequest('anthropic/claude-haiku-4-5-20251001'))
  const out = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  assert.equal(out.choices[0]!.message.content, 'a pixel')

  assert.equal(bodies.length, 1)
  const user = bodies[0].messages.find((m: any) => m.role === 'user')
  assert.deepEqual(user.content, [
    { type: 'text', text: 'what is in this photo?' },
    { type: 'image_url', image_url: { url: PIXEL } },
    { type: 'image_url', image_url: { url: 'https://example.com/cat.jpg', detail: 'low' } },
  ])
})

test('image survives the gateway to Anthropic as image blocks', async () => {
  const { f, bodies } = capturingFetch({
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-4-5',
    content: [{ type: 'text', text: 'a pixel' }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 2 },
  })
  const provider = new AnthropicProvider({ apiKey: 'test', fetch: f })
  const app = createGatewayApp({
    candidates: [candidate('anthropic', provider, [model('claude-haiku-4-5')])],
    apiKeys: ['k'],
  })
  await post(app, imageRequest('claude-haiku-4-5'))
  assert.equal(bodies.length, 1)
  const user = bodies[0].messages.find((m: any) => m.role === 'user')
  assert.deepEqual(user.content, [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PIXEL.split(',')[1] } },
    { type: 'image', source: { type: 'url', url: 'https://example.com/cat.jpg' } },
    { type: 'text', text: 'what is in this photo?' },
  ])
})

test('toAnthropicImage maps data URIs and URLs', () => {
  assert.deepEqual(toAnthropicImage({ url: 'data:image/jpeg;base64,AAAA' }), {
    type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' },
  })
  assert.deepEqual(toAnthropicImage({ url: 'https://x.test/a.png' }), {
    type: 'image', source: { type: 'url', url: 'https://x.test/a.png' },
  })
})

test('Anthropic-shape inbound image blocks reach the provider as images', async () => {
  const p = mockProvider(async () => ({ content: 'ok', toolCalls: [], stopReason: 'end_turn' as const }))
  const app = createGatewayApp({ candidates: [candidate('m', p, [model('m1')])], apiKeys: ['k'] })
  const res = await app.request('/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': 'k', authorization: 'Bearer k', 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'm1', max_tokens: 50,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
        { type: 'text', text: 'describe' },
      ] }],
    }),
  })
  assert.equal(res.status, 200, await res.clone().text())
  const user = p.calls[0]!.messages.find((m) => m.role === 'user')!
  assert.equal(user.content, 'describe')
  assert.deepEqual(user.images, [{ url: 'data:image/png;base64,QUJD' }])
})
