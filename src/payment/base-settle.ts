import { MissingDependencyError, PaymentError } from './types.js'

// USDC settlement on Base (Coinbase's EVM L2) — the EVM sibling of payboxSettle's
// Solana SPL transfer. It sends an ERC-20 `transfer(to, amount)` of USDC from a
// hot wallet and waits for the receipt. viem is an OPTIONAL peer, loaded at call
// time via a variable specifier so a non-Base deploy never needs it and the build
// doesn't require it installed. The actual send is injected as an `EvmSender`, so
// the logic here (config/amount resolution, dispatch) is unit-testable without
// viem or a live RPC — production uses the default viem-backed sender.

/** Canonical USDC contract by Base network. */
const USDC_ADDRESS = {
  mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base mainnet (8453)
  sepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia (84532)
} as const

const DEFAULT_RPC = {
  mainnet: 'https://mainnet.base.org',
  sepolia: 'https://sepolia.base.org',
} as const

export type BaseNetwork = 'mainnet' | 'sepolia'

const usdcFor = (network: BaseNetwork, override?: string): string => override ?? USDC_ADDRESS[network]
const rpcFor = (network: BaseNetwork, override?: string): string => override ?? DEFAULT_RPC[network]

/** True for an EVM/Base address (`0x` + 40 hex) — used to route a payout to this rail. */
export const isEvmAddress = (addr: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(addr.trim())

/** The minimal send primitive — an ERC-20 USDC transfer, returning the tx hash. */
export interface EvmSender {
  sendUsdcTransfer(args: { usdc: string; to: string; amountAtomic: bigint }): Promise<{ hash: string }>
}

export interface BaseSettleOptions {
  /** Recipient address (`0x...`). */
  to: string
  /** Amount in **atomic USDC units** (6 decimals): `'1500000'` = $1.50. */
  amount: string
  /** Base network. Defaults to `sepolia` for safety. */
  network?: BaseNetwork
  /** RPC endpoint. Defaults to the public Base endpoint for the network. */
  rpcUrl?: string
  /** USDC contract override (defaults to the canonical address for the network). */
  usdcAddress?: string
  /** Treasury hot-wallet private key (`0x...`). Defaults to `EVM_PAYER_SECRET`. */
  privateKey?: string
  /** Injected sender (tests). Defaults to a viem wallet client built from `privateKey`. */
  sender?: EvmSender
}

export interface BaseSettleResult {
  /** The on-chain transaction hash (the EVM analogue of a Solana signature). */
  signature: string
  /** Atomic USDC amount transferred (echoes the request). */
  amount: string
  /** Recipient that received the funds. */
  to: string
}

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// Lazy, type-erased peer import: a variable specifier keeps `tsc` from requiring
// viem to be installed (it resolves to `any`), mirroring how the Solana helpers
// treat their optional peers — but those are installed, so they can be typed.
async function loadViem(): Promise<{ viem: any; accounts: any; chains: any }> {
  try {
    const viemMod = 'viem'
    const accountsMod = 'viem/accounts'
    const chainsMod = 'viem/chains'
    const [viem, accounts, chains] = await Promise.all([
      import(viemMod),
      import(accountsMod),
      import(chainsMod),
    ])
    return { viem, accounts, chains }
  } catch {
    throw new MissingDependencyError('viem', 'baseSettle (Base/EVM payouts)')
  }
}

async function defaultEvmSender(
  network: BaseNetwork,
  rpcUrl: string,
  privateKey: string,
): Promise<EvmSender> {
  const { viem, accounts, chains } = await loadViem()
  const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  const account = accounts.privateKeyToAccount(pk)
  const chain = network === 'mainnet' ? chains.base : chains.baseSepolia
  const wallet = viem.createWalletClient({ account, chain, transport: viem.http(rpcUrl) })
  const pub = viem.createPublicClient({ chain, transport: viem.http(rpcUrl) })
  return {
    async sendUsdcTransfer({ usdc, to, amountAtomic }) {
      const hash: string = await wallet.writeContract({
        address: usdc,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [to, amountAtomic],
      })
      const receipt = await pub.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new PaymentError(`[shipyard-inference] baseSettle tx ${hash} reverted on-chain`)
      }
      return { hash }
    },
  }
}

/**
 * Transfer USDC to `to` on Base — the settlement primitive for Base payouts. Sends
 * an ERC-20 transfer from the treasury hot wallet and confirms the receipt. Plug it
 * into a `PayoutRail` exactly like `payboxSettle` on Solana.
 *
 * ⚠️ UNVERIFIED on-chain path: faithful to the ERC-20 transfer flow but not
 * exercised against a live chain here — run a small real settlement on Base Sepolia
 * and confirm receipt before relying on it. Idempotency is the caller's
 * responsibility (record the returned hash against the ledger in one step).
 */
export async function baseSettle(opts: BaseSettleOptions): Promise<BaseSettleResult> {
  if (!/^\d+$/.test(opts.amount) || BigInt(opts.amount) <= 0n) {
    throw new PaymentError(
      `[shipyard-inference] baseSettle requires a positive atomic USDC amount, got '${opts.amount}'`,
    )
  }
  if (!isEvmAddress(opts.to)) {
    throw new PaymentError(`[shipyard-inference] baseSettle requires a 0x recipient address, got '${opts.to}'`)
  }
  const network = opts.network ?? 'sepolia'
  const usdc = usdcFor(network, opts.usdcAddress)
  const rpcUrl = rpcFor(network, opts.rpcUrl)

  let sender = opts.sender
  if (!sender) {
    const privateKey = opts.privateKey ?? process.env.EVM_PAYER_SECRET
    if (!privateKey) {
      throw new PaymentError(
        '[shipyard-inference] baseSettle requires a private key (or EVM_PAYER_SECRET) when no sender is injected',
      )
    }
    sender = await defaultEvmSender(network, rpcUrl, privateKey)
  }

  const { hash } = await sender.sendUsdcTransfer({ usdc, to: opts.to, amountAtomic: BigInt(opts.amount) })
  return { signature: hash, amount: opts.amount, to: opts.to }
}
