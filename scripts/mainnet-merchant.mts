/**
 * Mainnet merchant wallet for the chat portal (real USDC).
 *
 * No faucet on mainnet — this generates the keypair, prints the address to
 * fund (a small amount of SOL covers settle fees for a long time), and writes
 * .mainnet.json for the portal env. The key never leaves this machine and is
 * gitignored.
 *
 * Run: node --import tsx scripts/mainnet-merchant.mts
 */
import web3 from '@solana/web3.js'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(process.cwd(), '../pay-kit/typescript/examples/shipyard-inference-session/.mainnet.json')
const log = (m: string): void => console.log(`[mainnet-merchant] ${m}`)

// Reuse an existing wallet if present (idempotent).
let kp: web3.Keypair
if (existsSync(OUT)) {
  const existing = JSON.parse(readFileSync(OUT, 'utf8')) as { operatorSecret: number[] }
  kp = web3.Keypair.fromSecretKey(new Uint8Array(existing.operatorSecret))
  log(`reusing existing merchant wallet: ${kp.publicKey.toBase58()}`)
} else {
  kp = web3.Keypair.generate()
  log(`generated new merchant wallet: ${kp.publicKey.toBase58()}`)
}

const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed')
const USDC = new web3.PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const TOKEN_PROGRAM_ID = new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ATA_PROGRAM = new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

const sol = await connection.getBalance(kp.publicKey)
log(`merchant SOL balance: ${sol / 1e9}`)

const ata = await web3.PublicKey.findProgramAddress(
  [kp.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC.toBuffer()],
  ATA_PROGRAM,
)
const ataInfo = await connection.getAccountInfo(ata[0])
log(`merchant USDC ATA ${ata[0].toBase58()}: ${ataInfo ? 'exists' : 'missing (created automatically on first settle — costs ~0.002 SOL)'}`)

// The program's hardcoded TREASURY_OWNER residual-sweep account must have a
// USDC ATA for distribute; the foundation's mainnet deployment should have it.
const TREASURY_OWNER = new web3.PublicKey('Cs2zdfUNonRdRGsiZUQQLdTxzxVvJZmgiX2mpLYKuEqP')
const treasuryAta = await web3.PublicKey.findProgramAddress(
  [TREASURY_OWNER.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC.toBuffer()],
  ATA_PROGRAM,
)
const treasuryInfo = await connection.getAccountInfo(treasuryAta[0])
log(`program treasury USDC ATA ${treasuryAta[0].toBase58()}: ${treasuryInfo ? 'exists ✓' : 'MISSING ⚠ (settle would fail)'}`)

if (!existsSync(OUT)) {
  writeFileSync(OUT, JSON.stringify({
    rpc: 'https://api.mainnet-beta.solana.com',
    mint: USDC.toBase58(),
    treasury: kp.publicKey.toBase58(),
    payerSecret: null,
    operatorSecret: Array.from(kp.secretKey),
  }, null, 2))
  log(`wrote ${OUT} (gitignored — never commit)`)
}

if (sol === 0) {
  log(`\n>>> FUND THIS ADDRESS WITH ~0.05 SOL (mainnet) to activate the merchant:`)
  log(`>>> ${kp.publicKey.toBase58()}`)
  log(`>>> (0.05 SOL covers thousands of settle transactions at ~0.000005 SOL each)`)
} else {
  log('merchant is funded and ready')
}
