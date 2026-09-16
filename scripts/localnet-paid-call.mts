/**
 * Localnet paid call: hit the live gateway (:8787) keyless, let
 * createPayingFetch settle the 402 with a real USDC transfer, and verify the
 * completion + treasury balance. This is the agent-shaped client: no API key,
 * wallet only.
 *
 * Run: node --import tsx scripts/localnet-paid-call.mts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import web3 from '@solana/web3.js'
import * as splToken from '@solana/spl-token'
import { keypairSigner, createSolanaPayProvider, createPayingFetch } from '../src/payment/index.js'

const setup = JSON.parse(readFileSync(resolve(import.meta.dirname, '.localnet.json'), 'utf8')) as {
  rpc: string
  mint: string
  treasury: string
  payerSecret: number[]
}
const connection = new web3.Connection(setup.rpc, 'confirmed')
const log = (m: string): void => console.log(`[paid-call] ${m}`)

async function main(): Promise<void> {
  const signer = await keypairSigner(JSON.stringify(setup.payerSecret))
  const payment = await createSolanaPayProvider({
    signer,
    network: 'devnet',
    rpcUrl: setup.rpc,
    usdcMint: setup.mint,
  })
  const payingFetch = createPayingFetch({ paymentProvider: payment, maxPaymentRetries: 2 })

  const treasuryAta = await splToken.getAssociatedTokenAddress(new web3.PublicKey(setup.mint), new web3.PublicKey(setup.treasury))
  const before = Number(await splToken.getAccount(connection, treasuryAta).then((a) => a.amount).catch(() => 0n))
  log(`treasury before: ${before / 1e6} USDC`)

  const res = await payingFetch('http://127.0.0.1:8787/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2:3b',
      messages: [{ role: 'user', content: 'You just got paid 0.001 USDC. Say something nautical in 10 words.' }],
    }),
  })
  const raw = await res.text()
  log(`HTTP ${res.status}`)
  if (res.status !== 200) throw new Error(`paid call failed: ${raw.slice(0, 400)}`)
  const body = JSON.parse(raw) as { choices: Array<{ message: { content: string } }>; usage?: unknown }
  log(`completion: "${body.choices[0].message.content.slice(0, 160)}"`)
  log(`usage: ${JSON.stringify(body.usage)}`)

  // Balance may lag a moment; poll a few times.
  let after = before
  for (let i = 0; i < 10 && after <= before; i++) {
    await new Promise((r) => setTimeout(r, 1_000))
    after = Number(await splToken.getAccount(connection, treasuryAta).then((a) => a.amount).catch(() => 0n))
  }
  log(`treasury after: ${after / 1e6} USDC (delta ${(after - before) / 1e6})`)
  if (after - before < 1000) throw new Error('treasury did not receive the payment')
  log('✓ paid loop verified: 402 → USDC transfer → confirmed → served')
}

main().catch((err) => {
  console.error('[paid-call] FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
