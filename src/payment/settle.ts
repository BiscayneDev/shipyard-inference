import {
  MissingDependencyError,
  PaymentError,
  type SolanaSigner,
} from './types.js'

/** Canonical USDC mints by Solana cluster. */
const USDC_MINT = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const

const DEFAULT_RPC = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
} as const

export interface PayboxSettleOptions {
  /**
   * Signer for the *user's* wallet — `payboxSigner({ credentialId })` for a
   * Paybox-custodied wallet (server-side, signs within the user's scoped grant)
   * or `keypairSigner`. The wallet is debited.
   */
  signer: SolanaSigner
  /** Treasury wallet address (owner) that receives the USDC. */
  treasury: string
  /** Amount to transfer, in **atomic USDC units** (6 decimals): `'1500000'` = $1.50. */
  amount: string
  /** Cluster. Defaults to `devnet` for safety. */
  network?: 'mainnet' | 'devnet'
  /** RPC endpoint. Defaults to the public endpoint for the chosen network. */
  rpcUrl?: string
  /** USDC mint override (defaults to the canonical mint for the network). */
  usdcMint?: string
  /**
   * Prepend an idempotent create-instruction for the treasury's token account
   * so settlement doesn't fail if it doesn't exist yet. Default `true`. (The
   * payer funds the tiny rent; the instruction is a no-op if the account exists.)
   */
  ensureRecipientAta?: boolean
  /**
   * Advanced/testing: inject a `@solana/web3.js` `Connection`-compatible object
   * (`getLatestBlockhash` / `sendRawTransaction` / `confirmTransaction`).
   * Defaults to a `Connection` built from `rpcUrl`.
   */
  connection?: unknown
}

export interface PayboxSettleResult {
  /** The on-chain transaction signature. */
  signature: string
  /** Atomic USDC amount transferred (echoes the request). */
  amount: string
  /** Treasury that received the funds. */
  treasury: string
  /** The payer (user) wallet that was debited. */
  payer: string
}

/**
 * Charge a user's accrued usage by transferring USDC from their wallet to a
 * treasury, on Solana — the settlement half of meter-then-settle billing. Builds
 * a USDC transfer, signs it with the user's `SolanaSigner` (a `payboxSigner`
 * signs server-side within the user's scoped Paybox grant — Paybox is
 * server-side only, so there is no per-call browser signing), submits it, and
 * confirms. Requires the optional peers `@solana/web3.js` + `@solana/spl-token`.
 *
 * ⚠️ UNVERIFIED on-chain path: faithful to the SPL transfer flow but not
 * exercised against a live cluster here — run a small real settlement on devnet
 * and confirm receipt before relying on it. Idempotency/double-charge protection
 * is the caller's responsibility (e.g. mark the ledger settled in the same
 * transaction as recording the returned `signature`).
 *
 * @example
 *   const sig = await payboxSettle({
 *     signer: await payboxSigner({ credentialId: user.paybox_credential_id }),
 *     treasury: process.env.TREASURY_WALLET!,
 *     amount: String(Math.round(owedUsd * 1_000_000)),
 *     network: 'mainnet',
 *   })
 */
export async function payboxSettle(
  options: PayboxSettleOptions,
): Promise<PayboxSettleResult> {
  if (!/^\d+$/.test(options.amount) || BigInt(options.amount) <= 0n) {
    throw new PaymentError(
      `[shipyard-inference] payboxSettle requires a positive atomic USDC amount, got '${options.amount}'`,
    )
  }

  const network = options.network ?? 'devnet'
  const mintAddr = options.usdcMint ?? USDC_MINT[network]

  let web3: typeof import('@solana/web3.js')
  let splToken: typeof import('@solana/spl-token')
  try {
    web3 = await import('@solana/web3.js')
    splToken = await import('@solana/spl-token')
  } catch {
    throw new MissingDependencyError(
      '@solana/web3.js and @solana/spl-token',
      'payboxSettle',
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connection: any =
    options.connection ??
    new web3.Connection(options.rpcUrl ?? DEFAULT_RPC[network], 'confirmed')

  const payer = new web3.PublicKey(options.signer.publicKey)
  const treasury = new web3.PublicKey(options.treasury)
  const mint = new web3.PublicKey(mintAddr)

  const payerAta = await splToken.getAssociatedTokenAddress(mint, payer)
  const treasuryAta = await splToken.getAssociatedTokenAddress(mint, treasury)

  const instructions = []
  if (options.ensureRecipientAta ?? true) {
    instructions.push(
      splToken.createAssociatedTokenAccountIdempotentInstruction(
        payer, // payer of the rent
        treasuryAta,
        treasury, // owner
        mint,
      ),
    )
  }
  instructions.push(
    splToken.createTransferInstruction(payerAta, treasuryAta, payer, BigInt(options.amount)),
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const message = new web3.TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message()

  const tx = new web3.VersionedTransaction(message)
  const signed = await options.signer.signTransaction(tx.serialize())

  const signature: string = await connection.sendRawTransaction(signed, {
    skipPreflight: false,
  })
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  )
  if (confirmation?.value?.err) {
    throw new PaymentError(
      `[shipyard-inference] payboxSettle transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`,
    )
  }

  return {
    signature,
    amount: options.amount,
    treasury: options.treasury,
    payer: options.signer.publicKey,
  }
}
