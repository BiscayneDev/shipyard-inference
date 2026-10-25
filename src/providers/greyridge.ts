import type { LLMProvider } from '../types.js'
import { OpenAIProvider } from './openai.js'

/** Grey Ridge Signals keyless x402 inference endpoint (OpenAI-compatible, USDC on Base). */
const GREYRIDGE_BASE_URL = 'https://x402-data-api.sigrunner.workers.dev/v1'

export interface GreyRidgeProviderOptions {
  /**
   * Custom fetch — pass `createPayingFetch(...)` so each call settles the x402
   * 402 challenge in USDC on Base. Effectively required: this endpoint is
   * keyless and gated purely by payment, so without a paying fetch every
   * request comes back HTTP 402. (For a no-payment smoke test, point `baseURL`
   * at the `/preview` path, which is free at 3 calls/day/IP.)
   */
  fetch?: typeof fetch
  /** Override the base URL. */
  baseURL?: string
  /** Default model. Defaults to `llama-3.3-70b-instruct-fp8-fast`; set `llama-3.2-3b-instruct` for the cheaper small model. */
  defaultModel?: string
  defaultMaxTokens?: number
  /** Dummy bearer token — ignored by the endpoint (it is keyless; payment is the gate). */
  apiKey?: string
}

/**
 * Grey Ridge Signals inference provider. An OpenAI-compatible chat-completions
 * endpoint (Llama 3.3 70B fp8 on Cloudflare Workers AI) gated purely by x402
 * micropayment — no portal, no API key, no account. $0.002/call in USDC on Base
 * (set `llama-3.2-3b-instruct` for a cheaper small model).
 *
 * Because it is keyless, this is the lowest-friction `costOptimized` commodity
 * tier for a wallet-funded Shipyard stack: point `createPayingFetch` at it and
 * calls settle per-request on Base — the same Open Wallet Standard signing path
 * already used for UsePod and other x402 endpoints, no new credential to manage.
 * A natural failover candidate alongside Nous/UsePod.
 *
 * @example
 *   import { createGreyRidgeProvider } from './providers/greyridge.js'
 *   import { createPayingFetch } from '../payment/index.js'
 *   const provider = createGreyRidgeProvider({ fetch: createPayingFetch(walletOpts) })
 */
export function createGreyRidgeProvider(
  options: GreyRidgeProviderOptions = {},
): LLMProvider {
  return new OpenAIProvider({
    apiKey: options.apiKey ?? 'greyridge-x402',
    baseURL: options.baseURL ?? GREYRIDGE_BASE_URL,
    defaultModel: options.defaultModel ?? 'llama-3.3-70b-instruct-fp8-fast',
    defaultMaxTokens: options.defaultMaxTokens,
    fetch: options.fetch,
  })
}
