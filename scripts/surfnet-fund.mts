/**
 * Surfnet funding: the Solana Foundation's hosted sandbox for the x402/MPP
 * stack. Same payment-channels program as mainnet, mainnet USDC mint
 * (simulated), instant cheatcode faucet — no rate limits. This is the public
 * network a stranger can test against before mainnet.
 *
 * Run: node --import tsx scripts/surfnet-fund.mts
 */
import web3 from '@solana/web3.js'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RPC = 'https://402.surfnet.dev:8899'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // mainnet USDC (Surfnet simulates it)
const SYSTEM_PROGRAM = '11111111111111111111111111111111'
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const log = (m: string): void => console.log(`[surfnet-fund] ${m}`)

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } }
  if (body.error) throw new Error(`${method}: ${body.error.message}`)
  return body.result
}

async function main(): Promise<void> {
  const payer = web3.Keypair.generate()
  const operator = web3.Keypair.generate()
  log(`payer (test stranger): ${payer.publicKey.toBase58()}`)
  log(`operator (merchant):  ${operator.publicKey.toBase58()}`)

  for (const [kp, desc] of [[payer, 'payer'], [operator, 'operator']] as const) {
    await rpc('surfnet_setAccount', [
      kp.publicKey.toBase58(),
      { lamports: 100_000_000_000, data: '', executable: false, owner: SYSTEM_PROGRAM, rentEpoch: 0 },
    ])
    await rpc('surfnet_setTokenAccount', [
      kp.publicKey.toBase58(),
      USDC_MINT,
      { amount: 100_000_000, state: 'initialized' },
      TOKEN_PROGRAM,
    ])
    log(`${desc} funded: 100 SOL + 100 USDC`)
  }

  writeFileSync(
    resolve(process.cwd(), '../pay-kit/typescript/examples/shipyard-inference-session/.devnet.json'),
    JSON.stringify(
      {
        rpc: RPC,
        mint: USDC_MINT,
        treasury: operator.publicKey.toBase58(),
        payerSecret: Array.from(payer.secretKey),
        operatorSecret: Array.from(operator.secretKey),
      },
      null,
      2,
    ),
  )
  log('wrote .devnet.json')
  log('✓ Surfnet funding complete')
}

main().catch((err) => {
  console.error('[surfnet-fund] FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
