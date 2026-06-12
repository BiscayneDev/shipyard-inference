import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeClaudeSettings,
  applyShipyardSpinnerTips,
  spinnerTips,
  issueKey,
  fetchEarnings,
  formatStatusLine,
} from '../src/connect/install.js'

test('mergeClaudeSettings: --route sets the Anthropic env, preserves other settings', () => {
  const merged = mergeClaudeSettings(
    { env: { FOO: 'bar' }, model: 'opus' },
    { baseUrl: 'https://gw', token: 'sk-shipyard-x', statusLineCommand: 'npx -y shipyard-inference statusline', route: true },
  )
  assert.equal(merged.env?.ANTHROPIC_BASE_URL, 'https://gw')
  assert.equal(merged.env?.ANTHROPIC_AUTH_TOKEN, 'sk-shipyard-x')
  assert.equal(merged.env?.FOO, 'bar', 'existing env preserved')
  assert.equal(merged.model, 'opus', 'other settings preserved')
  assert.equal(merged.statusLine?.command, 'npx -y shipyard-inference statusline')
})

test('mergeClaudeSettings: default does NOT take over the model (no Anthropic env)', () => {
  const merged = mergeClaudeSettings(
    { model: 'opus' },
    { baseUrl: 'https://gw', token: 'sk-shipyard-x', statusLineCommand: 'npx -y shipyard-inference statusline' },
  )
  assert.equal(merged.env?.ANTHROPIC_BASE_URL, undefined)
  assert.equal(merged.env?.ANTHROPIC_AUTH_TOKEN, undefined)
  assert.equal(merged.model, 'opus', 'other settings preserved')
  assert.equal(merged.statusLine?.command, 'npx -y shipyard-inference statusline', 'status line still added')
})

test('mergeClaudeSettings: default strips a PRIOR Shipyard takeover but keeps the user own env', () => {
  const merged = mergeClaudeSettings(
    { env: { FOO: 'bar', ANTHROPIC_BASE_URL: 'https://shipyard-inference.vercel.app', ANTHROPIC_AUTH_TOKEN: 'sk-shipyard-old' } },
    { baseUrl: 'https://gw', token: 'sk-shipyard-x' },
  )
  assert.equal(merged.env?.ANTHROPIC_BASE_URL, undefined, 'shipyard base url removed')
  assert.equal(merged.env?.ANTHROPIC_AUTH_TOKEN, undefined, 'shipyard token removed')
  assert.equal(merged.env?.FOO, 'bar', 'user env preserved')
})

test('mergeClaudeSettings: default leaves a NON-Shipyard Anthropic env alone', () => {
  const merged = mergeClaudeSettings(
    { env: { ANTHROPIC_BASE_URL: 'https://api.anthropic.com', ANTHROPIC_AUTH_TOKEN: 'sk-ant-user' } },
    { baseUrl: 'https://gw', token: 'sk-shipyard-x' },
  )
  assert.equal(merged.env?.ANTHROPIC_BASE_URL, 'https://api.anthropic.com', 'user base url untouched')
  assert.equal(merged.env?.ANTHROPIC_AUTH_TOKEN, 'sk-ant-user', 'user token untouched')
})

test('mergeClaudeSettings: does not clobber an existing status line', () => {
  const merged = mergeClaudeSettings(
    { statusLine: { type: 'command', command: 'my-own' } },
    { baseUrl: 'https://gw', token: 't', statusLineCommand: 'npx -y shipyard-inference statusline' },
  )
  assert.equal(merged.statusLine?.command, 'my-own')
})

test('spinnerTips: uses the served sponsored line, else a house fallback', () => {
  assert.deepEqual(
    spinnerTips({ requests: 1, spentUsd: 0, savedUsd: 0, savedPct: 0, kickbacksUsd: 0, sponsoredLine: '🚀 Acme Cloud' }),
    ['🚀 Acme Cloud'],
  )
  assert.equal(spinnerTips(null).length, 1)
  assert.match(spinnerTips(null)[0], /Shipyard/)
})

test('applyShipyardSpinnerTips: sets spinnerTipsOverride only, preserves the rest', () => {
  const next = applyShipyardSpinnerTips(
    { statusLine: { type: 'command', command: 'x' }, env: { FOO: 'bar' } },
    ['🚀 Acme Cloud'],
  )
  assert.deepEqual(next.spinnerTipsOverride, { excludeDefault: true, tips: ['🚀 Acme Cloud'] })
  assert.equal(next.statusLine?.command, 'x', 'status line preserved')
  assert.equal(next.env?.FOO, 'bar', 'env preserved (no takeover introduced)')
})

test('issueKey: POSTs /api/keys and returns the key', async () => {
  let seen: { url: string; body: unknown } | undefined
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    seen = { url: String(url), body: JSON.parse(String(init?.body)) }
    return new Response(JSON.stringify({ key: 'sk-shipyard-abc', userId: 'u1', wallet: 'W' }), { status: 200 })
  }) as unknown as typeof fetch
  const r = await issueKey('https://gw/', { wallet: 'W', fetchImpl })
  assert.equal(r.key, 'sk-shipyard-abc')
  assert.equal(seen?.url, 'https://gw/api/keys')
  assert.deepEqual(seen?.body, { wallet: 'W', label: 'claude-code' })
})

test('fetchEarnings + formatStatusLine: earnings → status line, failure → fallback', async () => {
  const ok = (async () => new Response(JSON.stringify({ requests: 3, spentUsd: 0.0005, savedUsd: 0.0014, savedPct: 73, kickbacksUsd: 0.002 }), { status: 200 })) as unknown as typeof fetch
  const e = await fetchEarnings('https://gw', 'sk', { fetchImpl: ok })
  assert.equal(formatStatusLine(e), '⚓ Shipyard · saved $0.0014 (73%) · kickbacks $0.0020')

  const bad = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch
  assert.equal(await fetchEarnings('https://gw', 'sk', { fetchImpl: bad }), null)
  assert.equal(formatStatusLine(null), '⚓ Shipyard')
})

test('formatStatusLine: a sponsored line leads (the in-IDE ad), earnings trail', () => {
  assert.equal(
    formatStatusLine({ requests: 1, spentUsd: 0.0001, savedUsd: 0.001, savedPct: 50, kickbacksUsd: 0.0025, sponsoredLine: '🚀 Acme Cloud' }),
    '🚀 Acme Cloud  ·  ⚓ +$0.0025',
  )
})
