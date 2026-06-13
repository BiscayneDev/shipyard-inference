// Advertiser-side funding on Base — the EVM sibling of deposit.ts (Solana). Like
// that module it talks to the chain over plain JSON-RPC `fetch` (no viem here), so
// the deployed function stays tiny and can't crash on a missing dependency trace.
//
// EVM has no "reference" tag like Solana Pay, so a deposit is correlated by its
// transaction hash: the advertiser sends USDC to the treasury, then submits the tx
// hash; we fetch the receipt and confirm a USDC Transfer of >= the amount landed in
// the treasury. The treasury is just a destination address — no key lives here.

/** Canonical USDC contract + chain id by Base network (matches payment/base-settle.ts). */
const USDC_ADDRESS = {
  mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  sepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
} as const

const CHAIN_ID = { mainnet: 8453, sepolia: 84532 } as const

const DEFAULT_RPC = {
  mainnet: 'https://mainnet.base.org',
  sepolia: 'https://sepolia.base.org',
} as const

// keccak256("Transfer(address,address,uint256)") — the ERC-20 Transfer event topic.
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export type BaseNetwork = 'mainnet' | 'sepolia'

export interface BaseDepositConfig {
  /** Treasury address (`0x...`) that receives advertiser USDC on Base. */
  treasury: string
  network: BaseNetwork
  rpcUrl?: string
  /** USDC contract override (defaults to the canonical address for the network). */
  usdcAddress?: string
}

/** Build a Base `BaseDepositConfig` from the environment, or undefined if no Base treasury is set. */
export function baseDepositConfig(
  env: Record<string, string | undefined> = process.env,
): BaseDepositConfig | undefined {
  const treasury = env.TENDER_TREASURY_WALLET_BASE?.trim()
  if (!treasury) return undefined
  return {
    treasury,
    network: env.SHIPYARD_SETTLE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia',
    rpcUrl: env.BASE_RPC_URL?.trim() || undefined,
    usdcAddress: env.BASE_USDC_ADDRESS?.trim() || undefined,
  }
}

const usdcFor = (cfg: BaseDepositConfig): string => cfg.usdcAddress ?? USDC_ADDRESS[cfg.network]
const rpcFor = (cfg: BaseDepositConfig): string => cfg.rpcUrl ?? DEFAULT_RPC[cfg.network]

/** USDC has 6 decimals — dollars → atomic units (bigint). */
const toAtomic = (usd: number): bigint => BigInt(Math.round(usd * 1_000_000))

export interface BaseDepositIntent {
  treasury: string
  amountUsdc: number
  network: BaseNetwork
  chainId: number
  usdcAddress: string
  /** An EIP-681 `ethereum:` URL the advertiser's wallet (Coinbase Wallet, MetaMask) can open. */
  url: string
}

/** Build the EIP-681 deposit intent an advertiser pays to fund a Base campaign. */
export function buildBaseDepositIntent(
  cfg: BaseDepositConfig,
  args: { amountUsdc: number },
): BaseDepositIntent {
  const usdcAddress = usdcFor(cfg)
  const chainId = CHAIN_ID[cfg.network]
  // EIP-681: ethereum:<token>@<chainId>/transfer?address=<recipient>&uint256=<atomic>
  const url = `ethereum:${usdcAddress}@${chainId}/transfer?address=${cfg.treasury}&uint256=${toAtomic(args.amountUsdc).toString()}`
  return { treasury: cfg.treasury, amountUsdc: args.amountUsdc, network: cfg.network, chainId, usdcAddress, url }
}

export interface DepositStatus {
  paid: boolean
  /** Confirmed transaction hash, when paid. */
  signature?: string
}

interface RpcLog { address: string; topics: string[]; data: string }
interface RpcReceipt { status: string; logs: RpcLog[] } // status: '0x1' success, '0x0' reverted

async function rpc<T>(url: string, method: string, params: unknown[], fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`base rpc ${method}: ${res.status}`)
  const body = (await res.json()) as { result?: T; error?: { message?: string } }
  if (body.error) throw new Error(`base rpc ${method}: ${body.error.message ?? 'error'}`)
  return body.result as T
}

/** Last 40 hex chars of a 32-byte topic, lower-cased — the address an indexed param encodes. */
const topicAddr = (topic: string): string => topic.slice(-40).toLowerCase()
const bareAddr = (addr: string): string => addr.replace(/^0x/, '').toLowerCase()

/**
 * Verify a Base transaction is a confirmed USDC Transfer of >= `amountUsdc` into
 * the treasury. Fetches the receipt and checks the ERC-20 Transfer log(s) emitted
 * by the USDC contract (`to` == treasury, summed value >= amount). Returns
 * `{ paid: true, signature: txHash }` when it qualifies.
 */
export async function verifyBaseDeposit(
  cfg: BaseDepositConfig,
  args: { txHash: string; amountUsdc: number; fetch?: typeof fetch },
): Promise<DepositStatus> {
  const fetchImpl = args.fetch ?? fetch
  const url = rpcFor(cfg)
  const usdc = bareAddr(usdcFor(cfg))
  const treasury = bareAddr(cfg.treasury)

  const receipt = await rpc<RpcReceipt | null>(url, 'eth_getTransactionReceipt', [args.txHash], fetchImpl)
  if (!receipt) return { paid: false } // not mined yet / unknown
  if (receipt.status !== '0x1') return { paid: false } // reverted

  let credited = 0n
  for (const log of receipt.logs ?? []) {
    if (bareAddr(log.address) !== usdc) continue
    if ((log.topics[0] ?? '').toLowerCase() !== TRANSFER_TOPIC) continue
    if (log.topics.length < 3) continue
    if (topicAddr(log.topics[2]) !== treasury) continue // topics[2] = indexed `to`
    credited += BigInt(log.data === '0x' || !log.data ? '0x0' : log.data)
  }
  if (credited >= toAtomic(args.amountUsdc)) return { paid: true, signature: args.txHash }
  return { paid: false }
}
