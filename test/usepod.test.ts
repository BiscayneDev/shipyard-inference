import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerUsePod, usePodBalance, createUsePodProvider } from '../src/index.js'
import { chatParams } from './helpers.js'

function jsonFetch(body: unknown, capture?: (url: string, init?: RequestInit) => void): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    capture?.(String(url), init)
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

test('registerUsePod returns the token and deposit code (live `api_token` shape)', async () => {
  const calls: string[] = []
  const account = await registerUsePod({
    fetch: jsonFetch({ api_token: 'tok-123', deposit_code: 'deadbeefdeadbeef' }, (u) => calls.push(u)),
  })
  assert.deepEqual(account, { token: 'tok-123', depositCode: 'deadbeefdeadbeef' })
  assert.ok(calls[0]?.endsWith('/v1/register'))
})

test('registerUsePod also accepts a bare `token` field', async () => {
  const account = await registerUsePod({
    fetch: jsonFetch({ token: 'tok-legacy', deposit_code: 'deadbeefdeadbeef' }),
  })
  assert.deepEqual(account, { token: 'tok-legacy', depositCode: 'deadbeefdeadbeef' })
})

test('usePodBalance converts microunits to USDC', async () => {
  const balance = await usePodBalance('tok-123', {
    fetch: jsonFetch({ usdc_balance: 2_500_000 }, () => {}),
  })
  assert.deepEqual(balance, { usdcMicros: 2_500_000, usdc: 2.5 })
})

const openaiCompletion = {
  id: 'c',
  object: 'chat.completion',
  created: 0,
  model: 'gpt-5.5',
  choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
}

test('createUsePodProvider (openai) targets /proxy/<token>/v1 and sends spend-cap headers', async () => {
  let captured: { url: string; headers: Headers } | undefined
  const fetchImpl = jsonFetch(openaiCompletion, (url, init) => {
    captured = { url, headers: new Headers(init?.headers) }
  })

  const provider = createUsePodProvider({
    token: 'tok',
    family: 'openai',
    fetch: fetchImpl,
    maxPriceInput: 400000,
    maxPriceOutput: 600000,
  })
  const res = await provider.chat(chatParams())

  assert.equal(res.content, 'ok')
  assert.ok(captured?.url.includes('/proxy/tok/v1/chat/completions'), captured?.url)
  assert.ok(!captured?.url.includes('/v1/v1'), 'no doubled /v1')
  assert.equal(captured?.headers.get('x-pod-max-price-input'), '400000')
  assert.equal(captured?.headers.get('x-pod-max-price-output'), '600000')
})

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

test('createUsePodProvider (anthropic) keeps the base at /proxy/<token>', async () => {
  let url = ''
  const provider = createUsePodProvider({
    token: 'tok',
    family: 'anthropic',
    fetch: jsonFetch(anthropicMessage, (u) => (url = u)),
  })
  await provider.chat(chatParams())
  assert.ok(url.includes('/proxy/tok/v1/messages'), url)
})
