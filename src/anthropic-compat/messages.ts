import type { ChatMessage, LLMChatParams, ToolCall, ToolCallResult } from '../types.js'
import type {
  AnthropicChatRequest,
  AnthropicContentBlock,
  AnthropicRequestMessage,
  AnthropicTextBlock,
  AnthropicToolResultBlock,
  AnthropicToolUseBlock,
} from './types.js'

/** Flatten Anthropic's `system` (string or text blocks) to a single string. */
function systemToString(system: AnthropicChatRequest['system']): string {
  if (!system) return ''
  if (typeof system === 'string') return system
  return system
    .filter((b): b is AnthropicTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
}

function toolResultData(block: AnthropicToolResultBlock): unknown {
  const raw =
    typeof block.content === 'string'
      ? block.content
      : Array.isArray(block.content)
        ? block.content.map((c) => c.text ?? '').join('')
        : ''
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/**
 * Convert one Anthropic message into internal ChatMessage(s). A single user
 * message can carry tool_result blocks (→ a `tool` message) alongside text (→ a
 * `user` message), so this returns 0..n messages.
 */
function fromAnthropicMessage(msg: AnthropicRequestMessage): ChatMessage[] {
  if (typeof msg.content === 'string') {
    return [{ role: msg.role, content: msg.content }]
  }
  const blocks = msg.content as AnthropicContentBlock[]

  if (msg.role === 'assistant') {
    let text: string | null = null
    const toolCalls: ToolCall[] = []
    for (const b of blocks) {
      if (b.type === 'text') text = (text ?? '') + (b as AnthropicTextBlock).text
      else if (b.type === 'tool_use') {
        const tu = b as AnthropicToolUseBlock
        toolCalls.push({ id: tu.id, name: tu.name, input: tu.input ?? {} })
      }
    }
    return [{ role: 'assistant', content: text, toolCalls: toolCalls.length ? toolCalls : undefined }]
  }

  // user message: split text vs tool_result blocks
  let text: string | null = null
  const toolResults: ToolCallResult[] = []
  for (const b of blocks) {
    if (b.type === 'text') text = (text ?? '') + (b as AnthropicTextBlock).text
    else if (b.type === 'tool_result') {
      const tr = b as AnthropicToolResultBlock
      toolResults.push(
        tr.is_error
          ? { id: tr.tool_use_id, error: String(toolResultData(tr)) }
          : { id: tr.tool_use_id, result: { success: true, data: toolResultData(tr) } },
      )
    }
  }
  const out: ChatMessage[] = []
  if (toolResults.length) out.push({ role: 'tool', content: null, toolResults })
  if (text !== null) out.push({ role: 'user', content: text })
  if (out.length === 0) out.push({ role: 'user', content: '' })
  return out
}

/**
 * Anthropic Messages API request → internal `LLMChatParams`. The reverse of
 * `AnthropicProvider`'s request building — so a request from Claude Code routes
 * through the Router exactly like any other.
 */
export function anthropicRequestToChatParams(body: AnthropicChatRequest): LLMChatParams {
  const messages = (body.messages ?? []).flatMap(fromAnthropicMessage)
  const tools = (body.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description ?? '',
    inputSchema: t.input_schema ?? {},
  }))
  const params: LLMChatParams = {
    system: systemToString(body.system),
    messages,
    tools,
    model: body.model,
    maxTokens: body.max_tokens,
  }
  if (body.metadata?.user_id) params.metadata = { userId: body.metadata.user_id }
  return params
}

/** Cheap token estimate for `/v1/messages/count_tokens` (chars/4 heuristic). */
export function estimateInputTokens(body: AnthropicChatRequest): number {
  let chars = systemToString(body.system).length
  for (const m of body.messages ?? []) {
    chars += typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length
  }
  for (const t of body.tools ?? []) chars += JSON.stringify(t).length
  return Math.max(1, Math.ceil(chars / 4))
}
