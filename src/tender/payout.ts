import bs58 from 'bs58'
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from '@solana/spl-token'

// Gateway-side payout: send a developer's accrued kickback balance on-chain as
// USDC, signed by a dedicated payout keypair the gateway holds. This is loaded
// LAZILY (never from the tender barrel) so @solana/web3.js stays off the boot
// path — a missing bundle degrades /claim, never crashes the whole function.
//
// @security devnet hot wallet only. For mainnet, move to a custodial/Paybox
// signer — never ship a mainnet secret in an env var.

const USDC_MINT = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const

const DEFAULT_RPC = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
} as const

export interface PayoutConfig {
  network: 'mainnet' | 'devnet'
  rpcUrl?: string
  usdcMint?: string
  signer: Keypair
}

/** Build the payout config from env, or undefined if no payout secret is set. */
export function loadPayoutConfig(env: Record<string, string | undefined> = process.env): PayoutConfig | undefined {
  const secret = (env.TENDER_PAYOUT_SECRET || env.SOLANA_PAYER_SECRET)?.trim()
  if (!secret) return undefined
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(JSON.parse(secret) as number[]) // Solana CLI keypair format
  } catch {
    return undefined
  }
  return {
    network: env.SHIPYARD_SETTLE_NETWORK === 'mainnet' ? 'mainnet' : 'devnet',
    rpcUrl: env.SHIPYARD_SETTLE_RPC_URL?.trim() || undefined,
    usdcMint: env.SHIPYARD_SETTLE_USDC_MINT?.trim() || undefined,
    signer: Keypair.fromSecretKey(bytes),
  }
}

/** The payout wallet's public address (for display / funding). */
export const payoutAddress = (cfg: PayoutConfig): string => cfg.signer.publicKey.toBase58()

export interface PayoutResult {
  signature: string
  from: string
  to: string
  amountUsdc: number
}

/**
 * Send `amountUsdc` USDC from the payout wallet to `toWallet` on-chain (creates
 * the recipient's USDC token account if needed). Returns the confirmed signature.
 */
export async function preparePayoutUsdc(cfg: PayoutConfig, toWallet: string, amountUsdc: number) {
  const conn = new Connection(cfg.rpcUrl ?? DEFAULT_RPC[cfg.network], 'confirmed')
  const mint = new PublicKey(cfg.usdcMint ?? USDC_MINT[cfg.network])
  const payer = cfg.signer.publicKey
  const dest = new PublicKey(toWallet)
  const payerAta = await getAssociatedTokenAddress(mint, payer)
  const destAta = await getAssociatedTokenAddress(mint, dest)
  const atomic = BigInt(Math.round(amountUsdc * 1_000_000))

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash })
  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, destAta, dest, mint))
  tx.add(createTransferCheckedInstruction(payerAta, mint, destAta, payer, atomic, 6))
  tx.sign(cfg.signer)

  const bytes = tx.serialize()
  const signature = bs58.encode(tx.signature!)
  return { signature, network: cfg.network, async broadcast(): Promise<void> {
    const sent = await conn.sendRawTransaction(bytes, { maxRetries: 0 })
    if (sent !== signature) throw new Error('Unexpected payout signature')
    const result = await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
    if (result.value.err) throw new Error('Payout was not confirmed successful')
  } }
}

/** Legacy standalone caller. Hosted Tender routes use prepare/persist/broadcast. */
export async function payoutUsdc(cfg: PayoutConfig, toWallet: string, amountUsdc: number): Promise<PayoutResult> {
  const prepared = await preparePayoutUsdc(cfg, toWallet, amountUsdc)
  await prepared.broadcast()
  return { signature: prepared.signature, from: cfg.signer.publicKey.toBase58(), to: toWallet, amountUsdc }
}
