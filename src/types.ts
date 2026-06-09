export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  toolCalls?: ToolCall[]
  toolResults?: ToolCallResult[]
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolCallResult {
  id: string
  result?: ToolResult
  error?: string
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * Optional hints that steer router model selection. Every field is optional and
 * additive: a caller that omits `routingHints` (or omits any individual field)
 * gets the pre-router behaviour unchanged. Hints are ignored by the leaf
 * providers (Anthropic/OpenAI/UsePod) — only `Router` reads them.
 */
export interface RoutingHints {
  /** Minimum quality tier the chosen model must meet. */
  tier?: 'economy' | 'standard' | 'frontier'
  /** Require a tool-capable model (implied when `tools` is non-empty). */
  requireTools?: boolean
  /** Require a vision-capable model. */
  requireVision?: boolean
  /** Require a context window of at least this many tokens. */
  minContextWindow?: number
  /** Hard override: skip selection and use this provider/model verbatim. */
  pin?: { provider?: string; model?: string }
  /** Reject any model whose output price exceeds this (USD per 1M tokens). */
  maxCostPerMTokOut?: number
  /** Free-form tags matched against a model's declared capabilities. */
  tags?: string[]
}

export interface LLMChatParams {
  system: string
  messages: ChatMessage[]
  tools: ToolDefinition[]
  model?: string
  maxTokens?: number
  /** Optional routing hints — read only by `Router`, ignored by leaf providers. */
  routingHints?: RoutingHints
}

export interface LLMResponse {
  content: string | null
  toolCalls: ToolCall[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
}

export interface LLMProvider {
  chat(params: LLMChatParams): Promise<LLMResponse>
}
