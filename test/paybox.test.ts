import { test } from 'node:test'
import assert from 'node:assert/strict'
import { payboxSigner, payboxSecret } from '../src/index.js'
import type { PayboxSignerOptions } from '../src/index.js'

const b64 = (s: string) => Buffer.from(s).toString('base64')

function successResponse(value: unknown) {
  return { request_id: 'r1', status: 'success', output: { value }, approval_id: null, error: null }
}

test('payboxSigner signs via a solanaTransaction intent and returns the signed bytes', async () => {
  const calls: Array<Record<string, unknown>> = []
  const client = {
    async requestWalletSign(args: Record<string, unknown>) {
      calls.push(args)
      return successResponse(b64('SIGNED_TX'))
    },
    async waitForRequest() {
      throw new Error('should not poll on immediate success')
    },
  }

  const signer = await payboxSigner({
    client: client as unknown as PayboxSignerOptions['client'],
    credentialId: 'w1',
    publicKey: 'PAYER123',
    network: 'devnet',
  })

  assert.equal(signer.publicKey, 'PAYER123')

  const signed = await signer.signTransaction(new Uint8Array([1, 2, 3]))

  const intent = calls[0]!.intent as Record<string, unknown>
  assert.equal(calls[0]!.chain, 'solana:devnet')
  assert.equal(calls[0]!.credentialId, 'w1')
  assert.equal(intent.op, 'solanaTransaction')
  assert.equal(intent.address, 'PAYER123')
  assert.equal(intent.transactionBase64, b64(''))
  assert.equal(Buffer.from(signed).toString(), 'SIGNED_TX')
})

test('payboxSigner derives the payer address from the credential, defaults to mainnet', async () => {
  const calls: Array<Record<string, unknown>> = []
  const client = {
    async listCredentials() {
      return [{ credential: { id: 'w1', metadata: { address: 'DERIVED_ADDR' } }, grant: {} }]
    },
    async requestWalletSign(args: Record<string, unknown>) {
      calls.push(args)
      return successResponse(b64('TX'))
    },
    async waitForRequest() {
      throw new Error('not expected')
    },
  }

  const signer = await payboxSigner({
    client: client as unknown as PayboxSignerOptions['client'],
    credentialId: 'w1',
  })

  assert.equal(signer.publicKey, 'DERIVED_ADDR')
  await signer.signTransaction(new Uint8Array([9]))
  assert.equal(calls[0]!.chain, 'solana:mainnet-beta')
})

test('payboxSigner polls through pending_signature before returning', async () => {
  let polled = false
  const client = {
    async requestWalletSign() {
      return { request_id: 'r2', status: 'pending_signature', output: null, approval_id: null, error: null }
    },
    async waitForRequest(id: string) {
      polled = true
      assert.equal(id, 'r2')
      return successResponse(b64('LATE_TX'))
    },
  }

  const signer = await payboxSigner({
    client: client as unknown as PayboxSignerOptions['client'],
    credentialId: 'w1',
    publicKey: 'P',
  })
  const signed = await signer.signTransaction(new Uint8Array([1]))

  assert.ok(polled, 'waited for the signing window')
  assert.equal(Buffer.from(signed).toString(), 'LATE_TX')
})

test('payboxSigner.signMessage signs via a solanaMessage intent', async () => {
  const calls: Array<Record<string, unknown>> = []
  const client = {
    async requestWalletSign(args: Record<string, unknown>) {
      calls.push(args)
      return successResponse(b64('MSG_SIG'))
    },
    async waitForRequest() {
      throw new Error('not expected')
    },
  }

  const signer = await payboxSigner({
    client: client as unknown as PayboxSignerOptions['client'],
    credentialId: 'w1',
    publicKey: 'P',
  })
  const sig = await signer.signMessage!(new TextEncoder().encode('voucher'))

  const intent = calls[0]!.intent as Record<string, unknown>
  assert.equal(intent.op, 'solanaMessage')
  assert.equal(intent.message, 'voucher')
  assert.equal(Buffer.from(sig).toString(), 'MSG_SIG')
})

test('payboxSecret reveals a vaulted secret and forwards the raw flag', async () => {
  const calls: Array<Record<string, unknown>> = []
  const client = {
    async requestSecret(args: Record<string, unknown>) {
      calls.push(args)
      return successResponse('sk-live-123')
    },
    async waitForRequest() {
      throw new Error('not expected')
    },
  }

  const secret = await payboxSecret({
    client: client as unknown as PayboxSignerOptions['client'],
    credentialId: 's1',
    raw: true,
    purpose: 'load ANTHROPIC_API_KEY',
  })

  assert.equal(secret, 'sk-live-123')
  assert.equal(calls[0]!.credentialId, 's1')
  assert.equal(calls[0]!.raw, true)
  assert.equal(calls[0]!.purpose, 'load ANTHROPIC_API_KEY')
})
