import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createPayingFetch,
  createPayboxPaymentProvider,
  type PaymentProvider,
  type PaymentRequirement,
} from '../src/index.js'
import { challenge402 } from './helpers.js'

test('maxPaymentRetries caps payment: a server that keeps 402-ing never loops', async () => {
  const calls: PaymentRequirement[] = []
  const provider: PaymentProvider = {
    async pay(req) {
      calls.push(req)
      return { header: 'PROOF', reference: 'r', amount: req.amount }
    },
  }

  let fetchCount = 0
  const underlying = (async () => {
    fetchCount++
    return challenge402() // always demands payment
  }) as unknown as typeof fetch

  const payingFetch = createPayingFetch({ paymentProvider: provider, fetch: underlying })
  const res = await payingFetch('https://api.example/x')

  assert.equal(res.status, 402, 'gives up with the 402 rather than looping')
  assert.equal(calls.length, 1, 'paid at most once')
  assert.equal(fetchCount, 2, 'one initial request + one paid retry')
})

test('Paybox provider is idempotent per nonce (no double-charge on repeated challenge)', async () => {
  let paymentCount = 0
  const fakeClient = {
    async requestPayment() {
      paymentCount++
      return {
        request_id: `req-${paymentCount}`,
        status: 'success',
        output: { value: 'PAYMENT-TOKEN' },
        approval_id: null,
        error: null,
      }
    },
    async waitForRequest() {
      throw new Error('should not poll on immediate success')
    },
  }

  const paybox = await createPayboxPaymentProvider({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: fakeClient as any,
    credentialId: 'card-1',
    merchant: 'Example',
    merchantUrl: 'https://api.example',
  })

  const requirement: PaymentRequirement = {
    scheme: 'exact',
    network: 'solana-devnet',
    asset: 'MintAddr',
    amount: '1000000',
    payTo: 'Recipient',
    resource: 'https://api.example/inference',
    nonce: 'nonce-A',
  }

  const first = await paybox.pay(requirement)
  const second = await paybox.pay(requirement)

  assert.equal(first.header, 'PAYMENT-TOKEN')
  assert.deepEqual(second, first, 'same proof returned')
  assert.equal(paymentCount, 1, 'charged exactly once for the same nonce')
})
