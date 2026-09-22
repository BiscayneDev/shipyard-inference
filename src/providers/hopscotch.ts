import type { ModelMetadata, ProviderCandidate } from '../router/candidates.js'
import { OpenAIProvider } from './openai.js'

/** Hopscotch's OpenAI-compatible API endpoint. */
export const HOPSCOTCH_BASE_URL = 'https://api.hopscotchlabs.ai/v1'

/**
 * Small, verified starter catalog from GET /v1/models on 2026-09-21.
 * Hopscotch expects every model in provider/model form.
 */
export const HOPSCOTCH_MODELS: ModelMetadata[] = [
  {
    model: 'anthropic/claude-haiku-4-5-20251001',
    inputCostPerMTok: 1,
    outputCostPerMTok: 5,
    cacheReadCostPerMTok: 0.1,
    cacheWriteCostPerMTok: 1.25,
    contextWindow: 200_000,
    tier: 'economy',
    capabilities: ['tools', 'json', 'vision'],
  },
  {
    model: 'anthropic/claude-sonnet-5',
    inputCostPerMTok: 2,
    outputCostPerMTok: 10,
    cacheReadCostPerMTok: 0.2,
    cacheWriteCostPerMTok: 2.5,
    contextWindow: 1_000_000,
    tier: 'frontier',
    capabilities: ['tools', 'json', 'vision'],
  },
  {
    model: 'openai-main/gpt-4o-mini',
    inputCostPerMTok: 0.15,
    outputCostPerMTok: 0.6,
    cacheReadCostPerMTok: 0.075,
    contextWindow: 128_000,
    tier: 'economy',
    capabilities: ['tools', 'json', 'vision'],
  },
  {
    model: 'openai-main/gpt-5',
    inputCostPerMTok: 1.25,
    outputCostPerMTok: 10,
    cacheReadCostPerMTok: 0.125,
    contextWindow: 400_000,
    tier: 'frontier',
    capabilities: ['tools', 'json', 'vision'],
  },
  {
    model: 'google-aistudio/gemini-3.1-flash-lite',
    inputCostPerMTok: 0.25,
    outputCostPerMTok: 1.5,
    cacheReadCostPerMTok: 0.025,
    cacheWriteCostPerMTok: 0.25,
    contextWindow: 1_048_576,
    tier: 'economy',
    capabilities: ['json', 'vision'],
  },
  {
    model: 'google-aistudio/gemini-3.5-flash-lite',
    inputCostPerMTok: 0.3,
    outputCostPerMTok: 2.5,
    cacheReadCostPerMTok: 0.03,
    cacheWriteCostPerMTok: 0.3,
    contextWindow: 1_048_576,
    tier: 'standard',
    capabilities: ['json', 'vision'],
  },
]

export interface HopscotchProviderOptions {
  apiKey?: string
  baseURL?: string
  defaultModel?: string
  fetch?: typeof fetch
}

/** Construct Hopscotch through the existing OpenAI-compatible provider. */
export function createHopscotchProvider(options: HopscotchProviderOptions = {}): OpenAIProvider {
  const apiKey = options.apiKey ?? process.env.HOPSCOTCH_API_KEY
  if (!apiKey) {
    throw new Error(
      '[shipyard-inference] Hopscotch requires `apiKey` (or HOPSCOTCH_API_KEY).',
    )
  }
  return new OpenAIProvider({
    apiKey,
    baseURL: options.baseURL ?? HOPSCOTCH_BASE_URL,
    defaultModel: options.defaultModel ?? HOPSCOTCH_MODELS[0].model,
    fetch: options.fetch,
  })
}

/** Return a routable candidate only when the deployment has a Hopscotch key. */
export function createHopscotchCandidate(
  env: NodeJS.ProcessEnv = process.env,
): ProviderCandidate | undefined {
  if (!env.HOPSCOTCH_API_KEY) return undefined
  return {
    id: 'hopscotch',
    provider: createHopscotchProvider({ apiKey: env.HOPSCOTCH_API_KEY }),
    models: HOPSCOTCH_MODELS,
  }
}
