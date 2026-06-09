import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createPayingFetch,
  SpendCapError,
  type PaymentProvider,
  type PaymentRequirement,
} from '../src/index.js'
import { challenge402 } from './helpers.js'

function recordingProvider(): PaymentProvider & { calls: PaymentRequirement[] } {
  const calls: PaymentRequirement[] = []
  return {
    calls,
    async pay(req) {
      calls.push(req)
      return { header: 'PROOF-TOKEN', reference: req.nonce ?? 'ref', amount: req.amount }
    },
  }
}

test('402 triggers payment then retries with the proof header, returning 200', async () => {
  const provider = recordingProvider()
  const seen: Array<{ payment: string | null }> = []
  let n = 0

  const underlying = (async (_input: unknown, init?: RequestInit) => {
    seen.push({ payment: new Headers(init?.headers).get('X-PAYMENT') })
    n++
    return n === 1 ? challenge402() : new Response('ok', { status: 200 })
  }) as unknown as typeof fetch

  const payingFetch = createPayingFetch({ paymentProvider: provider, fetch: underlying })
  const res = await payingFetch('https://api.example/inference')

  assert.equal(res.status, 200)
  assert.equal(provider.calls.length, 1)
  assert.equal(seen[0]?.payment, null, 'first request unpaid')
  assert.equal(seen[1]?.payment, 'PROOF-TOKEN', 'retry carries proof')
})

test('non-402 responses pass through untouched (no payment)', async () => {
  const provider = recordingProvider()
  const underlying = (async () => new Response('hi', { status: 200 })) as unknown as typeof fetch

  const payingFetch = createPayingFetch({ paymentProvider: provider, fetch: underlying })
  const res = await payingFetch('https://api.example/x')

  assert.equal(res.status, 200)
  assert.equal(provider.calls.length, 0)
})

test('a payment exceeding the per-request cap throws SpendCapError', async () => {
  const provider = recordingProvider()
  const underlying = (async () => challenge402({ maxAmountRequired: '1000' })) as unknown as typeof fetch

  const payingFetch = createPayingFetch({
    paymentProvider: provider,
    fetch: underlying,
    spendCap: { perRequest: '500' },
  })

  await assert.rejects(() => payingFetch('https://api.example/x'), SpendCapError)
  assert.equal(provider.calls.length, 0, 'cap checked before paying')
})
