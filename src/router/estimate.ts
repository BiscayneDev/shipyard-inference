import type { LLMChatParams } from '../types.js'

/**
 * Rough input-token estimate using the classic ~4-chars-per-token heuristic
 * over system prompt, message contents, and serialized tool definitions. This
 * is deliberately dependency-free (no tokenizer) — it is only ever used to
 * rank candidates and sanity-check context-window fit, never for billing.
 */
export function estimateInputTokens(params: LLMChatParams): number {
  let chars = params.system.length

  for (const msg of params.messages) {
    if (msg.content) chars += msg.content.length
    if (msg.toolCalls) chars += JSON.stringify(msg.toolCalls).length
    if (msg.toolResults) chars += JSON.stringify(msg.toolResults).length
  }

  if (params.tools.length > 0) chars += JSON.stringify(params.tools).length

  return Math.ceil(chars / 4)
}
