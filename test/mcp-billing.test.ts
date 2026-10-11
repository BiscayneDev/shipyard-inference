/**
 * MCP billing server tests.
 *
 * The MCP server is a thin REST client of a configurable gateway. We exercise
 * the real MCP protocol via an in-memory client/server transport pair,
 * against a local mock gateway.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import {
  createBillingServer,
  fetchGatewayJson,
  GatewayHttpError,
} from '../mcp/server.ts'

type ToolContent = { type: string; text: string }

/** Wire a real MCP client to a billing server over an in-memory transport. */
async function connectClient(opts: Parameters<typeof createBillingServer>[0]) {
  const { server } = createBillingServer(opts)
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return client
}

type MockGateway = {
  url: string
  requests: { method: string; url: string; auth: string | null }[]
  close: () => Promise<void>
}

async function startMockGateway(
  routes: Record<string, { status?: number; body: unknown }>,
  { authOk = true }: { authOk?: boolean } = {},
): Promise<MockGateway> {
  const requests: MockGateway['requests'] = []
  const server = http.createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      requests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        auth: req.headers.authorization ?? null,
      })
      const key = `${req.method} ${req.url?.split('?')[0]}`
      const route = routes[key]
      if (!route) {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: `no mock route for ${key}` }))
        return
      }
      if (!authOk) {
        res.writeHead(401, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid or missing API key' }))
        return
      }
      res.writeHead(route.status ?? 200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(route.body))
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const addr = server.address()
  assert.ok(addr && typeof addr === 'object')
  return {
    url: `http://127.0.0.1:${addr.port}`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

test('fetchGatewayJson sends the bearer key and parses JSON', async () => {
  const gw = await startMockGateway({
    'GET /v1/models': { body: { object: 'list', data: [{ id: 'm1' }] } },
  })
  try {
    const out = await fetchGatewayJson(`${gw.url}/v1/models`, { key: 'sk-test' })
    assert.equal(out.object, 'list')
    assert.equal(gw.requests[0].auth, 'Bearer sk-test')
  } finally {
    await gw.close()
  }
})

test('fetchGatewayJson turns non-2xx into GatewayHttpError with status + body message', async () => {
  const gw = await startMockGateway(
    { 'GET /api/me': { status: 401, body: { error: 'invalid or missing API key' } } },
    { authOk: false },
  )
  try {
    await assert.rejects(
      fetchGatewayJson(`${gw.url}/api/me`, { key: 'sk-bad' }),
      (err: unknown) => {
        assert.ok(err instanceof GatewayHttpError)
        assert.equal(err.status, 401)
        assert.match(err.message, /invalid or missing API key/)
        return true
      },
    )
  } finally {
    await gw.close()
  }
})

test('lists exactly the three billing tools', async () => {
  const client = await connectClient({ gatewayUrl: 'http://127.0.0.1:1', gatewayKey: 'sk-test' })
  const { tools } = await client.listTools()
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    ['shipyard_balance', 'shipyard_models', 'shipyard_usage'],
  )
})

test('shipyard_models returns the model list', async () => {
  const gw = await startMockGateway({
    'GET /v1/models': {
      body: { object: 'list', data: [{ id: 'claude-x' }, { id: 'glm-y' }] },
    },
  })
  try {
    const client = await connectClient({ gatewayUrl: gw.url, gatewayKey: 'sk-test' })
    const res = await client.callTool({ name: 'shipyard_models', arguments: {} })
    const text = (res.content as ToolContent[])[0].text
    const parsed = JSON.parse(text)
    assert.deepEqual(parsed.models, ['claude-x', 'glm-y'])
    assert.equal(parsed.count, 2)
  } finally {
    await gw.close()
  }
})

test('shipyard_usage calls /api/me with the bearer key and returns compact usage JSON', async () => {
  const gw = await startMockGateway({
    'GET /api/me': {
      body: {
        account: { userId: 'u1', wallet: null, label: 'dev' },
        windowMs: 86_400_000,
        requests: 12,
        spentUsd: 0.5,
        baselineUsd: 1.0,
        savedUsd: 0.5,
        savedPct: 50,
        kickbacksUsd: 0.01,
        sponsoredLine: null,
      },
    },
  })
  try {
    const client = await connectClient({ gatewayUrl: gw.url, gatewayKey: 'sk-test' })
    const res = await client.callTool({ name: 'shipyard_usage', arguments: {} })
    const parsed = JSON.parse((res.content as ToolContent[])[0].text)
    assert.equal(parsed.requests, 12)
    assert.equal(parsed.spentUsd, 0.5)
    assert.equal(parsed.savedPct, 50)
    assert.equal(parsed.account.userId, 'u1')
    // Compact projection only — no kickback/sponsored raw detail leak.
    assert.ok(!('sponsoredLine' in parsed))
    assert.equal(gw.requests[0].method, 'GET')
    assert.equal(gw.requests[0].url.split('?')[0], '/api/me')
    assert.equal(gw.requests[0].auth, 'Bearer sk-test')
  } finally {
    await gw.close()
  }
})

test('shipyard_usage forwards windowMs as a query param', async () => {
  const gw = await startMockGateway({
    'GET /api/me': { body: { account: { userId: 'u1' }, requests: 0, spentUsd: 0 } },
  })
  try {
    const client = await connectClient({ gatewayUrl: gw.url, gatewayKey: 'sk-test' })
    await client.callTool({ name: 'shipyard_usage', arguments: { windowMs: 3_600_000 } })
    assert.match(gw.requests[0].url, /windowMs=3600000/)
  } finally {
    await gw.close()
  }
})

test('shipyard_balance returns the credit balance from GET /api/me (kickbacksUsd)', async () => {
  // /api/me's `kickbacksUsd` IS the credit balance: the gateway credits top-ups
  // into the SAME durable CreditStore the tender kickbacks accrue into.
  const gw = await startMockGateway({
    'GET /api/me': { body: { account: { userId: 'u1', wallet: 'W' }, kickbacksUsd: 4.5 } },
  })
  try {
    const client = await connectClient({ gatewayUrl: gw.url, gatewayKey: 'sk-test' })
    const res = await client.callTool({ name: 'shipyard_balance', arguments: {} })
    assert.equal(res.isError, undefined)
    const parsed = JSON.parse((res.content as ToolContent[])[0].text)
    assert.equal(parsed.balanceUsd, 4.5)
    assert.equal(parsed.wallet, 'W')
  } finally {
    await gw.close()
  }
})

test('shipyard_balance without a balance-bearing /api/me reports not_exposed', async () => {
  // Older gateways (pre creditStore) have no kickbacksUsd on /api/me.
  const gw = await startMockGateway({
    'GET /api/me': { body: { account: { userId: 'u1' }, spentUsd: 1 } },
  })
  try {
    const client = await connectClient({ gatewayUrl: gw.url, gatewayKey: 'sk-test' })
    const res = await client.callTool({ name: 'shipyard_balance', arguments: {} })
    const parsed = JSON.parse((res.content as ToolContent[])[0].text)
    assert.equal(parsed.error, 'not_exposed')
    assert.match(parsed.message, /balance/i)
  } finally {
    await gw.close()
  }
})

test('network errors become tool errors, never stack traces', async () => {
  // Port 1 is not listening: connection refused.
  const client = await connectClient({ gatewayUrl: 'http://127.0.0.1:1', gatewayKey: 'sk-test' })
  for (const name of ['shipyard_models', 'shipyard_usage']) {
    const res = await client.callTool({ name, arguments: {} })
    assert.equal(res.isError, true, `${name} should be a tool error`)
    const text = (res.content as ToolContent[])[0].text
    const parsed = JSON.parse(text)
    assert.equal(parsed.error, 'network_error')
    assert.ok(parsed.message.length < 200, 'compact message, no stack trace')
    assert.ok(!text.includes('    at '), 'no stack frames in output')
  }
})

test('gateway HTTP errors become tool errors with the status code', async () => {
  const gw = await startMockGateway({ 'GET /v1/models': { status: 500, body: { error: 'boom' } } })
  try {
    const client = await connectClient({ gatewayUrl: gw.url, gatewayKey: 'sk-test' })
    const res = await client.callTool({ name: 'shipyard_models', arguments: {} })
    assert.equal(res.isError, true)
    const parsed = JSON.parse((res.content as ToolContent[])[0].text)
    assert.equal(parsed.error, 'gateway_error')
    assert.equal(parsed.status, 500)
    assert.match(parsed.message, /boom/)
  } finally {
    await gw.close()
  }
})
