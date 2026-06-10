import type { LLMProvider } from './types.js'
import {
  Router,
  costOptimized,
  type ModelMetadata,
  type ProviderCandidate,
  type RouterEvent,
  type RoutingStrategy,
  type CacheStore,
  type CompressionTransform,
  type UsageRecorder,
} from './router/index.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OpenAIProvider } from './providers/openai.js'
import { createSolanaPayProvider } from './payment/solana-pay.js'
import { createPayingFetch } from './payment/paying-fetch.js'
import type {
  PaymentProvider,
  PaymentSession,
  SolanaSigner,
  SpendCap,
} from './payment/types.js'

export interface WalletInferenceOptions {
  /**
   * Wallet that pays per request — a `SolanaSigner` from `payboxSigner` (Paybox
   * custody) or `keypairSigner` (raw key). Fund it with USDC on Solana.
   */
  signer: SolanaSigner
  /**
   * The x402-on-Solana inference endpoint to pay (e.g. UsePod's current wallet
   * endpoint). Must speak x402: respond 402, accept the on-chain USDC proof, serve.
   */
  baseURL: string
  /** Solana cluster. Default `mainnet`. */
  network?: 'mainnet' | 'devnet'
  /** API surface of the endpoint. Default `openai`. */
  family?: 'openai' | 'anthropic'
  /** Spend caps (atomic USDC units) enforced on every payment. */
  spendCap?: SpendCap
  /** Models served by the endpoint, with pricing — enables cost-ranking. */
  models?: ModelMetadata[]
  defaultModel?: string
  /** Open an MPP session with this budget (atomic units) for bulk settlement. */
  sessionBudget?: string
  /** Additional routable candidates (e.g. your own API-key providers). */
  extraCandidates?: ProviderCandidate[]
  /** Routing strategy. Default `costOptimized()`. */
  strategy?: RoutingStrategy
  cache?: CacheStore
  compress?: CompressionTransform
  onEvent?: (event: RouterEvent) => void
  usageRecorder?: UsageRecorder
  /** Underlying fetch (for a custom transport or testing). Defaults to global fetch. */
  transport?: typeof fetch
}

export interface WalletInference {
  /** Cost-routed, wallet-paid inference. Itself an `LLMProvider` — use `.chat` / `.chatStream`. */
  router: Router
  /** The wallet-funded x402 provider, exposed for advanced use. */
  provider: LLMProvider
  /** The Solana payment provider behind the wallet. */
  payment: PaymentProvider
  /** The MPP session, when `sessionBudget` was set. */
  session?: PaymentSession
  /** Settle any open MPP session. Call when done. */
  close(): Promise<void>
}

/**
 * Turnkey wallet-funded inference: fund a Solana wallet, get cost-routed,
 * well-priced inference paid per request via x402 — with optional MPP session
 * bulk settlement. One call composes signer → Solana payment → paying-fetch →
 * the x402 endpoint → a `costOptimized` Router.
 *
 * Requires the optional peers `@solana/web3.js` + `@solana/spl-token`.
 *
 * @example
 *   const { router, close } = await createWalletInference({
 *     signer: await payboxSigner({ credentialId: process.env.PAYBOX_WALLET_ID! }),
 *     baseURL: process.env.USEPOD_X402_URL!, // UsePod's current x402 endpoint
 *   })
 *   const res = await router.chat({ system, messages, tools })
 *   await close()
 */
export async function createWalletInference(
  options: WalletInferenceOptions,
): Promise<WalletInference> {
  const network = options.network ?? 'mainnet'

  const payment = await createSolanaPayProvider({
    signer: options.signer,
    network,
    spendCap: options.spendCap,
  })

  const session =
    options.sessionBudget && payment.openSession
      ? await payment.openSession(options.sessionBudget)
      : undefined

  const fetch = createPayingFetch({
    paymentProvider: payment,
    session,
    spendCap: options.spendCap,
    fetch: options.transport,
  })

  const providerOptions = {
    apiKey: 'x402', // wallet auth — placeholder to satisfy the SDK client
    baseURL: options.baseURL,
    defaultModel: options.defaultModel,
    fetch,
  }
  const provider: LLMProvider =
    options.family === 'anthropic'
      ? new AnthropicProvider(providerOptions)
      : new OpenAIProvider(providerOptions)

  const candidates: ProviderCandidate[] = [
    { id: 'usepod', provider, models: options.models },
    ...(options.extraCandidates ?? []),
  ]

  const router = new Router({
    candidates,
    strategy: options.strategy ?? costOptimized(),
    cache: options.cache,
    compress: options.compress,
    onEvent: options.onEvent,
    usageRecorder: options.usageRecorder,
  })

  return {
    router,
    provider,
    payment,
    session,
    close: async () => {
      await session?.close()
    },
  }
}
