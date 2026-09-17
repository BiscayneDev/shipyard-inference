/**
 * Browser-payer test: run public/src/upto.js — the EXACT code the browser
 * bundle ships — against the live portal, with a mock Phantom provider that
 * holds the funded test keypair. Proves the adapter + pay flow end-to-end;
 * the only untested remainder is the real extension's approval click.
 *
 * Run: node --import tsx scripts/test-browser-payer.mts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Keypair, VersionedTransaction } from '@solana/web3.js'

const WALLET_FILE = process.env.WALLET_FILE ?? '../pay-kit/typescript/examples/shipyard-inference-session/.session.json'
const setup = JSON.parse(readFileSync(resolve(process.cwd(), WALLET_FILE), 'utf8'),) as { clientSecret?: number[]; payerSecret?: number[] }
const kp = Keypair.fromSecretKey(new Uint8Array(setup.clientSecret ?? setup.payerSecret))
const log = (m: string): void => console.log(`[browser-payer-test] ${m}`)

// Mock the injected wallet BEFORE the payer module loads (same shape Phantom
// exposes: connect / publicKey / signTransaction).
;(globalThis as { window: unknown }).window = {
  phantom: {
    solana: {
      publicKey: kp.publicKey,
      connect: async () => ({ publicKey: kp.publicKey }),
      signTransaction: async (vtx: VersionedTransaction): Promise<VersionedTransaction> => {
        console.log(
          '[mock] msg header:',
          vtx.message.header.numRequiredSignatures,
          'signers:',
          vtx.message.staticAccountKeys.slice(0, vtx.message.header.numRequiredSignatures).map((k) => k.toBase58().slice(0, 6)).join(','),
        )
        const copy = VersionedTransaction.deserialize(vtx.serialize())
        try { copy.sign([kp]) } catch (e) {
          console.log('[mock] all keys:', vtx.message.staticAccountKeys.map((k) => k.toBase58().slice(0, 8)).join(','))
          throw e
        }
        return copy
      },
    },
  },
}

// @ts-expect-error — browser module sets window.ShipyardUpto
await import('../examples/chat-portal/public/src/upto.js')
const { ShipyardUpto } = globalThis.window as { ShipyardUpto: { payAndRetry: (url: string, init: RequestInit, rpc: string) => Promise<Response> } }

log(`mock wallet: ${kp.publicKey.toBase58()}`)
if (!ShipyardUpto) throw new Error('ShipyardUpto not attached to window')

const init: RequestInit = {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Tell me, like a pirate first mate, that this message was wallet-paid.' }],
    model: 'llama3.2:3b',
    mode: 'production',
  }),
}

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8899'
const res = await ShipyardUpto.payAndRetry('http://localhost:8788/api/chat', init, RPC_URL)
log(`paid retry: HTTP ${res.status}`)
if (res.status !== 200) throw new Error(`payment failed: ${(await res.text()).slice(0, 600)}`)

const reader = res.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''
let text = ''
let receipt: unknown
outer: for (;;) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const blocks = buffer.split('\n\n')
  buffer = blocks.pop() ?? ''
  for (const block of blocks) {
    const lines = block.split('\n')
    const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim()
    const data = lines.find((l) => l.startsWith('data:'))?.slice(5).trim()
    if (!event) continue
    if (event === 'delta') text += JSON.parse(data ?? '{}').text ?? ''
    else if (event === 'receipt') receipt = JSON.parse(data ?? '{}')
    else if (event === 'error') log(`error event: ${data}`)
    else if (event === 'done') break outer
  }
}
log(`completion: "${text.slice(0, 160)}"`)
log(`receipt: ${JSON.stringify(receipt)}`)
if (!receipt) throw new Error('no receipt — settlement did not run')
log('✓ browser payer verified: mock wallet signs channel open → paid retry → stream → on-chain settle receipt')
