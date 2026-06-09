import type { LLMProvider } from '../types.js'
import { AnthropicProvider } from './anthropic.js'
import { OpenAIProvider } from './openai.js'

export type UsePodFamily = 'anthropic' | 'openai'

export interface UsePodProviderOptions {
  /** Per-account API token from https://usepod.ai/dashboard (the UUID embedded in the proxy URL). */
  token?: string
  /** Which upstream API surface to proxy. Defaults to 'anthropic'. */
  family?: UsePodFamily
  /** Override the proxy base. Defaults to `https://api.usepod.ai/proxy/<token>`. */
  baseURL?: string
  defaultModel?: string
  defaultMaxTokens?: number
  /** Custom fetch (e.g. `createPayingFetch`) forwarded to the underlying provider. */
  fetch?: typeof fetch
}

const DEFAULT_PROXY_HOST = 'https://api.usepod.ai/proxy'

function resolveBaseURL(options: UsePodProviderOptions): string {
  if (options.baseURL) return options.baseURL.replace(/\/+$/, '')
  const token = options.token ?? process.env.USEPOD_TOKEN
  if (!token) {
    throw new Error(
      '[shipyard-inference] UsePod requires `token` (or USEPOD_TOKEN env var). ' +
        'Get one at https://usepod.ai/dashboard',
    )
  }
  return `${DEFAULT_PROXY_HOST}/${token}`
}

/**
 * UsePod is a wallet-funded proxy in front of Anthropic / OpenAI — no SDK,
 * no x402 handshake at the call site. You set `ANTHROPIC_BASE_URL` (or the
 * OpenAI equivalent) to a per-account proxy URL, and any existing client
 * works. Funding happens in the UsePod dashboard.
 *
 * This factory returns the matching shipyard-inference provider already
 * pointed at the proxy. Both the api key and base URL are pre-configured.
 *
 * @example
 *   const provider = createUsePodProvider({ token: process.env.USEPOD_TOKEN })
 *   const res = await provider.chat({ system, messages, tools })
 */
export function createUsePodProvider(
  options: UsePodProviderOptions = {},
): LLMProvider {
  const baseURL = resolveBaseURL(options)
  const family = options.family ?? 'anthropic'

  if (family === 'anthropic') {
    return new AnthropicProvider({
      apiKey: 'UsePod',
      baseURL,
      defaultModel: options.defaultModel,
      defaultMaxTokens: options.defaultMaxTokens,
      fetch: options.fetch,
    })
  }

  return new OpenAIProvider({
    apiKey: 'UsePod',
    baseURL,
    defaultModel: options.defaultModel,
    defaultMaxTokens: options.defaultMaxTokens,
    fetch: options.fetch,
  })
}
