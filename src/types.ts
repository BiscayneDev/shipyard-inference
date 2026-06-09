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

/** Token accounting for a single completion, when the upstream reports it. */
export interface UsageInfo {
  inputTokens: number
  outputTokens: number
  /** Prompt tokens served from the provider's cache, when reported. */
  cacheReadTokens?: number
  /** Prompt tokens written to the provider's cache, when reported. */
  cacheWriteTokens?: number
}

export interface LLMResponse {
  content: string | null
  toolCalls: ToolCall[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
  /** Token usage from the upstream, when available. Optional — some proxies strip it. */
  usage?: UsageInfo
}

/** A streamed text fragment. */
export interface LLMStreamTextDelta {
  type: 'text_delta'
  text: string
}
/** A tool call begins. `index` is a stable 0-based position in the final `toolCalls`. */
export interface LLMStreamToolCallStart {
  type: 'tool_call_start'
  index: number
  id: string
  name: string
}
/** A fragment of a tool call's argument JSON. Raw text — NOT valid JSON on its own. */
export interface LLMStreamToolCallDelta {
  type: 'tool_call_delta'
  index: number
  argsTextDelta: string
}
/** Terminal event. The only authoritative source of the full response, usage, and stopReason. */
export interface LLMStreamDone {
  type: 'done'
  response: LLMResponse
}
export type LLMStreamEvent =
  | LLMStreamTextDelta
  | LLMStreamToolCallStart
  | LLMStreamToolCallDelta
  | LLMStreamDone

export interface LLMStreamOptions {
  /** Abort the upstream request (e.g. on client disconnect) to stop token spend. */
  signal?: AbortSignal
}

export interface LLMProvider {
  chat(params: LLMChatParams): Promise<LLMResponse>
  /**
   * Optional streaming variant. Yields incremental events ending in a single
   * `done` event carrying the assembled `LLMResponse`. Optional so existing
   * implementers remain valid; `Router` adapts non-streaming providers.
   */
  chatStream?(
    params: LLMChatParams,
    opts?: LLMStreamOptions,
  ): AsyncIterable<LLMStreamEvent>
}
