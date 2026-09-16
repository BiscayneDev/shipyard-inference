/**
 * Localnet session funding: wallets + USDC stand-in mint for the pay-kit MPP
 * session spike. Funds the session payer (SOL + USDC) and the merchant/operator
 * fee payer (SOL). Also patches pay-kit's USDC map with a `localnet` entry
 * pointing at the stand-in mint, then you rebuild pay-kit.
 *
 * Run: node --import tsx scripts/localnet-session-fund.mts
 */
import web3 from '@solana/web3.js'
import * as splToken from '@solana/spl-token'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RPC = 'http://127.0.0.1:8899'
const OUT = resolve(process.env.HOME!, 'projects/pay-kit/typescript/examples/shipyard-inference-session/.session.json')
const CONSTANTS = resolve(process.env.HOME!, 'projects/pay-kit/typescript/packages/mpp/src/constants.ts')
const connection = new web3.Connection(RPC, 'confirmed')
const log = (m: string): void => console.log(`[session-fund] ${m}`)

async function confirmed(sig: string, desc: string): Promise<void> {
  const latest = await connection.getLatestBlockhash()
  await connection.confirmTransaction({ signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, 'confirmed')
  log(`${desc} confirmed (${sig.slice(0, 10)}…)`)
}

async function fund(kp: web3.Keypair, desc: string): Promise<void> {
  const sig = await connection.requestAirdrop(kp.publicKey, 2 * web3.LAMPORTS_PER_SOL)
  await confirmed(sig, `${desc} SOL`)
}

async function main(): Promise<void> {
  const client = web3.Keypair.generate()
  const operator = web3.Keypair.generate() // merchant: fee payer + settlement signer + recipient
  log(`client:   ${client.publicKey.toBase58()}`)
  log(`operator: ${operator.publicKey.toBase58()}`)

  await fund(client, 'client')
  await fund(operator, 'operator')

  const mint = await splToken.createMint(connection, operator, operator.publicKey, operator.publicKey, 6)
  log(`USDC stand-in mint: ${mint.toBase58()}`)

  const clientAta = await splToken.getAssociatedTokenAddress(mint, client.publicKey)
  const vtx = new web3.VersionedTransaction(
    new web3.TransactionMessage({
      payerKey: operator.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        splToken.createAssociatedTokenAccountIdempotentInstruction(operator.publicKey, clientAta, client.publicKey, mint),
      ],
    }).compileToV0Message(),
  )
  vtx.sign([operator])
  await confirmed(await connection.sendTransaction(vtx), 'client ATA')

  const mintSig = await splToken.mintTo(connection, operator, mint, clientAta, operator, 5_000_000)
  await confirmed(mintSig, 'client USDC minted (5.00)')

  writeFileSync(OUT, JSON.stringify({
    rpc: RPC,
    mint: mint.toBase58(),
    clientSecret: Array.from(client.secretKey),
    operatorSecret: Array.from(operator.secretKey),
  }, null, 2))
  log(`wrote ${OUT}`)

  // Patch pay-kit's USDC map so network 'localnet' resolves to our mint.
  const src = readFileSync(CONSTANTS, 'utf8')
  const patched = src.replace(
    /export const USDC: Record<string, string> = \{\n(\s*)devnet:/,
    (m, indent) => `export const USDC: Record<string, string> = {\n${indent}localnet: '${mint.toBase58()}',\n${indent}devnet:`,
  )
  if (patched === src) {
    log('WARNING: constants.ts patch did not apply (USDC map not found or already patched?)')
  } else {
    writeFileSync(CONSTANTS, patched)
    log('patched pay-kit constants.ts (USDC.localnet → stand-in mint). Rebuild pay-kit now.')
  }
  log('✓ funding complete')
}

main().catch((err) => {
  console.error('[session-fund] FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
