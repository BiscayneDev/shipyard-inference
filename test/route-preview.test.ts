import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayApp } from '../src/gateway/index.js'
import type { GatewayConfig } from '../src/gateway/index.js'
import { MemorySpendTracker } from '../src/gateway/spend.js'
import { RoutePreviewLimiter } from '../src/gateway/route-preview.js'
import { candidate, mockProvider, model } from './helpers.js'
import type { RouterEvent } from '../src/router/router.js'

/**
 * Three priced rungs. Each provider answers with its own model id, so the chat
 * response body names the model that actually served the request.
 */
function rig(over: Partial<GatewayConfig> = {}) {
  const calls: string[] = []
  const serve = (id: string) =>
    mockProvider(() => {
      calls.push(id)
      return { content: id, toolCalls: [], stopReason: 'end_turn' as const, usage: { inputTokens: 100, outputTokens: 50 } }
    })
  const events: RouterEvent[] = []
  const config: GatewayConfig = {
    candidates: [
      candidate('eco', serve('eco-m'), [model('eco-m', { inputCostPerMTok: 0.2, outputCostPerMTok: 0.8, tier: 'economy', capabilities: ['tools'] })]),
      candidate('std', serve('std-m'), [model('std-m', { inputCostPerMTok: 1, outputCostPerMTok: 4, tier: 'standard', capabilities: ['tools'] })]),
      candidate('fr', serve('fr-m'), [model('fr-m', { inputCostPerMTok: 5, outputCostPerMTok: 25, tier: 'frontier', capabilities: ['tools'] })]),
    ],
    apiKeys: ['k'],
    // Deterministic stand-in for Jev: judges the latest user message.
    autoTier: (params) => {
      const last = [...params.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
      if (/research/i.test(last)) return { tier: 'frontier', source: 'jev', confidence: 0.9 } as never
      if (/refactor|function/i.test(last)) return { tier: 'standard', source: 'jev', confidence: 0.8 } as never
      if (/synthesi/i.test(last)) return { tier: 'frontier', source: 'jev', confidence: 0.5 } as never
      if (/nightly|index/i.test(last)) return { tier: 'standard', source: 'jev', confidence: 0.9 } as never
      if (/^ok$/i.test(last.trim())) return { tier: 'frontier', source: 'jev', confidence: 0.5 } as never
      return { tier: 'economy', source: 'jev', confidence: 0.95 } as never
    },
    onEvent: (e) => events.push(e),
    ...over,
  }
  return { gw: createGatewayApp(config), config, calls, events }
}

const AUTH = { authorization: 'Bearer k', 'content-type': 'application/json' }
const TOOLS = [{ type: 'function', function: { name: 'run', parameters: { type: 'object' } } }]

type Case = { name: string; text: string; headers?: Record<string, string>; tools?: boolean }
const CASES: Case[] = [
  { name: 'casual', text: 'hi there, thanks' },
  { name: 'research', text: 'research the latest on solar tariffs', headers: { 'x-dinghy-task-class': 'research' } },
  { name: 'coding', text: 'refactor this function to be async', tools: true },
  { name: 'synthesize', text: 'synthesize these notes into a summary', headers: { 'x-dinghy-task-class': 'synthesize' } },
  { name: 'background', text: 'nightly index rebuild', headers: { 'x-dinghy-task-class': 'background' } },
  { name: 'low-confidence chat', text: 'ok', headers: { 'x-dinghy-task-class': 'chat' } },
]

const bodyOf = (c: Case, extra: Record<string, unknown> = {}) => ({
  model: 'auto',
  messages: [{ role: 'user', content: c.text }],
  ...(c.tools ? { tools: TOOLS } : {}),
  ...extra,
})

test('equality: preview picks exactly what the chat path picks, for representative prompts', async () => {
  const { gw } = rig()
  const servedModels = new Set<string>()
  for (const c of CASES) {
    const headers = { ...AUTH, ...(c.headers ?? {}) }
    const chat = await gw.request('/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(bodyOf(c)) })
    assert.equal(chat.status, 200, `${c.name}: chat should succeed`)
    const chatBody = (await chat.json()) as { choices: Array<{ message: { content: string } }> }
    const preview = await gw.request('/v1/route', { method: 'POST', headers, body: JSON.stringify(bodyOf(c)) })
    assert.equal(preview.status, 200, `${c.name}: preview should succeed`)
    const p = (await preview.json()) as Record<string, unknown>

    // The model that actually served the chat call is the one the preview named.
    assert.equal(chatBody.choices[0]!.message.content, p.model, `${c.name}: model`)
    servedModels.add(String(p.model))
    assert.equal(chat.headers.get('x-shipyard-model'), p.model, `${c.name}: header model`)
    assert.equal(chat.headers.get('x-shipyard-provider'), p.provider, `${c.name}: provider`)
    assert.equal(chat.headers.get('x-shipyard-tier'), p.tier, `${c.name}: tier`)
    assert.equal(chat.headers.get('x-shipyard-tier-source'), p.tier_source, `${c.name}: tier source`)
    assert.equal(chat.headers.get('x-shipyard-tier-decided'), p.clamped ? p.tier_decided : null, `${c.name}: decided`)
    assert.equal(chat.headers.get('x-shipyard-jev-confidence'), p.jev_confidence == null ? null : String(p.jev_confidence), `${c.name}: confidence`)
  }
  // Guard against a degenerate set: the prompts must span economy, standard and frontier.
  assert.equal(servedModels.size, 3)
})

test('equality: the clamp case is actually exercised (decided tier differs from served tier)', async () => {
  const { gw } = rig()
  const synth = CASES.find((c) => c.name === 'synthesize')!
  const p = (await (
    await gw.request('/v1/route', { method: 'POST', headers: { ...AUTH, ...synth.headers }, body: JSON.stringify(bodyOf(synth)) })
  ).json()) as Record<string, unknown>
  assert.equal(p.clamped, true)
  assert.equal(p.tier_decided, 'frontier')
  assert.equal(p.tier, 'standard')
  assert.equal(p.model, 'std-m')
})

test('no spend: preview calls no model, records no spend, emits no events; chat still records', async () => {
  const tracker = new MemorySpendTracker({ defaultCeilingUsd: 100 })
  let recorded = 0
  const realRecord = tracker.record.bind(tracker)
  tracker.record = (k: string, c: number) => {
    recorded++
    realRecord(k, c)
  }
  let usageRecords = 0
  const { gw, calls, events } = rig({
    spend: { tracker },
    usageRecorder: { record: () => void usageRecords++ },
  })
  const headers = { ...AUTH, 'x-dinghy-task-class': 'research' }
  const research = CASES.find((c) => c.name === 'research')!
  for (let i = 0; i < 3; i++) {
    const res = await gw.request('/v1/route', { method: 'POST', headers, body: JSON.stringify(bodyOf(research)) })
    assert.equal(res.status, 200)
  }
  assert.deepEqual(calls, [], 'no model was called')
  assert.equal(recorded, 0, 'no spend recorded')
  assert.equal(usageRecords, 0, 'no usage recorded')
  assert.equal(events.length, 0, 'no router events emitted')
  assert.equal(tracker.spent('k'), 0)

  // Positive control: the same request through chat does record spend.
  const chat = await gw.request('/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(bodyOf(research)) })
  assert.equal(chat.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(recorded, 1, 'chat records exactly one spend entry')
  assert.ok(tracker.spent('k') > 0)
})

test('auth: no key and wrong key are refused with 401 and call no model', async () => {
  const { gw, calls } = rig()
  const body = JSON.stringify(bodyOf(CASES[0]!))
  const none = await gw.request('/v1/route', { method: 'POST', headers: { 'content-type': 'application/json' }, body })
  assert.equal(none.status, 401)
  const wrong = await gw.request('/v1/route', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer nope' },
    body,
  })
  assert.equal(wrong.status, 401)
  assert.equal(((await none.json()) as { error: { type: string } }).error.type, 'authentication_error')
  assert.deepEqual(calls, [])
})

test('malformed body: non-JSON, missing messages, and non-string model are 400', async () => {
  const { gw } = rig()
  const post = (body: string) => gw.request('/v1/route', { method: 'POST', headers: AUTH, body })
  assert.equal((await post('{not json')).status, 400)
  assert.equal((await post(JSON.stringify({ model: 'auto' }))).status, 400)
  assert.equal((await post(JSON.stringify({ model: 'auto', messages: 'hi' }))).status, 400)
  assert.equal((await post(JSON.stringify({ model: 7, messages: [] }))).status, 400)
})

test('no routable model: constraints that no candidate meets return 422 (chat would fail the same way)', async () => {
  // Tools in the request, but no candidate advertises the tools capability.
  const { gw } = rig({
    candidates: [candidate('txt', mockProvider(() => ({ content: 'x', toolCalls: [], stopReason: 'end_turn' })), [model('txt-m', { capabilities: [] })])],
    autoTier: undefined,
  })
  const body = JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'run it' }], tools: TOOLS })
  const preview = await gw.request('/v1/route', { method: 'POST', headers: AUTH, body })
  assert.equal(preview.status, 422)
  assert.equal(((await preview.json()) as { error: { type: string } }).error.type, 'no_capable_model')
  const chat = await gw.request('/v1/chat/completions', { method: 'POST', headers: AUTH, body })
  assert.notEqual(chat.status, 200)
})

test('estimated cost matches the chosen model’s declared pricing (max_tokens and default cap)', async () => {
  const { gw } = rig({
    candidates: [
      candidate('priced', mockProvider(() => ({ content: 'p', toolCalls: [], stopReason: 'end_turn' })), [
        model('priced-m', { inputCostPerMTok: 2, outputCostPerMTok: 8, tier: 'standard', capabilities: ['tools'] }),
      ]),
    ],
    autoTier: undefined,
  })
  const content = 'x'.repeat(400) // 400 chars at ~4 chars/token = 100 input tokens
  const withCap = (await (
    await gw.request('/v1/route', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content }], max_tokens: 1000 }),
    })
  ).json()) as { estimated_cost_usd: number; estimate_basis: string; model: string }
  // 100 * $2/MTok + 1000 * $8/MTok
  assert.equal(withCap.model, 'priced-m')
  assert.ok(Math.abs(withCap.estimated_cost_usd - (100 * 2 + 1000 * 8) / 1e6) < 1e-12)
  assert.match(withCap.estimate_basis, /\$2\/MTok/)
  assert.match(withCap.estimate_basis, /\$8\/MTok/)

  const noCap = (await (
    await gw.request('/v1/route', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content }] }),
    })
  ).json()) as { estimated_cost_usd: number; estimate_basis: string }
  // Default output cap 4096 when max_tokens is unset.
  assert.ok(Math.abs(noCap.estimated_cost_usd - (100 * 2 + 4096 * 8) / 1e6) < 1e-12)
  assert.match(noCap.estimate_basis, /assumed/)
})

test('unpriced chosen model reports null cost, never a fabricated $0', async () => {
  const { gw } = rig({
    candidates: [candidate('bare', mockProvider(() => ({ content: 'b', toolCalls: [], stopReason: 'end_turn' })), [model('bare-m', { inputCostPerMTok: Infinity, outputCostPerMTok: Infinity })])],
    autoTier: undefined,
  })
  const res = (await (
    await gw.request('/v1/route', { method: 'POST', headers: AUTH, body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'hi' }] }) })
  ).json()) as { estimated_cost_usd: unknown; estimate_basis: string }
  assert.equal(res.estimated_cost_usd, null)
  assert.match(res.estimate_basis, /No declared pricing/)
})

test('rate limit: per-key window refuses the request over the limit with 429 and Retry-After', async () => {
  const { gw } = rig({ routePreviewPerMinute: 2 })
  const body = JSON.stringify(bodyOf(CASES[0]!))
  assert.equal((await gw.request('/v1/route', { method: 'POST', headers: AUTH, body })).status, 200)
  assert.equal((await gw.request('/v1/route', { method: 'POST', headers: AUTH, body })).status, 200)
  const third = await gw.request('/v1/route', { method: 'POST', headers: AUTH, body })
  assert.equal(third.status, 429)
  assert.ok(Number(third.headers.get('retry-after')) >= 1)
})

test('limiter unit: windows reset after a minute and keys are independent', () => {
  let t = 0
  const lim = new RoutePreviewLimiter(1, () => t)
  assert.equal(lim.take('a'), undefined)
  assert.notEqual(lim.take('a'), undefined)
  assert.equal(lim.take('b'), undefined)
  t = 60_000
  assert.equal(lim.take('a'), undefined)
})

test('route ids are opaque and unique per preview', async () => {
  const { gw } = rig()
  const ids = new Set<string>()
  for (let i = 0; i < 5; i++) {
    const p = (await (await gw.request('/v1/route', { method: 'POST', headers: AUTH, body: JSON.stringify(bodyOf(CASES[0]!)) })).json()) as { route_id: string }
    assert.match(p.route_id, /^rte_[0-9a-f]{18}$/)
    ids.add(p.route_id)
  }
  assert.equal(ids.size, 5)
})
