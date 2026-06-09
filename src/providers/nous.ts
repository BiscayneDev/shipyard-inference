import type { LLMProvider } from '../types.js'
import { OpenAIProvider } from './openai.js'

/** Nous Portal inference API (OpenAI-compatible). */
const NOUS_BASE_URL = 'https://inference-api.nousresearch.com/v1'

export interface NousProviderOptions {
  /** Nous Portal API key. Defaults to `NOUS_API_KEY`. Get one at https://portal.nousresearch.com */
  apiKey?: string
  /** Override the base URL (e.g. to route Hermes via OpenRouter instead). */
  baseURL?: string
  /** Default model. Defaults to `Hermes-4-405B`. */
  defaultModel?: string
  defaultMaxTokens?: number
  /** Custom fetch (e.g. `createPayingFetch`). */
  fetch?: typeof fetch
}

/**
 * Nous Research (Hermes) provider. The Nous Portal endpoint is OpenAI-compatible,
 * so this is a thin pre-configured `OpenAIProvider` — Hermes models become
 * routable, payable candidates for the Router. Open-weight and inexpensive, they
 * pair well with `costOptimized` as a commodity tier alongside UsePod.
 */
export function createNousProvider(options: NousProviderOptions = {}): LLMProvider {
  const apiKey = options.apiKey ?? process.env.NOUS_API_KEY
  if (!apiKey && !options.baseURL) {
    throw new Error(
      '[shipyard-inference] Nous requires `apiKey` (or NOUS_API_KEY). ' +
        'Get one at https://portal.nousresearch.com',
    )
  }
  return new OpenAIProvider({
    apiKey: apiKey ?? 'nous',
    baseURL: options.baseURL ?? NOUS_BASE_URL,
    defaultModel: options.defaultModel ?? 'Hermes-4-405B',
    defaultMaxTokens: options.defaultMaxTokens,
    fetch: options.fetch,
  })
}
