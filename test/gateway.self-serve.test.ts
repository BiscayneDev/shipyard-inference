import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  selfServeKeysOpen,
  canMintKey,
  closedPage,
  SELF_SERVE_CLOSED_BODY,
} from '../src/gateway/self-serve.js'

test('self-serve is closed unless SHIPYARD_SELF_SERVE_KEYS=on', () => {
  assert.equal(selfServeKeysOpen({}), false)
  assert.equal(selfServeKeysOpen({ SHIPYARD_SELF_SERVE_KEYS: '' }), false)
  assert.equal(selfServeKeysOpen({ SHIPYARD_SELF_SERVE_KEYS: 'off' }), false)
  assert.equal(selfServeKeysOpen({ SHIPYARD_SELF_SERVE_KEYS: 'true' }), false)
  assert.equal(selfServeKeysOpen({ SHIPYARD_SELF_SERVE_KEYS: 'on' }), true)
  assert.equal(selfServeKeysOpen({ SHIPYARD_SELF_SERVE_KEYS: ' ON ' }), true)
})

test('open: anyone can mint', () => {
  assert.equal(canMintKey({ open: true, operatorTokens: [], authHeader: undefined }), true)
  assert.equal(canMintKey({ open: true, operatorTokens: ['op'], authHeader: undefined }), true)
})

test('closed: only the operator token can mint', () => {
  const ops = ['op-secret']
  assert.equal(canMintKey({ open: false, operatorTokens: ops, authHeader: undefined }), false)
  assert.equal(canMintKey({ open: false, operatorTokens: ops, authHeader: 'Bearer nope' }), false)
  assert.equal(canMintKey({ open: false, operatorTokens: ops, authHeader: 'Bearer sk-shipyard-abc' }), false)
  assert.equal(canMintKey({ open: false, operatorTokens: ops, authHeader: 'Bearer op-secret' }), true)
})

test('closed with no operator tokens configured never fails open', () => {
  assert.equal(canMintKey({ open: false, operatorTokens: [], authHeader: undefined }), false)
  assert.equal(canMintKey({ open: false, operatorTokens: [], authHeader: 'Bearer anything' }), false)
})

test('closedPage flips the body class only when closed', () => {
  const html = '<html><head><style>x</style></head><body><div class="wrap">hi</div></body></html>'
  assert.equal(closedPage(html, true), html)
  assert.match(closedPage(html, false), /<body class="closed">/)
})

test('closed error body is clean and machine-readable', () => {
  assert.equal(SELF_SERVE_CLOSED_BODY.code, 'self_serve_closed')
  assert.doesNotMatch(SELF_SERVE_CLOSED_BODY.error, /operator/i)
})

test('connect CLI shows the clean closed message on 403', async () => {
  const { issueKey } = await import('../src/connect/install.js')
  const fetchImpl = (async () =>
    new Response(JSON.stringify(SELF_SERVE_CLOSED_BODY), { status: 403, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch
  await assert.rejects(issueKey('https://gw', { fetchImpl }), (e: Error) => e.message === SELF_SERVE_CLOSED_BODY.error)
})
