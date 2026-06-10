import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWalletInference } from '../src/index.js'
import type { SolanaSigner } from '../src/index.js'
import { candidate, chatParams, model, staticProvider } from './helpers.js'

function mockSigner(onSignMessage?: () => void): SolanaSigner {
  return {
    publicKey: '11111111111111111111111111111111',
    async signTransaction(tx) {
      return tx
    },
    async signMessage() {
      onSignMessage?.()
      return new Uint8Array(64).fill(3)
    },
  }
}

test('composes a cost-routed, wallet-paid Router', async () => {
  const wi = await createWalletInference({
    signer: mockSigner(),
    baseURL: 'https://usepod.example/v1',
    network: 'devnet',
    models: [model('commodity', { inputCostPerMTok: 1, outputCostPerMTok: 1 })],
  })

  assert.equal(typeof wi.router.chat, 'function')
  assert.equal(typeof wi.router.chatStream, 'function')
  assert.equal(wi.session, undefined)
  await wi.close() // no session → resolves
})

test('opens an MPP session when a budget is set', async () => {
  let signs = 0
  const wi = await createWalletInference({
    signer: mockSigner(() => (signs += 1)),
    baseURL: 'https://usepod.example/v1',
    network: 'devnet',
    sessionBudget: '5000000',
  })

  assert.ok(wi.session)
  assert.equal(wi.session?.budget, '5000000')
  assert.equal(signs, 1, 'voucher signed once')
  await wi.close()
})

test('routes across the wallet provider and extra candidates (cheapest wins)', async () => {
  const cheap = candidate('cheap', staticProvider('from-cheap'), [
    model('cheap-model', { inputCostPerMTok: 0.01, outputCostPerMTok: 0.01 }),
  ])

  const wi = await createWalletInference({
    signer: mockSigner(),
    baseURL: 'https://usepod.example/v1',
    network: 'devnet',
    models: [model('commodity', { inputCostPerMTok: 5, outputCostPerMTok: 5 })],
    extraCandidates: [cheap],
  })

  const res = await wi.router.chat(chatParams())
  assert.equal(res.content, 'from-cheap', 'costOptimized picked the cheaper extra candidate')
})
