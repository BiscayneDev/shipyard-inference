import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AnthropicProvider } from '../src/index.js'

const anthropicMessage = {
  id: 'm',
  type: 'message',
  role: 'assistant',
  model: 'claude',
  content: [{ type: 'text', text: 'ok' }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
}

/** Capture the JSON body the Anthropic SDK POSTs, returning a canned message. */
function capturingFetch(): { fetch: typeof fetch; body: () => any } {
  let captured: any
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    captured = init?.body ? JSON.parse(String(init.body)) : undefined
    return new Response(JSON.stringify(anthropicMessage), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { fetch: fetchImpl, body: () => captured }
}

const params = {
  system: 'You are a helpful assistant with a large stable system prompt.',
  messages: [{ role: 'user' as const, content: 'hi' }],
  tools: [
    { name: 'a', description: 'tool a', inputSchema: { type: 'object' } },
    { name: 'b', description: 'tool b', inputSchema: { type: 'object' } },
  ],
}

test('prompt caching (default) marks system and the last tool with cache_control', async () => {
  const cap = capturingFetch()
  const provider = new AnthropicProvider({ apiKey: 'x', fetch: cap.fetch })
  await provider.chat(params)

  const body = cap.body()
  // system became a text block array carrying the cache breakpoint
  assert.equal(body.system[0].cache_control.type, 'ephemeral')
  assert.equal(body.system[0].text, params.system)
  // breakpoint on the LAST tool (caches the whole tools prefix); not the first
  assert.equal(body.tools[0].cache_control, undefined)
  assert.equal(body.tools[1].cache_control.type, 'ephemeral')
})

test('promptCaching:false leaves the request uncached (system stays a string)', async () => {
  const cap = capturingFetch()
  const provider = new AnthropicProvider({ apiKey: 'x', fetch: cap.fetch, promptCaching: false })
  await provider.chat(params)

  const body = cap.body()
  assert.equal(body.system, params.system)
  assert.equal(body.tools[1].cache_control, undefined)
})
