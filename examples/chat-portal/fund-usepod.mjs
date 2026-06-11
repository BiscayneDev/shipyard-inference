// Standalone Paybox → UsePod funding test. Proves depositUsdcWithSigner() end to
// end in isolation — register (or reuse) a UsePod token, deposit a small amount
// of USDC from a Paybox wallet on-chain, and confirm the balance credits.
//
//   npm run build
//   PAYBOX_CREDENTIAL_ID=<wallet-cred> node examples/chat-portal/fund-usepod.mjs [amountUsd]
//
// Auth (one of): `paybox login`  ·  PAYBOX_API_KEY=...  ·  PAYBOX_ACCESS_TOKEN=...
// (+ PAYBOX_SIGNING_KEY=pbxk1... for hands-off, in-process signing).
//
// ⚠️ UsePod's deposit program is MAINNET — this spends REAL USDC. Start tiny.
//
// Reuse a token across runs (skip re-registering) by passing both:
//   USEPOD_TOKEN=<token> USEPOD_DEPOSIT_CODE=<16-hex> ...
//
// Env: SHIPYARD_SETTLE_NETWORK (mainnet default), USEPOD_RPC_URL, USEPOD_USDC_MINT.
import {
  payboxSigner,
  registerUsePod,
  depositUsdcWithSigner,
  usePodBalance,
} from 'shipyard-inference'

const AMOUNT = Number(process.argv[2] ?? process.env.USEPOD_FUND_USD ?? 0.5)
const NETWORK = process.env.SHIPYARD_SETTLE_NETWORK === 'devnet' ? 'devnet' : 'mainnet'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fmt = (n) => `$${Number(n).toFixed(6)}`
const explorerUrl = (sig) =>
  `https://explorer.solana.com/tx/${sig}${NETWORK === 'mainnet' ? '' : `?cluster=${NETWORK}`}`

function die(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

if (!process.env.PAYBOX_CREDENTIAL_ID) die('set PAYBOX_CREDENTIAL_ID (your Paybox wallet credential id)')
if (!(AMOUNT > 0)) die(`amount must be > 0 (got ${AMOUNT})`)

console.log('Paybox → UsePod funding test')
console.log(`  network: ${NETWORK}${NETWORK === 'mainnet' ? '  ⚠️  REAL USDC' : ''}`)
console.log(`  amount:  ${fmt(AMOUNT)} USDC`)

// 1. Paybox signer (non-custodial — no raw key in this process).
let signer
try {
  signer = await payboxSigner({ credentialId: process.env.PAYBOX_CREDENTIAL_ID, network: NETWORK })
} catch (err) {
  die(`payboxSigner failed: ${err?.message ?? err}\n  Is Paybox authenticated? (paybox login / PAYBOX_API_KEY)`)
}
console.log(`  payer:   ${signer.publicKey}`)

// 2. UsePod token — reuse if provided, else register a fresh one.
let token = process.env.USEPOD_TOKEN
let depositCode = process.env.USEPOD_DEPOSIT_CODE
if (token && depositCode) {
  console.log(`  token:   ${token}  (reused)`)
} else {
  const account = await registerUsePod().catch((err) => die(`registerUsePod failed: ${err?.message ?? err}`))
  token = account.token
  depositCode = account.depositCode
  console.log(`  token:   ${token}  (registered)`)
  console.log(`  reuse next time:  USEPOD_TOKEN=${token} USEPOD_DEPOSIT_CODE=${depositCode}`)
}

const before = await usePodBalance(token).catch(() => ({ usdc: 0 }))
console.log(`  balance: ${fmt(before.usdc)} (before)\n`)

// 3. The real deposit — Paybox signs the on-chain depositUsdc(code, amount).
console.log('→ depositing (Paybox signs on-chain)…')
let signature
try {
  signature = await depositUsdcWithSigner({
    signer,
    depositCode,
    amountUsdc: AMOUNT,
    network: NETWORK,
    rpcUrl: process.env.USEPOD_RPC_URL,
    usdcMint: process.env.USEPOD_USDC_MINT,
  })
} catch (err) {
  die(`deposit failed: ${err?.message ?? err}`)
}
console.log(`✓ tx: ${signature}`)
console.log(`  ${explorerUrl(signature)}\n`)

// 4. Confirm the balance credits (UsePod may lag the on-chain confirm a beat).
console.log('→ confirming balance credits…')
let after = before
for (let i = 0; i < 10; i++) {
  await sleep(3000)
  after = await usePodBalance(token).catch(() => after)
  process.stdout.write(`  ${fmt(after.usdc)}\r`)
  if (after.usdc > before.usdc) break
}
const delta = after.usdc - before.usdc
console.log(`\n  balance: ${fmt(after.usdc)} (after)  ·  Δ ${fmt(delta)}`)
if (delta + 1e-9 >= AMOUNT) {
  console.log('\n✓ credited — depositUsdcWithSigner works end to end.\n')
} else {
  console.log(
    `\n⚠️  on-chain tx landed but the UsePod balance hasn't credited ${fmt(AMOUNT)} yet.` +
      `\n   Give it a moment, or check the tx above. (If it never credits, the deposit` +
      `\n   program account layout may differ from the on-chain IDL — share the tx.)\n`,
  )
}
