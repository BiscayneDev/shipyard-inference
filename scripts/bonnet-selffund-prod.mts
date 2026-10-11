/**
 * Bonnet dogfood self-fund against PROD — the agent pays its own top-up.
 *
 * Requires the agent wallet (dogfood-wallet.json) to hold ≥ amountUsd USDC
 * (mainnet) + a little SOL for fees. The user funds it once by a plain
 * wallet-to-wallet transfer; from then on the agent tops itself up.
 *
 *   node --import tsx scripts/bonnet-selffund-prod.mts [--amount 1]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import bs58 from 'bs58'
import { createPayingFetch, createSolanaPayProvider, keypairSigner } from '../src/payment/index.js'

const WALLET = resolve(homedir(), '.hermes/profiles/bonnet/dogfood-wallet.json')
const GATEWAY = process.env.SHIPYARD_GATEWAY_URL ?? 'https://shipyard-inference.vercel.app'
const AMOUNT = Number(process.argv[2] ?? 1)
const log = (m: string): void => console.log(`[bonnet-selffund] ${m}`)

const w = JSON.parse(readFileSync(WALLET, 'utf8')) as { seedB58: string; apiKey: string; pubkey: string }

const signer = await keypairSigner(JSON.stringify([...bs58.decode(w.seedB58), ...bs58.decode(w.pubkey)]))
const payment = await createSolanaPayProvider({
  signer,
  network: 'mainnet',
  rpcUrl: process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com',
  usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
})
const payingFetch = createPayingFetch({ paymentProvider: payment, maxPaymentRetries: 2 })

const res = await payingFetch(`${GATEWAY}/v1/topup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${w.apiKey}` },
  body: JSON.stringify({ amountUsd: AMOUNT }),
})
const raw = await res.text()
if (res.status !== 200) throw new Error(`topup failed: HTTP ${res.status} ${raw.slice(0, 300)}`)
const { balanceUsd, creditedUsd } = JSON.parse(raw) as { balanceUsd: number; creditedUsd: number }
log(`topup settled — credited ${creditedUsd}, balance ${balanceUsd} USDC`)

// record balance for the wiring step
writeFileSync(WALLET, JSON.stringify({ ...w, balanceUsd, lastTopup: new Date().toISOString() }, null, 2))
log('✓ agent self-funded its own key')
