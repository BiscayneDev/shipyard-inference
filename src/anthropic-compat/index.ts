// Anthropic Messages API compatibility — expose the gateway as an Anthropic
// endpoint so Claude Code / Anthropic-SDK agents route through Shipyard.
export { anthropicRequestToChatParams, estimateInputTokens } from './messages.js'
export { llmResponseToAnthropicMessage, createAnthropicSSEEncoder } from './response.js'
export type { AnthropicSSEFrame } from './response.js'
export { toAnthropicError } from './errors.js'
export type {
  AnthropicChatRequest,
  AnthropicMessage,
  AnthropicTool,
  AnthropicContentBlock,
  AnthropicErrorBody,
} from './types.js'
