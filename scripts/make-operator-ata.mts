/** One-off: create the session operator's USDC ATA (recipient of channel payouts). */
import web3 from '@solana/web3.js'
import * as splToken from '@solana/spl-token'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RPC = 'http://127.0.0.1:8899'
const connection = new web3.Connection(RPC, 'confirmed')
const setup = JSON.parse(readFileSync(resolve(process.cwd(), '../pay-kit/typescript/examples/shipyard-inference-session/.session.json'), 'utf8')) as {
  mint: string
  operatorSecret: number[]
}
const operator = web3.Keypair.fromSecretKey(new Uint8Array(setup.operatorSecret))
const mint = new web3.PublicKey(setup.mint)

const ata = await splToken.getAssociatedTokenAddress(mint, operator.publicKey)
const vtx = new web3.VersionedTransaction(
  new web3.TransactionMessage({
    payerKey: operator.publicKey,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [splToken.createAssociatedTokenAccountIdempotentInstruction(operator.publicKey, ata, operator.publicKey, mint)],
  }).compileToV0Message(),
)
vtx.sign([operator])
const sig = await connection.sendTransaction(vtx)
await connection.confirmTransaction(sig)
console.log(`operator ATA ${ata.toBase58()} created (${sig.slice(0, 10)}…)`)
