/**
 * Prod-safe verification of the self-funding surface (no money moves):
 *  1. POST /v1/keys/wallet with a real Ed25519 signature → expect 200 + key
 *  2. POST /v1/topup with that key → expect 402 challenge priced at amountUsd
 *     (challenge inspected, never paid)
 */
import { generateKeyPairSync, sign, createPrivateKey } from 'node:crypto'
import bs58 from 'bs58'

const GATEWAY = process.env.PROD_URL ?? 'https://shipyard-inference.vercel.app'
const log = (m: string): void => console.log(`[prod-verify] ${m}`)

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const pubkey = bs58.encode(Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url'))
const seedB58 = bs58.encode(Buffer.from(privateKey.export({ format: 'jwk' }).d!, 'base64url'))
const nonce = `prod-verify-${Date.now()}`
const challenge = ['shipyard-wallet-key-challenge:v1', 'shipyard-inference', pubkey, nonce].join('\n')
const pkcs8 = Buffer.concat([
  Buffer.from('302e020100300506032b657004220420', 'hex'),
  Buffer.from(bs58.decode(seedB58)),
])
const sig = bs58.encode(sign(null, Buffer.from(challenge, 'utf8'), createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })))

const issued = await fetch(`${GATEWAY}/v1/keys/wallet`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ pubkey, nonce, signature: sig }),
})
const issuedBody = await issued.text()
log(`key issuance: HTTP ${issued.status} ${issuedBody.slice(0, 200)}`)
if (issued.status !== 200) process.exit(1)
const { key } = JSON.parse(issuedBody) as { key: string }

const topup = await fetch(`${GATEWAY}/v1/topup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
  body: JSON.stringify({ amountUsd: 0.01 }),
})
const topupBody = await topup.text()
log(`topup: HTTP ${topup.status}`)
log(`topup body (first 500): ${topupBody.slice(0, 500)}`)
log(topup.status === 402 ? '✓ topup route armed with 402 challenge (not paid)' : topup.status === 200 ? '⚠ UNEXPECTED: topup returned 200 without payment' : `topup returned ${topup.status}`)
