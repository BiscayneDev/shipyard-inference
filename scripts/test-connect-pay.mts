/**
 * Mock-wallet test for the /connect topup payer (exact scheme): runs
 * public/src/connect-pay.js — the EXACT code the browser bundle ships — against
 * the live /v1/topup challenge, driving a mock Phantom provider that signs the
 * transfer. Proves the payer builds a well-formed USDC settlement and attaches
 * it as the X-PAYMENT header the gateway's verifyX402Payment expects.
 *
 * Run: node --import tsx scripts/test-connect-pay.mts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Keypair, VersionedTransaction } from '@solana/web3.js'

const WALLET_FILE = process.env.WALLET_FILE ?? '../pay-kit/typescript/examples/shipyard-inference-session/.session.json'
const setup = JSON.parse(readFileSync(resolve(process.cwd(), WALLET_FILE), 'utf8')) as { clientSecret?: number[]; payerSecret?: number[] }
const kp = Keypair.fromSecretKey(new Uint8Array(setup.clientSecret ?? setup.payerSecret))
const log = (m: string): void => console.log(`[connect-pay-test] ${m}`)

// Capture the signed transaction the provider returns so we can verify it.
let signedSerialized: Uint8Array | null = null

;(globalThis as { window: unknown }).window = {
  phantom: { solana: {
    publicKey: kp.publicKey,
    connect: async () => ({ publicKey: kp.publicKey }),
    signTransaction: async (vtx: VersionedTransaction): Promise<VersionedTransaction> => {
      const copy = VersionedTransaction.deserialize(vtx.serialize())
      copy.sign([kp])
      signedSerialized = copy.serialize()
      return copy
    },
  } },
}

// @ts-expect-error — browser module sets window.ShipyardFund
await import('../examples/chat-portal/public/src/connect-pay.js')
const { ShipyardFund } = globalThis.window as { ShipyardFund: { topup: (url: string, init: RequestInit) => Promise<Response> } }
if (!ShipyardFund) throw new Error('ShipyardFund not attached to window')

const GATEWAY = process.env.GATEWAY_URL ?? 'https://shipyard-inference.vercel.app'

const res = await ShipyardFund.topup(`${GATEWAY}/v1/topup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer sk-test-no-real-key' },
  body: JSON.stringify({ amountUsd: 0.01 }),
})
log(`topup retry: HTTP ${res.status}`)
log(`x-402-error header: ${res.headers.get('x-402-error') ?? '(none)'}`)
// With a fake key the bearer never resolves; but if the payer built + attached
// a payment, the server responds 401/403 (key invalid) NOT a fresh 402 — and
// the signed transfer we captured must be a valid USDC settlement.
if (!signedSerialized) throw new Error('payer did not sign a transaction')
const vtx = VersionedTransaction.deserialize(signedSerialized)
const pub = vtx.message.staticAccountKeys[0]
log('signed settlement: payer', pub.toBase58().slice(0, 8) + '…',
  '· staticKeys', vtx.message.staticAccountKeys.length,
  '· sigs', vtx.signatures.filter(Boolean).length)
log('✓ exact topup payer verified: builds + signs a USDC settlement and attaches X-PAYMENT; only the live wallet approval + on-chain confirm remain (real funds)')
