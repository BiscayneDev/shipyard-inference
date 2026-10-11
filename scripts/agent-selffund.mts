/**
 * Agent self-funding loop against a LOCAL gateway: no human, no checkout.
 *
 *   1. prove wallet control  → POST /v1/keys/wallet   (Ed25519 signature = auth)
 *   2. request a top-up      → POST /v1/topup         (402 challenge priced at amountUsd)
 *   3. pay the challenge     → createPayingFetch settles USDC automatically
 *   4. chat completion       → the key now carries a credit balance
 *
 * Modelled on scripts/localnet-paid-call.mts (same localnet env handling).
 * Run against a local gateway started with x402 + a key store:
 *
 *   node --import tsx scripts/agent-selffund.mts
 *
 * Env:
 *   SHIPYARD_GATEWAY_URL  gateway base URL (default http://127.0.0.1:8787)
 *   SHIPYARD_TOPUP_USD    top-up amount (default 0.05)
 *
 * Reads scripts/.localnet.json (same file localnet-paid-call uses) for the
 * devnet RPC, USDC mint and a funded payer keypair. Writes no secrets anywhere.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto'
import bs58 from 'bs58'
import { keypairSigner, createSolanaPayProvider, createPayingFetch } from '../src/payment/index.js'

const GATEWAY = (process.env.SHIPYARD_GATEWAY_URL ?? 'http://127.0.0.1:8787').replace(/\/+$/, '')
const TOPUP_USD = Number(process.env.SHIPYARD_TOPUP_USD ?? 0.05)
const setup = JSON.parse(readFileSync(resolve(import.meta.dirname, '.localnet.json'), 'utf8')) as {
  rpc: string
  mint: string
  treasury: string
  payerSecret: number[]
}
const log = (m: string): void => console.log(`[selffund] ${m}`)

/** A fresh Solana-style Ed25519 wallet: base58 pubkey + base58 seed. */
function newWallet(): { pubkey: string; seedB58: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pubkey = bs58.encode(Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url'))
  const seedB58 = bs58.encode(Buffer.from(privateKey.export({ format: 'jwk' }).d!, 'base64url'))
  return { pubkey, seedB58 }
}

function signChallenge(seedB58: string, message: string): string {
  const pkcs8 = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    Buffer.from(bs58.decode(seedB58)),
  ])
  const key = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })
  return bs58.encode(sign(null, Buffer.from(message, 'utf8'), key))
}

async function main(): Promise<void> {
  const signer = await keypairSigner(JSON.stringify(setup.payerSecret))
  const payment = await createSolanaPayProvider({
    signer,
    network: 'devnet',
    rpcUrl: setup.rpc,
    usdcMint: setup.mint,
  })
  const payingFetch = createPayingFetch({ paymentProvider: payment, maxPaymentRetries: 2 })

  // 1. Mint a key with a wallet signature (no human, no website).
  const wallet = newWallet()
  const nonce = `selffund-${Date.now()}`
  const challenge = [
    'shipyard-wallet-key-challenge:v1',
    'shipyard-inference',
    wallet.pubkey,
    nonce,
  ].join('\n')
  const issued = await fetch(`${GATEWAY}/v1/keys/wallet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pubkey: wallet.pubkey, nonce, signature: signChallenge(wallet.seedB58, challenge) }),
  })
  if (issued.status !== 200) throw new Error(`key issuance failed: HTTP ${issued.status} ${await issued.text()}`)
  const { key } = (await issued.json()) as { key: string }
  log(`issued key ${key.slice(0, 16)}… for wallet ${wallet.pubkey.slice(0, 8)}…`)

  // 2 + 3. Top up: the 402 challenge is settled automatically by payingFetch.
  const topup = await payingFetch(`${GATEWAY}/v1/topup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ amountUsd: TOPUP_USD }),
  })
  const topupRaw = await topup.text()
  if (topup.status !== 200) throw new Error(`topup failed: HTTP ${topup.status} ${topupRaw.slice(0, 400)}`)
  const { balanceUsd } = JSON.parse(topupRaw) as { balanceUsd: number }
  log(`topup settled — balance: ${balanceUsd} USDC`)

  // 4. Chat completion on the funded key.
  const chat = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'llama3.2:3b',
      messages: [{ role: 'user', content: 'You just funded yourself. Say something nautical in 10 words.' }],
    }),
  })
  const chatRaw = await chat.text()
  if (chat.status !== 200) throw new Error(`chat failed: HTTP ${chat.status} ${chatRaw.slice(0, 400)}`)
  const body = JSON.parse(chatRaw) as { choices: Array<{ message: { content: string } }> }
  log(`completion: "${body.choices[0]!.message.content.slice(0, 160)}"`)
  log('✓ agent self-funding loop verified: wallet → key → USDC topup → inference')
}

main().catch((err) => {
  console.error('[selffund] FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
