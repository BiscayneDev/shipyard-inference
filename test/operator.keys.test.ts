import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TelemetryHub } from '../src/operator/hub.js'
import { createOperatorConsole } from '../src/operator/server.js'
import { createGatewayApp, MemoryApiKeyStore } from '../src/gateway/index.js'
import { candidate, model, staticProvider } from './helpers.js'

function setup() {
  const hub = new TelemetryHub()
  const store = new MemoryApiKeyStore()
  const app = createOperatorConsole({
    hub,
    operatorTokens: ['op'],
    keyStore: store,
  })
  const gateway = createGatewayApp({
    candidates: [candidate('c', staticProvider('hello'), [model('m')])],
    keyStore: store,
  })
  return { app, gateway }
}

test('operator can issue, list, and revoke tenant-scoped API keys', async () => {
  const { app, gateway } = setup()

  const issuedRes = await app.request('/api/keys', {
    method: 'POST',
    headers: { authorization: 'Bearer op', 'content-type': 'application/json' },
    body: JSON.stringify({ tenantId: 'tenant-1', projectId: 'project-1', label: 'cursor' }),
  })
  assert.equal(issuedRes.status, 201)
  const issued = (await issuedRes.json()) as { key: string; account: { tenantId?: string; projectId?: string; label?: string; status: string } }
  assert.match(issued.key, /^sk-shipyard-/)
  assert.equal(issued.account.tenantId, 'tenant-1')
  assert.equal(issued.account.projectId, 'project-1')
  assert.equal(issued.account.status, 'active')

  const listRes = await app.request('/api/keys', { headers: { authorization: 'Bearer op' } })
  assert.equal(listRes.status, 200)
  const listed = (await listRes.json()) as { keys: Array<{ tenantId?: string; projectId?: string; status: string }> }
  assert.equal(listed.keys.length, 1)
  assert.equal(listed.keys[0]?.tenantId, 'tenant-1')
  assert.equal(listed.keys[0]?.projectId, 'project-1')

  const revokeRes = await app.request(`/api/keys/${encodeURIComponent(issued.key)}`, {
    method: 'DELETE',
    headers: { authorization: 'Bearer op' },
  })
  assert.equal(revokeRes.status, 200)

  const revokedList = await app.request('/api/keys', { headers: { authorization: 'Bearer op' } })
  const revoked = (await revokedList.json()) as { keys: Array<{ status: string; revokedAt?: number }> }
  assert.equal(revoked.keys[0]?.status, 'revoked')
  assert.ok(revoked.keys[0]?.revokedAt)

  const denied = await gateway.request('/v1/models', {
    headers: { authorization: `Bearer ${issued.key}` },
  })
  assert.equal(denied.status, 401)
})