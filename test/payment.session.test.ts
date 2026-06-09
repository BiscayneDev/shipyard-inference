import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPayingFetch } from '../src/index.js'
import type { PaymentProvider, PaymentSession } from '../src/index.js'
import { challenge402 } from './helpers.js'

const noopProvider = (onPay?: () => void): PaymentProvider => ({
  async pay(req) {
    onPay?.()
    return { header: 'PROOF', reference: req.nonce ?? 'r', amount: req.amount }
  },
})

test('an MPP session attaches its voucher to every request and skips per-call pay()', async () => {
  let payCalls = 0
  const session: PaymentSession = { header: 'VOUCHER', budget: '1000', async close() {} }
  const seen: Array<string | null> = []

  const underlying = (async (_input: unknown, init?: RequestInit) => {
    seen.push(new Headers(init?.headers).get('X-PAYMENT'))
    return new Response('ok', { status: 200 })
  }) as unknown as typeof fetch

  const payingFetch = createPayingFetch({
    paymentProvider: noopProvider(() => (payCalls += 1)),
    session,
    fetch: underlying,
  })

  await payingFetch('https://api.example/a')
  await payingFetch('https://api.example/b')

  assert.deepEqual(seen, ['VOUCHER', 'VOUCHER'])
  assert.equal(payCalls, 0, 'no per-call settlement while the session covers requests')
})

test('a session can carry its voucher on a custom header (e.g. Authorization)', async () => {
  const session: PaymentSession = {
    header: 'MPP abc',
    headerName: 'Authorization',
    budget: '1000',
    async close() {},
  }
  let seen: string | null = null
  const underlying = (async (_input: unknown, init?: RequestInit) => {
    seen = new Headers(init?.headers).get('Authorization')
    return new Response('ok', { status: 200 })
  }) as unknown as typeof fetch

  const payingFetch = createPayingFetch({
    paymentProvider: noopProvider(),
    session,
    fetch: underlying,
  })
  await payingFetch('https://api.example/a')
  assert.equal(seen, 'MPP abc')
})

test('a 402 the session does not cover falls back to per-call pay()', async () => {
  let payCalls = 0
  const session: PaymentSession = { header: 'VOUCHER', budget: '1000', async close() {} }
  let n = 0
  const underlying = (async () => {
    n += 1
    return n === 1 ? challenge402() : new Response('ok', { status: 200 })
  }) as unknown as typeof fetch

  const payingFetch = createPayingFetch({
    paymentProvider: noopProvider(() => (payCalls += 1)),
    session,
    fetch: underlying,
  })
  const res = await payingFetch('https://api.example/a')

  assert.equal(res.status, 200)
  assert.equal(payCalls, 1, 'per-call pay() backstops an uncovered 402')
})
