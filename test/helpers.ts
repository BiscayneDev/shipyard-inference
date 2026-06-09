import type {
  LLMChatParams,
  LLMResponse,
  LLMProvider,
  LLMStreamEvent,
} from '../src/index.js'
import type { ModelMetadata, ProviderCandidate } from '../src/index.js'

/**
 * A provider whose `chatStream` replays a scripted event list, optionally
 * throwing at a given position (`throwAt`). `throwAt: 0` throws before any
 * event (pre-content); `throwAt: n` throws after yielding event n-1.
 */
export function streamingProvider(
  events: LLMStreamEvent[],
  opts: { throwAt?: number; error?: unknown } = {},
): LLMProvider & { streamCalls: LLMChatParams[] } {
  const streamCalls: LLMChatParams[] = []
  return {
    streamCalls,
    async chat() {
      return { content: '(nonstream)', toolCalls: [], stopReason: 'end_turn' }
    },
    async *chatStream(params) {
      streamCalls.push(params)
      for (let i = 0; i < events.length; i++) {
        if (opts.throwAt === i) throw opts.error ?? new Error('stream error')
        yield events[i]!
      }
      if (opts.throwAt === events.length) throw opts.error ?? new Error('stream error')
    },
  }
}

/** Build a Response carrying an SSE body, returned from an injected `fetch`. */
export function sseFetch(sse: string): typeof fetch {
  return (async () =>
    new Response(sse, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })) as unknown as typeof fetch
}

/** Serialize Anthropic-style named SSE events. */
export function anthropicSSE(events: Array<{ event: string; data: unknown }>): string {
  return events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('')
}

/** Serialize OpenAI-style `data:`-only SSE chunks, terminated by `[DONE]`. */
export function openaiSSE(chunks: unknown[]): string {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
}

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
