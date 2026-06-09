import type { LLMChatParams } from '../types.js'

/**
 * Optional pre-routing transform applied to the request before model selection
 * and dispatch. This is the seam for context compression (token trimming,
 * summarization, redaction). It is off by default; when configured, it runs
 * once at the top of `Router.chat`. shipyard-inference ships no compressor of
 * its own — bring your own `CompressionTransform`.
 */
export type CompressionTransform = (
  params: LLMChatParams,
) => LLMChatParams | Promise<LLMChatParams>
