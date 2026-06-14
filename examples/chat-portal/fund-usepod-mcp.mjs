// Paybox → UsePod funding via the Paybox MCP signer (no CLI / API key needed).
//
// The portal SDK splits the deposit into build → sign → submit so an *external*
// signer can do the middle step. The Paybox MCP's request_wallet_sign (op
// `solanaTransaction`) is exactly such a signer, so this script drives the two
// SDK-side phases and leaves signing to the MCP (run by Claude between phases):
//
//   1) node fund-usepod-mcp.mjs build <amountUsd>
//        → registers (or reuses) a UsePod token, builds the UNSIGNED deposit tx,
//          writes state to .usepod-fund.json, prints the base64 to sign.
//   2) <Claude calls Paybox MCP request_wallet_sign on that base64 → signed b64>
//   3) node fund-usepod-mcp.mjs submit <signedTxBase64>
//        → broadcasts the signed tx, confirms the UsePod balance credits.
//
// ⚠️ UsePod's deposit program is MAINNET — this spends REAL USDC. Start tiny.
//
// Reuse a token across runs:  USEPOD_TOKEN=<token> USEPOD_DEPOSIT_CODE=<16-hex>
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import {
  registerUsePod,
  buildUsePodDepositTx,
  submitSolanaTransaction,
  usePodBalance,
} from 'shipyard-inference'

const STATE = new URL('./.usepod-fund.json', import.meta.url)
const PAYER = process.env.PAYBOX_WALLET ?? '96prEXTwmkxdJgxTuTRDAgTz9oPJcPCCoe3Zo7oQLgB6'
const NETWORK = process.env.SHIPYARD_SETTLE_NETWORK === 'devnet' ? 'devnet' : 'mainnet'
const RPC = process.env.USEPOD_RPC_URL
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fmt = (n) => `$${Number(n).toFixed(6)}`
const explorer = (sig) =>
  `https://explorer.solana.com/tx/${sig}${NETWORK === 'mainnet' ? '' : `?cluster=${NETWORK}`}`
const die = (m) => { console.error(`\n✗ ${m}\n`); process.exit(1) }

const phase = process.argv[2]

if (phase === 'build') {
  const amount = Number(process.argv[3] ?? process.env.USEPOD_FUND_USD ?? 0.25)
  if (!(amount > 0)) die(`amount must be > 0 (got ${amount})`)
  console.log('Paybox(MCP) → UsePod  ·  build phase')
  console.log(`  network: ${NETWORK}${NETWORK === 'mainnet' ? '  ⚠️  REAL USDC' : ''}`)
  console.log(`  payer:   ${PAYER}`)
  console.log(`  amount:  ${fmt(amount)} USDC`)

  let token = process.env.USEPOD_TOKEN
  let depositCode = process.env.USEPOD_DEPOSIT_CODE
  if (token && depositCode) {
    console.log(`  token:   ${token}  (reused)`)
  } else {
    const acct = await registerUsePod().catch((e) => die(`registerUsePod failed: ${e?.message ?? e}`))
    token = acct.token
    depositCode = acct.depositCode
    console.log(`  token:   ${token}  (registered)`)
  }

  const before = await usePodBalance(token).catch(() => ({ usdc: 0 }))
  const built = await buildUsePodDepositTx({
    payer: PAYER, depositCode, amountUsdc: amount, network: NETWORK, rpcUrl: RPC,
  }).catch((e) => die(`buildUsePodDepositTx failed: ${e?.message ?? e}`))

  writeFileSync(STATE, JSON.stringify(
    { token, depositCode, payer: PAYER, amount, network: NETWORK, before: before.usdc },
    null, 2,
  ))
  console.log(`  balance: ${fmt(before.usdc)} (before)`)
  console.log(`\n  state →  ${STATE.pathname}`)
  console.log('\n--- UNSIGNED TX (base64) — sign via Paybox MCP request_wallet_sign ---')
  console.log(built.transactionBase64)
  console.log('--- end ---\n')
} else if (phase === 'submit') {
  const signed = process.argv[3] ?? process.env.SIGNED_TX_BASE64
  if (!signed) die('pass the MCP-signed tx base64:  node fund-usepod-mcp.mjs submit <signedBase64>')
  if (!existsSync(STATE)) die('no .usepod-fund.json — run the build phase first')
  const st = JSON.parse(readFileSync(STATE, 'utf8'))
  console.log('Paybox(MCP) → UsePod  ·  submit phase')
  console.log(`  token:   ${st.token}`)
  console.log(`  amount:  ${fmt(st.amount)} USDC`)

  console.log('\n→ broadcasting signed tx…')
  let sig
  try {
    sig = await submitSolanaTransaction({ signedTransactionBase64: signed, network: st.network, rpcUrl: RPC })
  } catch (e) {
    die(`submit failed: ${e?.message ?? e}`)
  }
  console.log(`✓ tx: ${sig}`)
  console.log(`  ${explorer(sig)}\n`)

  console.log('→ confirming balance credits…')
  let after = { usdc: st.before }
  for (let i = 0; i < 12; i++) {
    await sleep(3000)
    after = await usePodBalance(st.token).catch(() => after)
    process.stdout.write(`  ${fmt(after.usdc)}\r`)
    if (after.usdc > st.before) break
  }
  const delta = after.usdc - st.before
  console.log(`\n  balance: ${fmt(after.usdc)} (after)  ·  Δ ${fmt(delta)}`)
  if (delta + 1e-9 >= st.amount) {
    console.log(`\n✓ credited — funded UsePod via the Paybox MCP signer.`)
    console.log(`  Run the portal in real mode:  USEPOD_TOKEN=${st.token} node examples/chat-portal/server.mjs\n`)
  } else {
    console.log(`\n⚠️  tx landed but UsePod hasn't credited ${fmt(st.amount)} yet — recheck the tx above.\n`)
  }
} else {
  die('usage: fund-usepod-mcp.mjs build <amountUsd>   |   fund-usepod-mcp.mjs submit <signedBase64>')
}
