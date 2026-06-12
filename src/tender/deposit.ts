import { randomBytes } from 'node:crypto'
import bs58 from 'bs58'

// Advertiser-side funding for self-serve campaigns: a campaign created at
// /advertise is born `pending` and only enters the live auction once the
// advertiser's USDC deposit is confirmed on-chain. This is the inbound mirror of
// `payment/` (which pays x402 challenges OUTbound) — here we hand the advertiser
// a Solana Pay intent and verify the matching transfer landed in the treasury.
//
// No private key lives here: the treasury is just a destination address, and the
// per-campaign `reference` is a throwaway pubkey we tag the transfer with so we
// can find exactly the deposit for this campaign (Solana Pay's reference key
// convention — a read-only account meta, never a signer).

/** Canonical USDC mints by Solana cluster (matches payment/solana-pay.ts). */
const USDC_MINT = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const

const DEFAULT_RPC = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
} as const

export interface DepositConfig {
  /** Treasury address that receives advertiser USDC. */
  treasury: string
  network: 'mainnet' | 'devnet'
  /** RPC endpoint. Defaults to the public endpoint for the network. */
  rpcUrl?: string
  /** USDC mint override (defaults to the canonical mint for the network). */
  usdcMint?: string
}

/** Build a `DepositConfig` from the environment, or undefined if no treasury is set. */
export function tenderDepositConfig(
  env: Record<string, string | undefined> = process.env,
): DepositConfig | undefined {
  const treasury = env.TENDER_TREASURY_WALLET?.trim()
  if (!treasury) return undefined
  return {
    treasury,
    network: env.SHIPYARD_SETTLE_NETWORK === 'mainnet' ? 'mainnet' : 'devnet',
    rpcUrl: env.SHIPYARD_SETTLE_RPC_URL?.trim() || undefined,
    usdcMint: env.SHIPYARD_SETTLE_USDC_MINT?.trim() || undefined,
  }
}

const usdcMintFor = (cfg: DepositConfig): string => cfg.usdcMint ?? USDC_MINT[cfg.network]
const rpcFor = (cfg: DepositConfig): string => cfg.rpcUrl ?? DEFAULT_RPC[cfg.network]

/**
 * A fresh, unique reference for one campaign's deposit. It need not be on-curve —
 * Solana Pay references are plain 32-byte account keys tagged onto the transfer.
 */
export function newPaymentReference(): string {
  return bs58.encode(randomBytes(32))
}

export interface DepositIntent {
  treasury: string
  /** Amount the advertiser must send, in whole USDC. */
  amountUsdc: number
  /** Per-campaign reference pubkey the transfer must carry. */
  reference: string
  network: 'mainnet' | 'devnet'
  usdcMint: string
  /** A `solana:` Solana Pay URL the advertiser's wallet (Phantom etc.) can open. */
  url: string
}

/** Build the Solana Pay deposit intent an advertiser pays to fund a campaign. */
export function buildDepositIntent(
  cfg: DepositConfig,
  args: { amountUsdc: number; reference: string; label?: string; message?: string },
): DepositIntent {
  const usdcMint = usdcMintFor(cfg)
  const p = new URLSearchParams()
  // Solana Pay `amount` is in DECIMAL token units, not atomic.
  p.set('amount', String(args.amountUsdc))
  p.set('spl-token', usdcMint)
  p.set('reference', args.reference)
  if (args.label) p.set('label', args.label)
  if (args.message) p.set('message', args.message)
  return {
    treasury: cfg.treasury,
    amountUsdc: args.amountUsdc,
    reference: args.reference,
    network: cfg.network,
    usdcMint,
    url: `solana:${cfg.treasury}?${p.toString()}`,
  }
}

export interface DepositStatus {
  paid: boolean
  /** Confirmed transaction signature, when paid. */
  signature?: string
}

/**
 * Check the chain for a confirmed USDC transfer of >= `amountUsdc` into the
 * treasury, tagged with `reference`. Returns `{ paid: true, signature }` on the
 * first qualifying transaction. Looks at the treasury's token-balance delta
 * (robust to transfer vs transferChecked instruction shapes) rather than parsing
 * instruction internals.
 *
 * `@solana/web3.js` is loaded by dynamic import so non-crypto consumers of the
 * tender module never pull it in.
 */
export async function verifyDeposit(
  cfg: DepositConfig,
  reference: string,
  amountUsdc: number,
): Promise<DepositStatus> {
  let web3: typeof import('@solana/web3.js')
  try {
    web3 = await import('@solana/web3.js')
  } catch {
    throw new Error('verifyDeposit requires @solana/web3.js')
  }

  const connection = new web3.Connection(rpcFor(cfg), 'confirmed')
  const mint = usdcMintFor(cfg)
  const treasury = new web3.PublicKey(cfg.treasury).toBase58()
  const referencePk = new web3.PublicKey(reference)

  const sigs = await connection.getSignaturesForAddress(referencePk, { limit: 25 }, 'confirmed')
  for (const s of sigs) {
    if (s.err) continue
    const tx = await connection.getParsedTransaction(s.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
    if (!tx || tx.meta?.err) continue

    const owned = (b: { owner?: string; mint: string }): boolean =>
      b.owner === treasury && b.mint === mint
    const sum = (
      balances: ReadonlyArray<{ owner?: string; mint: string; uiTokenAmount: { uiAmount: number | null } }> | null | undefined,
    ): number => (balances ?? []).filter(owned).reduce((acc, b) => acc + (b.uiTokenAmount.uiAmount ?? 0), 0)

    const delta = sum(tx.meta?.postTokenBalances) - sum(tx.meta?.preTokenBalances)
    // Tiny epsilon for float dust; deposits are exact or larger.
    if (delta + 1e-6 >= amountUsdc) return { paid: true, signature: s.signature }
  }
  return { paid: false }
}
