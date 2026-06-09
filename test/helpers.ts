import type {
  LLMChatParams,
  LLMResponse,
  LLMProvider,
} from '../src/index.js'
import type { ModelMetadata, ProviderCandidate } from '../src/index.js'

/** A mock LLMProvider that records calls and runs a supplied implementation. */
export function mockProvider(
  impl: (params: LLMChatParams) => LLMResponse | Promise<LLMResponse>,
): LLMProvider & { calls: LLMChatParams[] } {
  const calls: LLMChatParams[] = []
  return {
    calls,
    async chat(params) {
      calls.push(params)
      return impl(params)
    },
  }
}

/** A provider that always returns a fixed string content. */
export function staticProvider(content: string) {
  return mockProvider(() => ({ content, toolCalls: [], stopReason: 'end_turn' }))
}

/** A provider that always throws the given error (e.g. to simulate 429). */
export function throwingProvider(error: unknown) {
  return mockProvider(() => {
    throw error
  })
}

export function model(
  name: string,
  overrides: Partial<ModelMetadata> = {},
): ModelMetadata {
  return {
    model: name,
    inputCostPerMTok: 1,
    outputCostPerMTok: 1,
    contextWindow: 200_000,
    tier: 'standard',
    capabilities: ['tools'],
    ...overrides,
  }
}

export function candidate(
  id: string,
  provider: LLMProvider,
  models?: ModelMetadata[],
): ProviderCandidate {
  return { id, provider, models }
}

export function chatParams(over: Partial<LLMChatParams> = {}): LLMChatParams {
  return {
    system: 'sys',
    messages: [{ role: 'user', content: 'hi' }],
    tools: [],
    ...over,
  }
}

/** Build a Response for an x402 challenge body. */
export function challenge402(
  over: Record<string, unknown> = {},
): Response {
  const body = {
    accepts: [
      {
        scheme: 'exact',
        network: 'solana-devnet',
        asset: 'MintAddr',
        maxAmountRequired: '1000',
        payTo: 'RecipientAddr',
        resource: 'https://api.example/inference',
        nonce: 'nonce-1',
        ...over,
      },
    ],
  }
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: { 'content-type': 'application/json' },
  })
}
