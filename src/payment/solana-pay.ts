import { createHash } from 'node:crypto'
import {
  type PaymentProvider,
  type PaymentRequirement,
  type PaymentResult,
  type SolanaSigner,
  type SpendCap,
  MissingDependencyError,
  PaymentError,
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

export interface SolanaPayProviderOptions {
  /** Signer for the payer wallet. Use `payboxSigner` or `keypairSigner`. */
  signer: SolanaSigner
  /** Cluster. Defaults to `devnet` for safety. */
  network?: 'mainnet' | 'devnet'
  /** RPC endpoint. Defaults to the public endpoint for the chosen network. */
  rpcUrl?: string
  /** USDC mint override (defaults to the canonical mint for the network). */
  usdcMint?: string
  /** Advisory cap recorded for documentation; enforcement is in `createPayingFetch`. */
  spendCap?: SpendCap
  /**
   * Encode the signed transaction into the value placed in the payment proof
   * header. The default emits a base64 x402 payload; override if your x402
   * server expects a different wire shape.
   */
  encodePayment?: (args: {
    requirement: PaymentRequirement
    signedTxBase64: string
    network: string
  }) => string
}

function defaultEncodePayment(args: {
  requirement: PaymentRequirement
  signedTxBase64: string
  network: string
}): string {
  const payload = {
    x402Version: 1,
    scheme: args.requirement.scheme,
    network: args.network,
    payload: { transaction: args.signedTxBase64 },
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

function idempotencyKey(req: PaymentRequirement): string {
  if (req.nonce) return req.nonce
  return createHash('sha256')
    .update(`${req.resource}|${req.amount}|${req.payTo}`)
    .digest('hex')
}

/**
 * A `PaymentProvider` that settles x402 challenges by transferring USDC on
 * Solana: it builds a token transfer to the challenge's `payTo`, signs it with
 * the configured `SolanaSigner`, and returns the proof header for retry.
 *
 * Implemented directly on `@solana/web3.js` + `@solana/spl-token` (no CLI/MCP
 * subprocess), both loaded by dynamic import so non-crypto consumers never pull
 * them in. `pay` is idempotent per nonce, so a retried request never
 * double-pays. The exact x402 wire encoding varies by server — override
 * `encodePayment` if needed.
 */
export async function createSolanaPayProvider(
  options: SolanaPayProviderOptions,
): Promise<PaymentProvider> {
  const network = options.network ?? 'devnet'
  const rpcUrl = options.rpcUrl ?? DEFAULT_RPC[network]
  const mintAddr = options.usdcMint ?? USDC_MINT[network]
  const encode = options.encodePayment ?? defaultEncodePayment

  let web3: typeof import('@solana/web3.js')
  let splToken: typeof import('@solana/spl-token')
  try {
    web3 = await import('@solana/web3.js')
    splToken = await import('@solana/spl-token')
  } catch {
    throw new MissingDependencyError(
      '@solana/web3.js and @solana/spl-token',
      'createSolanaPayProvider',
    )
  }

  const connection = new web3.Connection(rpcUrl, 'confirmed')
  const payer = new web3.PublicKey(options.signer.publicKey)
  const mint = new web3.PublicKey(mintAddr)

  // nonce -> settled result, so repeated challenges for the same logical
  // request return the prior proof instead of paying again.
  const settled = new Map<string, PaymentResult>()
  const inflight = new Map<string, Promise<PaymentResult>>()

  async function settle(requirement: PaymentRequirement): Promise<PaymentResult> {
    const recipient = new web3.PublicKey(requirement.payTo)
    const payerAta = await splToken.getAssociatedTokenAddress(mint, payer)
    const recipientAta = await splToken.getAssociatedTokenAddress(mint, recipient)

    const instruction = splToken.createTransferInstruction(
      payerAta,
      recipientAta,
      payer,
      BigInt(requirement.amount),
    )

    const { blockhash } = await connection.getLatestBlockhash()
    const message = new web3.TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: [instruction],
    }).compileToV0Message()

    const tx = new web3.VersionedTransaction(message)
    const signed = await options.signer.signTransaction(tx.serialize())
    const signedTxBase64 = Buffer.from(signed).toString('base64')

    return {
      header: encode({ requirement, signedTxBase64, network }),
      reference: idempotencyKey(requirement),
      amount: requirement.amount,
    }
  }

  return {
    async pay(requirement: PaymentRequirement): Promise<PaymentResult> {
      if (requirement.network && !requirement.network.includes('solana')) {
        throw new PaymentError(
          `createSolanaPayProvider cannot settle on '${requirement.network}'`,
        )
      }

      const key = idempotencyKey(requirement)
      const done = settled.get(key)
      if (done) return done

      const pending = inflight.get(key)
      if (pending) return pending

      const promise = settle(requirement)
        .then((result) => {
          settled.set(key, result)
          return result
        })
        .finally(() => inflight.delete(key))

      inflight.set(key, promise)
      return promise
    },
  }
}
