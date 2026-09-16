/**
 * Localnet x402 setup: payer + treasury wallets, a 6-decimal USDC stand-in
 * mint, funded payer ATA. Writes scripts/.localnet.json for the gateway env
 * and the paid-call script.
 *
 * Run: node --import tsx scripts/localnet-setup.mts
 */
import web3 from '@solana/web3.js'
import * as splToken from '@solana/spl-token'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RPC = 'http://127.0.0.1:8899'
const connection = new web3.Connection(RPC, 'confirmed')
const log = (m: string): void => console.log(`[localnet-setup] ${m}`)

async function confirmed(sig: string, desc: string): Promise<void> {
  const latest = await connection.getLatestBlockhash()
  await connection.confirmTransaction({ signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, 'confirmed')
  log(`${desc} confirmed (${sig.slice(0, 12)}…)`)
}

async function main(): Promise<void> {
  const payer = web3.Keypair.generate()
  const treasury = web3.Keypair.generate()
  log(`payer:    ${payer.publicKey.toBase58()}`)
  log(`treasury: ${treasury.publicKey.toBase58()}`)

  for (const [kp, desc] of [[payer, 'payer'], [treasury, 'treasury']] as const) {
    const sig = await connection.requestAirdrop(kp.publicKey, 1 * web3.LAMPORTS_PER_SOL)
    await confirmed(sig, `${desc} SOL airdrop`)
  }

  const mint = await splToken.createMint(connection, payer, payer.publicKey, payer.publicKey, 6)
  log(`USDC stand-in mint: ${mint.toBase58()}`)

  const payerAta = await splToken.getAssociatedTokenAddress(mint, payer.publicKey)
  const vtx = new web3.VersionedTransaction(
    new web3.TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [splToken.createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, payerAta, payer.publicKey, mint)],
    }).compileToV0Message(),
  )
  vtx.sign([payer])
  await confirmed(await connection.sendTransaction(vtx), 'payer ATA')

  const mintSig = await splToken.mintTo(connection, payer, mint, payerAta, payer, 10_000_000)
  await confirmed(mintSig, 'payer USDC minted (10.00)')

  writeFileSync(
    resolve(import.meta.dirname, '.localnet.json'),
    JSON.stringify(
      {
        rpc: RPC,
        mint: mint.toBase58(),
        treasury: treasury.publicKey.toBase58(),
        payerSecret: Array.from(payer.secretKey),
      },
      null,
      2,
    ),
  )
  log('wrote scripts/.localnet.json')
  log('✓ setup complete')
}

main().catch((err) => {
  console.error('[localnet-setup] FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
