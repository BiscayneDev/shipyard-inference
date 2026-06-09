import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicKey, verify } from 'node:crypto'
import { createSolanaPayProvider, keypairSigner } from '../src/index.js'
import type { SolanaSigner } from '../src/index.js'

test('keypairSigner.signMessage produces a verifiable Ed25519 signature', async () => {
  const web3 = await import('@solana/web3.js')
  const kp = web3.Keypair.generate()
  const signer = await keypairSigner(Array.from(kp.secretKey))

  assert.equal(signer.publicKey, kp.publicKey.toBase58())

  const message = new TextEncoder().encode('mpp voucher')
  const sig = await signer.signMessage!(message)
  assert.equal(sig.length, 64)

  // Verify against the raw public key wrapped in an Ed25519 SPKI envelope.
  const spki = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    Buffer.from(kp.publicKey.toBytes()),
  ])
  const pub = createPublicKey({ key: spki, format: 'der', type: 'spki' })
  assert.ok(verify(null, Buffer.from(message), pub, Buffer.from(sig)))
})

test('openSession signs an MPP voucher and returns a reusable session', async () => {
  let closed = false
  let signMessageCalls = 0
  const signer: SolanaSigner = {
    publicKey: '11111111111111111111111111111111',
    async signTransaction(tx) {
      return tx
    },
    async signMessage() {
      signMessageCalls += 1
      return new Uint8Array(64).fill(7)
    },
  }

  const provider = await createSolanaPayProvider({
    signer,
    network: 'devnet',
    onSessionClose: async () => {
      closed = true
    },
  })

  const session = await provider.openSession!('5000000')
  assert.equal(session.headerName, 'X-PAYMENT')
  assert.equal(session.budget, '5000000')
  assert.equal(signMessageCalls, 1)

  const voucher = JSON.parse(Buffer.from(session.header, 'base64').toString()) as Record<string, unknown>
  assert.equal(voucher.scheme, 'mpp')
  assert.equal(voucher.budget, '5000000')
  assert.equal(voucher.payer, '11111111111111111111111111111111')
  assert.ok(typeof voucher.signature === 'string' && voucher.signature.length > 0)

  await session.close()
  assert.ok(closed, 'close() runs the settle hook')
})

test('openSession requires a signer that can sign messages', async () => {
  const signer: SolanaSigner = {
    publicKey: '11111111111111111111111111111111',
    async signTransaction(tx) {
      return tx
    },
  }
  const provider = await createSolanaPayProvider({ signer, network: 'devnet' })
  await assert.rejects(() => provider.openSession!('1'), /signMessage/)
})
