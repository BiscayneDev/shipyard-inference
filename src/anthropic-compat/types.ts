// Minimal Anthropic Messages API wire types — just what the gateway endpoint
// reads/writes. Lets Claude Code (and any Anthropic-SDK agent) point at the
// gateway via ANTHROPIC_BASE_URL and route through Shipyard.

export interface AnthropicTextBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}
export interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}
export interface AnthropicToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content?: string | Array<{ type: string; text?: string }>
  is_error?: boolean
}
export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock
  | { type: string; [k: string]: unknown }

export interface AnthropicRequestMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

export interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
  cache_control?: { type: 'ephemeral' }
}

export interface AnthropicChatRequest {
  model: string
  max_tokens: number
  system?: string | AnthropicTextBlock[]
  messages: AnthropicRequestMessage[]
  tools?: AnthropicTool[]
  stream?: boolean
  /** Tagging — Anthropic's metadata.user_id, mapped to our userId. */
  metadata?: { user_id?: string }
}

export interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export interface AnthropicMessage {
  id: string
  type: 'message'
  role: 'assistant'
  model: string
  content: Array<AnthropicTextBlock | AnthropicToolUseBlock>
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | null
  stop_sequence: null
  usage: AnthropicUsage
}

export interface AnthropicErrorBody {
  type: 'error'
  error: { type: string; message: string }
}
