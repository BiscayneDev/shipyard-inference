import type {
  ChatMessage,
  LLMChatParams,
  ToolCall,
  ToolDefinition,
} from '../types.js'
import type { OpenAIChatMessage, OpenAIChatRequest } from './types.js'

/** Flatten an OpenAI message's content (string or content-part array) to text. */
function flattenContent(content: OpenAIChatMessage['content']): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  return content.map((part) => part.text ?? '').join('')
}

/**
 * Translate an inbound OpenAI Chat Completions request into the internal
 * `LLMChatParams`. System/developer messages are concatenated into `system`;
 * the rest map to internal `ChatMessage`s. The inverse of what the providers
 * do when calling OpenAI, so the gateway and providers stay symmetric.
 */
export function openAIRequestToChatParams(body: OpenAIChatRequest): LLMChatParams {
  const systemParts: string[] = []
  const messages: ChatMessage[] = []

  for (const msg of body.messages) {
    if (msg.role === 'system' || msg.role === 'developer') {
      systemParts.push(flattenContent(msg.content))
      continue
    }

    if (msg.role === 'user') {
      messages.push({ role: 'user', content: flattenContent(msg.content) })
      continue
    }

    if (msg.role === 'assistant') {
      const toolCalls: ToolCall[] | undefined = msg.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: safeParseArgs(tc.function.arguments),
      }))
      messages.push({
        role: 'assistant',
        content: msg.content == null ? null : flattenContent(msg.content),
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      })
      continue
    }

    if (msg.role === 'tool') {
      messages.push({
        role: 'tool',
        content: null,
        toolResults: [
          {
            id: msg.tool_call_id ?? '',
            result: { success: true, data: flattenContent(msg.content) },
          },
        ],
      })
    }
  }

  const tools: ToolDefinition[] = (body.tools ?? [])
    .filter((t) => t.type === 'function')
    .map((t) => ({
      name: t.function.name,
      description: t.function.description ?? '',
      inputSchema: t.function.parameters ?? {},
    }))

  return {
    system: systemParts.join('\n\n'),
    messages,
    tools,
    model: body.model,
    maxTokens: body.max_tokens ?? body.max_completion_tokens,
  }
}

function safeParseArgs(args: string): Record<string, unknown> {
  if (!args) return {}
  try {
    return JSON.parse(args) as Record<string, unknown>
  } catch {
    return {}
  }
}
