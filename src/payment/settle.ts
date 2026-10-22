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
  /**
   * Cluster — REQUIRED, no default. Settlement moves real USDC, so the caller
   * must say out loud which cluster: a silent `devnet` default would book real
   * usage as "settled" in worthless tokens, and a silent `mainnet` default
   * would let a careless test spend real funds. Pass the same network you gave
   * `payboxSigner` (its default is `mainnet` — mismatch signs transfers on the
   * wrong cluster).
   */
  network: 'mainnet' | 'devnet'
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
 * On-chain path verified 2026-10-22 against a local Agave 4.3.1 test
 * validator (web3.js 1.99.0, spl-token 0.4.15): recipient-ATA creation,
 * transfer, broadcast and confirmation all exercised with both a
 * legacy-transaction signer and a versioned-capable signer.
 * Idempotency/double-charge protection is the caller's responsibility (e.g.
 * mark the ledger settled in the same transaction as recording the returned
 * `signature`).
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

  const network = options.network
  if (network !== 'mainnet' && network !== 'devnet') {
    throw new PaymentError(
      `[shipyard-inference] payboxSettle requires an explicit network ('mainnet' | 'devnet'), got '${network}'`,
    )
  }
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
  // Build a LEGACY transaction (not versioned): the Paybox in-process signer
  // deserializes the payload with `Transaction.from()`, which throws on a v0
  // `VersionedTransaction`. The signer fills the fee-payer signature, so we
  // serialize the message with an empty signature slot.
  const tx = new web3.Transaction()
  tx.feePayer = payer
  tx.recentBlockhash = blockhash
  tx.add(...instructions)

  const unsigned = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  const signed = await options.signer.signTransaction(unsigned)

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
