/**
 * x402 devnet smoke: prove the full pay-per-call loop with real on-chain USDC.
 *
 *   1. Generates throwaway payer + treasury wallets on Solana devnet,
 *      airdrops SOL, creates USDC token accounts, and faucets USDC to the payer.
 *   2. Boots an in-process gateway (mock model) with x402 charging configured
 *      against the throwaway treasury.
 *   3. Calls /v1/chat/completions through createPayingFetch + keypairSigner:
 *      the gateway 402s, the payer signs a real USDC transfer, the gateway
 *      submits + confirms + verifies it, and the paid request is served.
 *   4. Verifies the treasury's USDC balance increased by exactly the price.
 *
 * Run: node --import tsx scripts/x402-smoke.mts
 */
import { serve } from '@hono/node-server'
import web3 from '@solana/web3.js'
import * as splToken from '@solana/spl-token'
import bs58 from 'bs58'
import { createGatewayApp } from '../src/gateway/index.js'
import { keypairSigner } from '../src/payment/keypair-signer.js'
import { createSolanaPayProvider, createPayingFetch } from '../src/payment/index.js'
import { candidate, mockProvider, model } from '../test/helpers.js'

const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
const RPC = process.env.X402_SMOKE_RPC ?? 'https://api.devnet.solana.com'
// Local validator (solana-test-validator): airdrops are instant and we mint our
// own 6-decimal USDC stand-in instead of using Circle's devnet faucet.
const IS_LOCAL = RPC.includes('127.0.0.1')
const PRICE_USDC = 0.001
const connection = new web3.Connection(RPC, 'confirmed')

const log = (msg: string): void => console.log(`[x402-smoke] ${msg}`)
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function confirmed(sig: string, desc: string): Promise<void> {
  const latest = await connection.getLatestBlockhash()
  await connection.confirmTransaction({ signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, 'confirmed')
  log(`${desc} confirmed (${sig.slice(0, 12)}…)`)
}

async function faucetUsdc(address: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch('https://faucet.circle.com/api/v1/mint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, chain: 'SOLANA-DEVNET' }),
      })
      const body = (await res.json().catch(() => ({}))) as { message?: string }
      log(`faucet attempt ${attempt}: HTTP ${res.status} ${body.message ?? ''}`)
      if (res.ok) {
        await sleep(15_000)
        return true
      }
    } catch (err) {
      log(`faucet attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`)
    }
    await sleep(10_000)
  }
  return false
}

async function main(): Promise<void> {
  // ── 1. Wallets ────────────────────────────────────────────────────────────
  const payer = web3.Keypair.generate()
  const treasury = web3.Keypair.generate()
  log(`payer:    ${payer.publicKey.toBase58()}`)
  log(`treasury: ${treasury.publicKey.toBase58()}`)

  let mint = new web3.PublicKey(USDC_DEVNET)

  const fund = async (kp: web3.Keypair, desc: string): Promise<void> => {
    let lastErr: unknown
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const sig = await connection.requestAirdrop(kp.publicKey, 0.05 * web3.LAMPORTS_PER_SOL)
        await confirmed(sig, `${desc} SOL airdrop`)
        return
      } catch (err) {
        lastErr = err
        log(`${desc} airdrop attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`)
        await sleep(20_000)
      }
    }
    throw new Error(`airdrop to ${kp.publicKey.toBase58()} failed: ${lastErr}`)
  }
  await fund(payer, 'payer')
  await fund(treasury, 'treasury')

  if (IS_LOCAL) {
    // Local validator: mint our own 6-decimal USDC stand-in (before the ATAs).
    mint = await splToken.createMint(connection, payer, payer.publicKey, payer.publicKey, 6)
    log(`local USDC mint: ${mint.toBase58()}`)
  }

  const payerAta = await splToken.getAssociatedTokenAddress(mint, payer.publicKey)
  const treasuryAta = await splToken.getAssociatedTokenAddress(mint, treasury.publicKey)
  for (const [owner, ata, desc] of [
    [payer, payerAta, 'payer USDC ATA'],
    [treasury, treasuryAta, 'treasury USDC ATA'],
  ] as const) {
    const vtx = new web3.VersionedTransaction(
      new web3.TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [splToken.createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, owner.publicKey, mint)],
      }).compileToV0Message(),
    )
    vtx.sign([payer])
    const sig = await connection.sendTransaction(vtx)
    await confirmed(sig, `${desc} created`)
  }

  if (IS_LOCAL) {
    const sig = await splToken.mintTo(connection, payer, mint, payerAta, payer, 5_000_000)
    await confirmed(sig, 'payer USDC minted locally')
  } else if (!(await faucetUsdc(payerAta.toBase58()))) {
    throw new Error('Circle devnet USDC faucet did not deliver; aborting')
  }
  const startBalance = await splToken.getAccount(connection, payerAta).then((a: { amount: bigint }) => Number(a.amount)).catch(() => 0n)
  if (startBalance <= 0n) throw new Error('no USDC landed in payer account')
  log(`payer has ${(Number(startBalance) / 1e6).toFixed(2)} USDC`)

  // ── 2. Gateway with x402 charging ─────────────────────────────────────────
  const provider = mockProvider(async () => ({ content: 'paid inference works', toolCalls: [], stopReason: 'end_turn' as const }))
  const payments: Array<{ payer?: string; amountUsdc: number }> = []
  const app = createGatewayApp({
    candidates: [candidate('mock', provider, [model('mock-model')])],
    // A configured key keeps auth *on*, so the keyless request below must pay.
    apiKeys: ['smoke-key'],
    x402: {
      treasury: treasury.publicKey.toBase58(),
      network: 'devnet',
      priceUsdc: PRICE_USDC,
      rpcUrl: RPC,
      usdcMint: mint.toBase58(),
    },
    onX402Payment: (p) => payments.push({ payer: p.payer, amountUsdc: p.amountUsdc }),
  })
  const server = serve({ fetch: app.fetch, port: 8879 })
  log('gateway on :8879 (x402 charging enabled)')

  // ── 3. Paid request ──────────────────────────────────────────────────────
  const signer = await keypairSigner(JSON.stringify(Array.from(payer.secretKey)))
  const payment = await createSolanaPayProvider({
    signer,
    network: 'devnet',
    rpcUrl: RPC,
    usdcMint: mint.toBase58(),
  })
  const payingFetch = createPayingFetch({
    paymentProvider: payment,
    // If the gateway rejects the first proof (e.g. blockhash aged out before
    // its submit), the re-challenge carries a fresh nonce → fresh blockhash.
    maxPaymentRetries: 2,
  })

  const res = await payingFetch('http://127.0.0.1:8879/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'mock-model', messages: [{ role: 'user', content: 'prove the loop' }] }),
  })
  const raw = await res.text()
  let body: { choices?: Array<{ message?: { content?: string } }> } = {}
  try {
    body = JSON.parse(raw) as typeof body
  } catch {
    body = {}
  }
  log(`response: HTTP ${res.status} "${body.choices?.[0]?.message?.content ?? ''}"`)
  if (res.status !== 200) {
    log(`failure body: ${raw.slice(0, 600)}`)
    throw new Error(`expected 200, got ${res.status}`)
  }
  if (body.choices?.[0]?.message?.content !== 'paid inference works') throw new Error('unexpected completion body')
  if (payments.length !== 1) throw new Error(`expected 1 collected payment, got ${payments.length}`)

  // ── 4. Treasury got paid ──────────────────────────────────────────────────
  const treasuryAfter = Number(await splToken.getAccount(connection, treasuryAta).then((a: { amount: bigint }) => a.amount))
  const usdc = treasuryAfter / 1e6
  log(`treasury holds ${usdc} USDC after ${payments.length} paid request(s)`)
  if (usdc + 1e-6 < PRICE_USDC) throw new Error(`treasury underpaid: ${usdc} < ${PRICE_USDC}`)
  if (payments[0].payer !== payer.publicKey.toBase58()) throw new Error('payer attribution mismatch')

  server.close(() => {})
  log(`✓ full loop verified: 402 → real USDC transfer (${PRICE_USDC}) → confirmed → served → attributed`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[x402-smoke] FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
