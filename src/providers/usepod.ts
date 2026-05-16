import type { LLMProvider, LLMChatParams, LLMResponse } from '../types.js'
import type { OWSClient } from '../signers/ows.js'

export interface UsePodProviderOptions {
  endpoint?: string
  walletId: string
  signer: OWSClient
  defaultModel?: string
  defaultMaxTokens?: number
}

/**
 * UsePod inference provider (STUB).
 *
 * Public UsePod SDK is not yet on npm — coordinator/client SDKs live in a
 * private monorepo (see https://github.com/Sortis-AI/usepod-agent). When
 * available, this will POST to UsePod's OpenAI-compatible endpoint and
 * handle the x402 USDC-on-Solana payment via OWSClient.signTransaction.
 */
export class UsePodProvider implements LLMProvider {
  constructor(_options: UsePodProviderOptions) {
    // intentionally empty until SDK lands
  }

  async chat(_params: LLMChatParams): Promise<LLMResponse> {
    throw new Error(
      '[shipyard-inference] UsePodProvider is not yet implemented. ' +
        'Tracking https://github.com/Sortis-AI/usepod-agent for SDK release. ' +
        'Until then, use AnthropicProvider or OpenAIProvider.'
    )
  }
}
