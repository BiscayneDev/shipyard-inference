import { MissingDependencyError } from '../payment/types.js'

/** UsePod's deposit program + USDC mint (Solana mainnet-beta). */
export const USEPOD_DEPOSIT_PROGRAM_ID = 'BBAdcqUkg68JXNiPQ1HR1wujfZuayyK3eQTQSYAh6FSW'
export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export interface UsePodDepositOptions {
  /** 64-byte secret key of the funding wallet (Uint8Array | number[] | JSON-array string). */
  secretKey: Uint8Array | number[] | string
  /** The `deposit_code` from `registerUsePod()` (16-hex / 8 bytes). */
  depositCode: string
  /** Amount of USDC to deposit, in whole USDC (e.g. `5` = $5). */
  amountUsdc: number
  /** Solana RPC URL. Defaults to mainnet-beta public RPC. */
  rpcUrl?: string
  /** Override the deposit program id. */
  programId?: string
  /** Override the USDC mint. */
  usdcMint?: string
}

function toSecretBytes(raw: Uint8Array | number[] | string): Uint8Array {
  if (raw instanceof Uint8Array) return raw
  if (Array.isArray(raw)) return Uint8Array.from(raw)
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) return Uint8Array.from(JSON.parse(trimmed) as number[])
  throw new Error('[shipyard-inference] depositUsdc secretKey string must be a JSON byte array')
}

// Loaded via a non-literal specifier so tsc doesn't require the (optional) package at build time.
async function loadAnchor(): Promise<Record<string, unknown>> {
  const spec: string = '@coral-xyz/anchor'
  try {
    return (await import(spec)) as Record<string, unknown>
  } catch {
    throw new MissingDependencyError('@coral-xyz/anchor', 'depositUsdc (UsePod on-chain funding)')
  }
}

/**
 * Fund a UsePod token by depositing USDC on-chain. Mirrors UsePod's documented
 * Anchor flow: it calls the deposit program's `depositUsdc(code, amount)` so the
 * `deposit_code` rides in the instruction data (a plain SPL transfer is NOT
 * credited). Requires the optional peer `@coral-xyz/anchor`.
 *
 * ⚠️ UNVERIFIED: this on-chain path is faithful to UsePod's docs but cannot be
 * unit-tested against mainnet here. Verify a small real deposit (and that the
 * balance credits) before relying on it. Funding from a Paybox-custodied wallet
 * is a separate follow-up (export-less custody can't provide a raw `secretKey`).
 *
 * @returns the transaction signature.
 */
export async function depositUsdc(options: UsePodDepositOptions): Promise<string> {
  const anchor = await loadAnchor()
  const web3 = await import('@solana/web3.js')

  const connection = new web3.Connection(
    options.rpcUrl ?? 'https://api.mainnet-beta.solana.com',
    'confirmed',
  )
  const keypair = web3.Keypair.fromSecretKey(toSecretBytes(options.secretKey))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = anchor as any
  const wallet = new a.Wallet(keypair)
  const provider = new a.AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  const program = await a.Program.at(options.programId ?? USEPOD_DEPOSIT_PROGRAM_ID, provider)

  const code = Array.from(Buffer.from(options.depositCode, 'hex'))
  const amount = new a.BN(Math.round(options.amountUsdc * 1_000_000))

  return (await program.methods
    .depositUsdc(code, amount)
    .accounts({ mint: new web3.PublicKey(options.usdcMint ?? USDC_MINT_MAINNET) })
    .rpc()) as string
}
