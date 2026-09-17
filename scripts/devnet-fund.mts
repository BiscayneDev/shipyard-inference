/**
 * Devnet funding for the First Stranger's Dollar test: REAL public network,
 * REAL devnet USDC (Circle faucet), REAL payment-channels program. Generates
 * the merchant (operator) + a test payer wallet, funds both, and writes
 * .devnet.json for the portal + browser-payer test.
 *
 * Run: node --import tsx scripts/devnet-fund.mts
 */
import web3 from '@solana/web3.js'
import * as splToken from '@solana/spl-token'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RPC = 'https://api.devnet.solana.com'
const USDC_DEVNET = new web3.PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
const connection = new web3.Connection(RPC, 'confirmed')
const log = (m: string): void => console.log(`[devnet-fund] ${m}`)
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function confirmed(sig: string, desc: string): Promise<void> {
  const latest = await connection.getLatestBlockhash()
  await connection.confirmTransaction({ signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, 'confirmed')
  log(`${desc} confirmed (${sig.slice(0, 10)}…)`)
}

async function airdrop(kp: web3.Keypair, sol: number, desc: string): Promise<void> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const sig = await connection.requestAirdrop(kp.publicKey, sol * web3.LAMPORTS_PER_SOL)
      await confirmed(sig, `${desc} SOL airdrop (${sol})`)
      return
    } catch (err) {
      lastErr = err
      log(`${desc} airdrop attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`)
      await sleep(15_000)
    }
  }
  throw new Error(`airdrop to ${desc} failed: ${lastErr}`)
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
      log(`Circle faucet attempt ${attempt}: HTTP ${res.status} ${body.message ?? ''}`)
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
  const payer = web3.Keypair.generate()
  const operator = web3.Keypair.generate()
  log(`payer (test stranger): ${payer.publicKey.toBase58()}`)
  log(`operator (merchant):  ${operator.publicKey.toBase58()}`)

  await airdrop(payer, 0.5, 'payer')
  await airdrop(operator, 0.5, 'operator')

  // ATAs for real devnet USDC.
  const payerAta = await splToken.getAssociatedTokenAddress(USDC_DEVNET, payer.publicKey)
  const operatorAta = await splToken.getAssociatedTokenAddress(USDC_DEVNET, operator.publicKey)
  const vtx = new web3.VersionedTransaction(
    new web3.TransactionMessage({
      payerKey: operator.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        splToken.createAssociatedTokenAccountIdempotentInstruction(operator.publicKey, payerAta, payer.publicKey, USDC_DEVNET),
        splToken.createAssociatedTokenAccountIdempotentInstruction(operator.publicKey, operatorAta, operator.publicKey, USDC_DEVNET),
      ],
    }).compileToV0Message(),
  )
  vtx.sign([operator])
  await confirmed(await connection.sendTransaction(vtx), 'payer + operator USDC ATAs')

  if (!(await faucetUsdc(payerAta.toBase58()))) throw new Error('Circle devnet USDC faucet did not deliver; aborting')
  const balance = await splToken.getAccount(connection, payerAta).then((a) => Number(a.amount)).catch(() => 0)
  if (balance <= 0) throw new Error('no USDC landed in payer account')
  log(`payer holds ${(balance / 1e6).toFixed(2)} devnet USDC`)

  writeFileSync(
    resolve(process.cwd(), '../pay-kit/typescript/examples/shipyard-inference-session/.devnet.json'),
    JSON.stringify(
      {
        rpc: RPC,
        mint: USDC_DEVNET.toBase58(),
        treasury: operator.publicKey.toBase58(),
        payerSecret: Array.from(payer.secretKey),
        operatorSecret: Array.from(operator.secretKey),
      },
      null,
      2,
    ),
  )
  log('wrote .devnet.json')
  log('✓ devnet funding complete')
}

main().catch((err) => {
  console.error('[devnet-fund] FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
