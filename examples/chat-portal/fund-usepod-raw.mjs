// Last-resort funder: reveal the wallet's raw key (grant allows it) and sign the
// UsePod deposit LOCALLY — no agent-signer / moonx-sign. The raw key lives only
// in process memory and is NEVER printed.
//
//   node examples/chat-portal/fund-usepod-raw.mjs [amountUsd]
import { payboxSecret, depositUsdc, usePodBalance } from 'shipyard-inference'

const CRED = process.env.PAYBOX_CREDENTIAL_ID || '2ca1cd5c-acea-4173-b2ec-dbc94cb951f8'
const TOKEN = process.env.USEPOD_TOKEN || 'bd77e1d6-7c4d-46fe-b526-201ba005f980'
const CODE = process.env.USEPOD_DEPOSIT_CODE || 'bf2a7ed9eb84c6dc'
const AMOUNT = Number(process.argv[2] ?? 0.25)
const NETWORK = 'mainnet'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fmt = (n) => `$${Number(n).toFixed(6)}`

async function toSecretKey64(raw) {
  const web3 = await import('@solana/web3.js')
  let bytes
  const s = String(raw).trim()
  // 1) JSON: array of bytes, or an object carrying the key
  if (s.startsWith('[') || s.startsWith('{')) {
    const o = JSON.parse(s)
    const arr = Array.isArray(o)
      ? o
      : o.secretKey ?? o.privateKey ?? o.secret_key ?? o.private_key ?? o.key
    if (Array.isArray(arr)) bytes = Uint8Array.from(arr)
    else if (typeof arr === 'string') return toSecretKey64(arr) // nested string form
    else throw new Error('JSON secret had no recognizable key field')
  } else if (/^(0x)?[0-9a-fA-F]+$/.test(s) && (s.replace(/^0x/, '').length === 64 || s.replace(/^0x/, '').length === 128)) {
    // 2) hex (32-byte seed = 64 chars, or 64-byte key = 128 chars)
    bytes = Uint8Array.from(Buffer.from(s.replace(/^0x/, ''), 'hex'))
  } else {
    // 3) base58 (Solana standard)
    const bs58 = (await import('bs58')).default ?? (await import('bs58'))
    bytes = Uint8Array.from(bs58.decode(s))
  }
  // Normalize to a 64-byte secret key
  if (bytes.length === 64) return bytes
  if (bytes.length === 32) return web3.Keypair.fromSeed(bytes).secretKey
  throw new Error(`unexpected key byte length ${bytes.length} (want 32 or 64)`)
}

console.log('Raw-key → UsePod funding (local signing, bypasses agent-signer)')
console.log(`  network: ${NETWORK}  ⚠️  REAL USDC`)
console.log(`  amount:  ${fmt(AMOUNT)} USDC`)
console.log(`  token:   ${TOKEN}`)

const before = await usePodBalance(TOKEN).catch(() => ({ usdc: 0 }))
console.log(`  balance: ${fmt(before.usdc)} (before)\n`)

console.log('→ revealing raw key (in-memory only)…')
let secretKey
try {
  const raw = await payboxSecret({ credentialId: CRED, raw: true, purpose: `Fund UsePod inference balance (${fmt(AMOUNT)})` })
  secretKey = await toSecretKey64(raw)
} catch (err) {
  console.error(`\n✗ could not get a usable raw key: ${err?.message ?? err}`)
  process.exit(1)
}
console.log('  ✓ key resolved (64-byte secret, not shown)\n')

console.log('→ depositing on-chain (local sign + send)…')
let signature
try {
  signature = await depositUsdc({ secretKey, depositCode: CODE, amountUsdc: AMOUNT })
} catch (err) {
  console.error(`\n✗ deposit failed: ${err?.message ?? err}`)
  process.exit(1)
}
console.log(`✓ tx: ${signature}`)
console.log(`  https://explorer.solana.com/tx/${signature}\n`)

console.log('→ confirming balance credits…')
let after = before
for (let i = 0; i < 12; i++) {
  await sleep(3000)
  after = await usePodBalance(TOKEN).catch(() => after)
  process.stdout.write(`  ${fmt(after.usdc)}\r`)
  if (after.usdc > before.usdc) break
}
const delta = after.usdc - before.usdc
console.log(`\n  balance: ${fmt(after.usdc)} (after)  ·  Δ ${fmt(delta)}`)
if (delta + 1e-9 >= AMOUNT) {
  console.log(`\n✓ credited — UsePod funded. Run the portal in real mode:`)
  console.log(`  USEPOD_TOKEN=${TOKEN} node examples/chat-portal/server.mjs\n`)
} else {
  console.log(`\n⚠️  tx landed but UsePod hasn't credited ${fmt(AMOUNT)} yet — check the tx above.\n`)
}
