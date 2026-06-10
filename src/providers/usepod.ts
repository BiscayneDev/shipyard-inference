import type { LLMProvider } from '../types.js'
import { AnthropicProvider } from './anthropic.js'
import { OpenAIProvider } from './openai.js'

export type UsePodFamily = 'anthropic' | 'openai'

export interface UsePodProviderOptions {
  /** Per-account token (the UUID in the proxy URL). From `registerUsePod()` or the dashboard. */
  token?: string
  /** Which upstream API surface to proxy. Defaults to 'anthropic'. */
  family?: UsePodFamily
  /** Override the proxy base. Defaults to `https://api.usepod.ai/proxy/<token>` (+ `/v1` for openai). */
  baseURL?: string
  defaultModel?: string
  defaultMaxTokens?: number
  /** Per-request input price ceiling (USDC microunits per 1M tokens) → `X-Pod-Max-Price-Input`. */
  maxPriceInput?: number
  /** Per-request output price ceiling (USDC microunits per 1M tokens) → `X-Pod-Max-Price-Output`. */
  maxPriceOutput?: number
  /** Custom fetch (e.g. `createPayingFetch`) forwarded to the underlying provider. */
  fetch?: typeof fetch
}

const DEFAULT_PROXY_HOST = 'https://api.usepod.ai/proxy'

function resolveBaseURL(options: UsePodProviderOptions, family: UsePodFamily): string {
  if (options.baseURL) return options.baseURL.replace(/\/+$/, '')
  const token = options.token ?? process.env.USEPOD_TOKEN
  if (!token) {
    throw new Error(
      '[shipyard-inference] UsePod requires `token` (or USEPOD_TOKEN env var). ' +
        'Register with `registerUsePod()` or get one at https://usepod.ai',
    )
  }
  // OpenAI clients append `/chat/completions`; UsePod's OpenAI surface is at `/proxy/<token>/v1`.
  // Anthropic clients append `/v1/messages`, so the base stays `/proxy/<token>`.
  return family === 'openai' ? `${DEFAULT_PROXY_HOST}/${token}/v1` : `${DEFAULT_PROXY_HOST}/${token}`
}

function spendCapHeaders(options: UsePodProviderOptions): Record<string, string> | undefined {
  const headers: Record<string, string> = {}
  if (options.maxPriceInput !== undefined) headers['X-Pod-Max-Price-Input'] = String(options.maxPriceInput)
  if (options.maxPriceOutput !== undefined) headers['X-Pod-Max-Price-Output'] = String(options.maxPriceOutput)
  return Object.keys(headers).length > 0 ? headers : undefined
}

/**
 * UsePod is a prepaid token-balance proxy in front of many providers: you fund a
 * token's USDC balance (card, or an on-chain `depositUsdc`), then point any
 * Anthropic/OpenAI client at `https://api.usepod.ai/proxy/<token>` — the SDK
 * api key is ignored; auth is the token in the path. UsePod's marketplace routes
 * each request to the cheapest provider; `maxPrice*` set per-request ceilings.
 *
 * This factory returns the matching provider pre-pointed at the proxy.
 *
 * @example
 *   const provider = createUsePodProvider({ token: process.env.USEPOD_TOKEN, family: 'openai' })
 *   const res = await provider.chat({ system, messages, tools })
 */
export function createUsePodProvider(
  options: UsePodProviderOptions = {},
): LLMProvider {
  const family = options.family ?? 'anthropic'
  const baseURL = resolveBaseURL(options, family)
  const defaultHeaders = spendCapHeaders(options)

  const shared = {
    apiKey: 'UsePod', // ignored by UsePod — auth is the token in the path
    baseURL,
    defaultModel: options.defaultModel,
    defaultMaxTokens: options.defaultMaxTokens,
    fetch: options.fetch,
    defaultHeaders,
  }

  return family === 'anthropic' ? new AnthropicProvider(shared) : new OpenAIProvider(shared)
}
