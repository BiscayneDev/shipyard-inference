import type { LLMProvider } from '../types.js'
import { OpenAIProvider } from './openai.js'

/** OpenRouter's OpenAI-compatible endpoint. */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export interface OpenRouterProviderOptions {
  /** OpenRouter API key. Defaults to `OPENROUTER_API_KEY`. Get one at https://openrouter.ai/keys */
  apiKey?: string
  /** Override the base URL. */
  baseURL?: string
  /** Default model, using OpenRouter ids like `anthropic/claude-sonnet-4.5`. Defaults to `openai/gpt-4o`. */
  defaultModel?: string
  defaultMaxTokens?: number
  /** Custom fetch (e.g. `createPayingFetch`). */
  fetch?: typeof fetch
}

/**
 * OpenRouter provider — one OpenAI-compatible endpoint fronting hundreds of
 * models from many vendors. A thin pre-configured `OpenAIProvider`, so it works
 * as a routable, payable candidate. Use OpenRouter model ids (e.g.
 * `anthropic/claude-sonnet-4.5`, `google/gemini-2.5-pro`, `deepseek/deepseek-v3.2`).
 */
export function createOpenRouterProvider(
  options: OpenRouterProviderOptions = {},
): LLMProvider {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY
  if (!apiKey && !options.baseURL) {
    throw new Error(
      '[shipyard-inference] OpenRouter requires `apiKey` (or OPENROUTER_API_KEY). ' +
        'Get one at https://openrouter.ai/keys',
    )
  }
  return new OpenAIProvider({
    apiKey: apiKey ?? 'openrouter',
    baseURL: options.baseURL ?? OPENROUTER_BASE_URL,
    defaultModel: options.defaultModel ?? 'openai/gpt-4o',
    defaultMaxTokens: options.defaultMaxTokens,
    fetch: options.fetch,
  })
}
