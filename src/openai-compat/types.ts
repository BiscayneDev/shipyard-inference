/**
 * Minimal local typings for the OpenAI Chat Completions wire format used by the
 * gateway. Deliberately independent of the `openai` package's public types so
 * the gateway path doesn't couple to that SDK's versions.
 */

export interface OpenAIToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface OpenAIChatMessage {
  role: 'system' | 'developer' | 'user' | 'assistant' | 'tool'
  content?: string | null | Array<{ type: string; text?: string }>
  name?: string
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
}

export interface OpenAITool {
  type: 'function'
  function: { name: string; description?: string; parameters?: Record<string, unknown> }
}

export interface OpenAIChatRequest {
  model: string
  messages: OpenAIChatMessage[]
  tools?: OpenAITool[]
  max_tokens?: number
  max_completion_tokens?: number
  stream?: boolean
  stream_options?: { include_usage?: boolean }
  /** Opaque end-user id (OpenAI-standard). Mapped to `metadata.userId` for per-user attribution. */
  user?: string
}

export interface OpenAIUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface OpenAIChatCompletion {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: { role: 'assistant'; content: string | null; tool_calls?: OpenAIToolCall[] }
    finish_reason: 'stop' | 'tool_calls' | 'length'
  }>
  usage?: OpenAIUsage
}

export interface OpenAIChatCompletionChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: 'assistant'
      content?: string
      tool_calls?: Array<{
        index: number
        id?: string
        type?: 'function'
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason: 'stop' | 'tool_calls' | 'length' | null
  }>
  usage?: OpenAIUsage
}

export interface OpenAIErrorBody {
  error: { message: string; type: string; code: string | null; param: string | null }
}
