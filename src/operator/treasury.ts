import type { TreasuryBalance } from './types.js'

/** Canonical USDC mints by Solana cluster (mirrors `payment/settle.ts`). */
const USDC_MINT = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const

const DEFAULT_RPC = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
} as const

export interface TreasuryConfig {
  address: string
  network?: 'mainnet' | 'devnet'
  rpcUrl?: string
  /** USDC mint override (defaults to the canonical mint for the network). */
  usdcMint?: string
}

/**
 * Read a treasury wallet's live USDC balance from a Solana RPC. Best-effort: a
 * failed read (missing token account, RPC hiccup) yields `usdc: null` + an error
 * string rather than throwing, so the operator panel degrades gracefully.
 * Requires the optional peers `@solana/web3.js` + `@solana/spl-token`.
 */
export async function readTreasuryBalance(
  cfg: TreasuryConfig,
  now: () => number = Date.now,
): Promise<TreasuryBalance> {
  const network = cfg.network ?? 'devnet'
  const base: TreasuryBalance = { address: cfg.address, network, usdc: null, at: now() }
  try {
    const web3 = await import('@solana/web3.js')
    const splToken = await import('@solana/spl-token')
    const connection = new web3.Connection(cfg.rpcUrl ?? DEFAULT_RPC[network], 'confirmed')
    const owner = new web3.PublicKey(cfg.address)
    const mint = new web3.PublicKey(cfg.usdcMint ?? USDC_MINT[network])
    const ata = await splToken.getAssociatedTokenAddress(mint, owner)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bal: any = await connection.getTokenAccountBalance(ata)
    const ui = bal?.value?.uiAmount
    return { ...base, usdc: typeof ui === 'number' ? ui : 0, at: now() }
  } catch (err) {
    return { ...base, at: now(), error: err instanceof Error ? err.message : String(err) }
  }
}

/** Read several treasuries; null when none configured. */
export async function readTreasuryBalances(
  configs: TreasuryConfig[],
  now: () => number = Date.now,
): Promise<TreasuryBalance[] | null> {
  if (configs.length === 0) return null
  return Promise.all(configs.map((c) => readTreasuryBalance(c, now)))
}
