// Browser x402 `exact` payer for the /connect funding step — Phantom (or any
// Wallet Standard Solana wallet) signs the USDC top-up settlement in-browser.
// The private key never leaves the wallet; the server never sees key material.
//
// The gateway's /v1/topup answers 402 with an `accepts` challenge (payTo =
// treasury, amount = atomic USDC, asset = mint). We build a USDC transfer to
// the treasury, sign it with the wallet, and send it back as the X-PAYMENT
// header the gateway's verifyX402Payment expects:
//   X-PAYMENT: base64(JSON({ payload: { transaction: base64(tx) } }))
// This mirrors the proven advertiser pay flow (ADVERTISE_HTML buildTransfer +
// Wallet Standard signer) and the gateway's own server-side payer.
//
// Bundled for the browser (Buffer polyfill injected — @solana/web3.js needs it):
//   npx esbuild examples/chat-portal/public/src/connect-pay.js --bundle \
//     --format=iife --target=es2020 \
//     --inject:examples/chat-portal/public/src/buffer-shim.js \
//     --outfile=examples/chat-portal/public/connect-pay-bundle.js --platform=browser
import * as web3 from '@solana/web3.js'
import * as spl from '@solana/spl-token'

const u8ToB64 = (u8) => {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}

// Public Solana RPCs, tried in order. The official endpoint rate-limits and
// returns 403 under load, so we fall through to alternates for the blockhash.
const MAINNET_RPCS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
]
const DEVNET_RPCS = ['https://api.devnet.solana.com']

function rpcList(net) {
  return net === 'mainnet' ? MAINNET_RPCS : DEVNET_RPCS
}

/** getLatestBlockhash with a fallback chain across public RPCs. */
async function latestBlockhash(net) {
  let lastErr
  for (const url of rpcList(net)) {
    try {
      const conn = new web3.Connection(url, 'confirmed')
      const bh = await conn.getLatestBlockhash()
      if (bh && bh.blockhash) return { conn, blockhash: bh.blockhash }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('all Solana RPCs failed to return a blockhash')
}

// USDC transferChecked to the treasury (idempotent dest ATA create).
async function buildTransfer(conn, pay, payer, blockhash) {
  const mint = new web3.PublicKey(pay.asset)
  const treasury = new web3.PublicKey(pay.payTo)
  const payerAta = await spl.getAssociatedTokenAddress(mint, payer)
  const destAta = await spl.getAssociatedTokenAddress(mint, treasury)
  const atomic = BigInt(pay.amount)
  const transferIx = spl.createTransferCheckedInstruction(payerAta, mint, destAta, payer, atomic, 6)
  const msg = new web3.TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [
      spl.createAssociatedTokenAccountIdempotentInstruction(payer, destAta, treasury, mint),
      transferIx,
    ],
  }).compileToV0Message()
  return new web3.VersionedTransaction(msg)
}

async function listWallets() {
  try {
    const mod = await import('https://esm.sh/@wallet-standard/app@1.1.0')
    const ws = mod.getWallets().get()
    return ws.filter((w) =>
      w.chains && w.chains.some((c) => c.indexOf('solana:') === 0) &&
      w.features['standard:connect'] &&
      (w.features['solana:signAndSendTransaction'] || w.features['solana:signTransaction']))
  } catch (e) { return [] }
}

/**
 * One wallet-paid top-up: POST /v1/topup with the bearer key; on 402 connect
 * the wallet, build + sign the USDC transfer to the treasury, retry with the
 * X-PAYMENT header. Returns the funded Response.
 */
async function topup(url, init = {}) {
  const probe = await fetch(url, init)
  if (probe.status !== 402) return probe // not a payment challenge (or already settled)

  const body = await probe.json()
  const accept = (body.accepts && body.accepts[0]) || body
  if (!accept.payTo || !accept.amount) throw new Error('No payable challenge returned')
  const pay = {
    network: accept.network || 'solana-mainnet',
    asset: accept.asset,
    amount: String(accept.maxAmountRequired ?? accept.amount),
    payTo: accept.payTo,
  }
  const net = pay.network === 'solana-mainnet' ? 'mainnet' : 'devnet'

  const { conn, blockhash } = await latestBlockhash(net)
  const ws = await listWallets()
  const legacy = (window.phantom && window.phantom.solana) ? window.phantom.solana : window.solana

  let payer, tx
  if (ws.length) {
    const cr = await ws[0].features['standard:connect'].connect()
    const acct = (cr && cr.accounts && cr.accounts[0]) || ws[0].accounts[0]
    payer = new web3.PublicKey(acct.publicKey)
    tx = await buildTransfer(conn, pay, payer, blockhash)
    const chain = 'solana:' + (net === 'mainnet' ? 'mainnet' : 'devnet')
    const sg = await ws[0].features['solana:signTransaction'].signTransaction({ account: acct, chain, transaction: tx.serialize() })
    tx = sg[0].signedTransaction
  } else if (legacy && legacy.signTransaction) {
    const res = await legacy.connect()
    const pk = (res && res.publicKey) ? res.publicKey : legacy.publicKey
    payer = new web3.PublicKey(pk.toString())
    tx = await buildTransfer(conn, pay, payer, blockhash)
    const out = await legacy.signTransaction(tx)
    tx = (out && out.signedTransaction) ? out.signedTransaction : out
  } else {
    throw new Error('No Solana wallet detected — install Phantom/Solflare/Backpack.')
  }

  const wire = tx.serialize ? tx.serialize() : tx
  const headers = { ...(init.headers ?? {}) }
  headers['X-PAYMENT'] = u8ToB64(new TextEncoder().encode(JSON.stringify({ payload: { transaction: u8ToB64(wire) } })))
  return await fetch(url, { ...init, headers })
}

window.ShipyardFund = {
  hasWallet: () => !!(window.phantom?.solana || window.solana),
  topup,
}
