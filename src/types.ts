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

export interface LLMChatParams {
  system: string
  messages: ChatMessage[]
  tools: ToolDefinition[]
  model?: string
  maxTokens?: number
}

export interface LLMResponse {
  content: string | null
  toolCalls: ToolCall[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
}

export interface LLMProvider {
  chat(params: LLMChatParams): Promise<LLMResponse>
}
