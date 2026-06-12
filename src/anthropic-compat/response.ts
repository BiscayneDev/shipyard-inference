import type { LLMResponse, LLMStreamEvent, UsageInfo } from '../types.js'
import type { AnthropicMessage, AnthropicUsage } from './types.js'

function toAnthropicUsage(usage: UsageInfo | undefined): AnthropicUsage {
  const u: AnthropicUsage = {
    input_tokens: usage?.inputTokens ?? 0,
    output_tokens: usage?.outputTokens ?? 0,
  }
  if (usage?.cacheReadTokens != null) u.cache_read_input_tokens = usage.cacheReadTokens
  if (usage?.cacheWriteTokens != null) u.cache_creation_input_tokens = usage.cacheWriteTokens
  return u
}

function mapStopReason(reason: LLMResponse['stopReason']): AnthropicMessage['stop_reason'] {
  if (reason === 'tool_use') return 'tool_use'
  if (reason === 'max_tokens') return 'max_tokens'
  return 'end_turn'
}

/** Internal response → a non-streaming Anthropic `Message`. */
export function llmResponseToAnthropicMessage(
  response: LLMResponse,
  model: string,
  id: string,
): AnthropicMessage {
  const content: AnthropicMessage['content'] = []
  if (response.content) content.push({ type: 'text', text: response.content })
  for (const tc of response.toolCalls ?? []) {
    content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
  }
  return {
    id,
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: mapStopReason(response.stopReason),
    stop_sequence: null,
    usage: toAnthropicUsage(response.usage),
  }
}

export interface AnthropicSSEFrame {
  event: string
  data: string
}
const frame = (event: string, data: unknown): AnthropicSSEFrame => ({ event, data: JSON.stringify(data) })

/**
 * Stateful encoder: internal `LLMStreamEvent`s → Anthropic Messages SSE frames
 * (named events, content-block open/close bookkeeping). Mirrors the OpenAI chunk
 * encoder. The gateway writes each frame via Hono `stream.writeSSE`.
 */
export function createAnthropicSSEEncoder(model: string, id: string) {
  let started = false
  let index = -1
  let openType: 'text' | 'tool_use' | null = null

  function start(): AnthropicSSEFrame[] {
    started = true
    return [
      frame('message_start', {
        type: 'message_start',
        message: {
          id,
          type: 'message',
          role: 'assistant',
          model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      }),
    ]
  }

  function closeBlock(): AnthropicSSEFrame[] {
    if (openType === null) return []
    const f = frame('content_block_stop', { type: 'content_block_stop', index })
    openType = null
    return [f]
  }

  return {
    forEvent(event: LLMStreamEvent): AnthropicSSEFrame[] {
      const out: AnthropicSSEFrame[] = []
      if (!started) out.push(...start())

      if (event.type === 'text_delta') {
        if (openType !== 'text') {
          out.push(...closeBlock())
          index += 1
          openType = 'text'
          out.push(frame('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } }))
        }
        out.push(frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: event.text } }))
      } else if (event.type === 'tool_call_start') {
        out.push(...closeBlock())
        index += 1
        openType = 'tool_use'
        out.push(frame('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: event.id, name: event.name, input: {} } }))
      } else if (event.type === 'tool_call_delta') {
        if (openType === 'tool_use') {
          out.push(frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: event.argsTextDelta } }))
        }
      } else if (event.type === 'done') {
        out.push(...closeBlock())
        out.push(frame('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: mapStopReason(event.response.stopReason), stop_sequence: null },
          usage: { output_tokens: event.response.usage?.outputTokens ?? 0 },
        }))
        out.push(frame('message_stop', { type: 'message_stop' }))
      }
      return out
    },
  }
}
