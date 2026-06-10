import { test } from 'node:test'
import assert from 'node:assert/strict'
import { payboxSettle, PaymentError, type SolanaSigner } from '../src/index.js'

// Valid 32-byte base58 addresses (system program = 32 zero bytes; a real mint).
const PAYER = '11111111111111111111111111111111'
const TREASURY = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

function mockSigner(onSign?: (tx: Uint8Array) => void): SolanaSigner {
  return {
    publicKey: PAYER,
    async signTransaction(tx) {
      onSign?.(tx)
      return tx // echo the serialized tx back as "signed"
    },
  }
}

/** A Connection-compatible stub that records the raw tx and returns a fixed signature. */
function fakeConnection(opts: { err?: unknown } = {}) {
  const calls = { sent: undefined as Uint8Array | undefined, confirmed: false }
  return {
    calls,
    async getLatestBlockhash() {
      return { blockhash: PAYER /* valid 32-byte base58 */, lastValidBlockHeight: 1000 }
    },
    async sendRawTransaction(raw: Uint8Array) {
      calls.sent = raw
      return 'SIG-123'
    },
    async confirmTransaction() {
      calls.confirmed = true
      return { value: { err: opts.err ?? null } }
    },
  }
}

test('payboxSettle builds + submits a USDC transfer and returns the signature', async () => {
  let signedTx: Uint8Array | undefined
  const conn = fakeConnection()
  const res = await payboxSettle({
    signer: mockSigner((tx) => (signedTx = tx)),
    treasury: TREASURY,
    amount: '1500000', // $1.50
    network: 'devnet',
    connection: conn,
  })

  assert.equal(res.signature, 'SIG-123')
  assert.equal(res.amount, '1500000')
  assert.equal(res.treasury, TREASURY)
  assert.equal(res.payer, PAYER)
  assert.ok(signedTx instanceof Uint8Array, 'signer was asked to sign the serialized tx')
  assert.ok(conn.calls.sent instanceof Uint8Array, 'a raw tx was submitted')
  assert.ok(conn.calls.confirmed, 'submission was confirmed')
})

test('payboxSettle rejects a non-positive amount before touching the chain', async () => {
  const conn = fakeConnection()
  await assert.rejects(
    payboxSettle({ signer: mockSigner(), treasury: TREASURY, amount: '0', connection: conn }),
    PaymentError,
  )
  await assert.rejects(
    payboxSettle({ signer: mockSigner(), treasury: TREASURY, amount: 'abc', connection: conn }),
    PaymentError,
  )
  assert.equal(conn.calls.sent, undefined, 'nothing submitted on invalid input')
})

test('payboxSettle throws when the transaction fails on-chain', async () => {
  await assert.rejects(
    payboxSettle({
      signer: mockSigner(),
      treasury: TREASURY,
      amount: '1000000',
      network: 'devnet',
      connection: fakeConnection({ err: { InstructionError: [0, 'Custom'] } }),
    }),
    /failed on-chain/,
  )
})
