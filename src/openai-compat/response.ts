import type { LLMResponse, LLMStreamEvent, UsageInfo } from '../types.js'
import type {
  OpenAIChatCompletion,
  OpenAIChatCompletionChunk,
  OpenAIToolCall,
  OpenAIUsage,
} from './types.js'

type FinishReason = 'stop' | 'tool_calls' | 'length'

function finishReason(stopReason: LLMResponse['stopReason']): FinishReason {
  if (stopReason === 'tool_use') return 'tool_calls'
  if (stopReason === 'max_tokens') return 'length'
  return 'stop'
}

function toOpenAIUsage(usage: UsageInfo | undefined): OpenAIUsage | undefined {
  if (!usage) return undefined
  return {
    prompt_tokens: usage.inputTokens,
    completion_tokens: usage.outputTokens,
    total_tokens: usage.inputTokens + usage.outputTokens,
  }
}

/** Internal response → OpenAI (non-streaming) chat completion. */
export function llmResponseToOpenAICompletion(
  response: LLMResponse,
  model: string,
  id: string,
): OpenAIChatCompletion {
  const toolCalls: OpenAIToolCall[] | undefined =
    response.toolCalls.length > 0
      ? response.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        }))
      : undefined

  return {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: response.content, ...(toolCalls ? { tool_calls: toolCalls } : {}) },
        finish_reason: finishReason(response.stopReason),
      },
    ],
    usage: toOpenAIUsage(response.usage),
  }
}

/**
 * Stateful encoder turning internal stream events into OpenAI
 * `chat.completion.chunk`s. Emits the conventional `role: 'assistant'` on the
 * first delta; on `done` emits a final finish-reason chunk and (when
 * `includeUsage`) a trailing usage-only chunk.
 */
export function createChunkEncoder(model: string, id: string, includeUsage: boolean) {
  const created = Math.floor(Date.now() / 1000)
  const head = { id, object: 'chat.completion.chunk' as const, created, model }
  let first = true

  function roleField(): { role: 'assistant' } | Record<string, never> {
    if (first) {
      first = false
      return { role: 'assistant' }
    }
    return {}
  }

  return {
    forEvent(event: LLMStreamEvent): OpenAIChatCompletionChunk[] {
      switch (event.type) {
        case 'text_delta':
          return [
            { ...head, choices: [{ index: 0, delta: { ...roleField(), content: event.text }, finish_reason: null }] },
          ]
        case 'tool_call_start':
          return [
            {
              ...head,
              choices: [
                {
                  index: 0,
                  delta: {
                    ...roleField(),
                    tool_calls: [
                      { index: event.index, id: event.id, type: 'function', function: { name: event.name, arguments: '' } },
                    ],
                  },
                  finish_reason: null,
                },
              ],
            },
          ]
        case 'tool_call_delta':
          return [
            {
              ...head,
              choices: [
                {
                  index: 0,
                  delta: { tool_calls: [{ index: event.index, function: { arguments: event.argsTextDelta } }] },
                  finish_reason: null,
                },
              ],
            },
          ]
        case 'done': {
          const chunks: OpenAIChatCompletionChunk[] = [
            { ...head, choices: [{ index: 0, delta: {}, finish_reason: finishReason(event.response.stopReason) }] },
          ]
          const usage = toOpenAIUsage(event.response.usage)
          if (includeUsage && usage) {
            chunks.push({ ...head, choices: [], usage })
          }
          return chunks
        }
      }
    },
  }
}
