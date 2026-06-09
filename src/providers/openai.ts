import OpenAI from 'openai'
import type {
  LLMProvider,
  LLMChatParams,
  LLMResponse,
  ChatMessage,
  ToolCall,
  UsageInfo,
} from '../types.js'

export interface OpenAIProviderOptions {
  apiKey?: string
  baseURL?: string
  defaultModel?: string
  defaultMaxTokens?: number
  /**
   * Custom fetch implementation passed straight to the OpenAI SDK. The payment
   * layer uses this to inject `createPayingFetch`, so an HTTP 402 from the
   * upstream is settled and retried transparently — `chat()` never learns a
   * payment happened.
   */
  fetch?: typeof fetch
}

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  private defaultModel: string
  private defaultMaxTokens: number

  constructor(options: OpenAIProviderOptions = {}) {
    this.client = new OpenAI({
      apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: options.baseURL ?? process.env.OPENAI_BASE_URL,
      fetch: options.fetch,
    })
    this.defaultModel = options.defaultModel ?? 'gpt-4o'
    this.defaultMaxTokens = options.defaultMaxTokens ?? 4096
  }

  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const model = params.model ?? this.defaultModel
    const maxTokens = params.maxTokens ?? this.defaultMaxTokens

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: params.system },
      ...this.expandMessages(params.messages),
    ]

    const tools: OpenAI.ChatCompletionTool[] | undefined =
      params.tools.length > 0
        ? params.tools.map((tool) => ({
            type: 'function' as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
            },
          }))
        : undefined

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages,
      tools,
    })

    return this.parseResponse(response)
  }

  private expandMessages(
    messages: ChatMessage[]
  ): OpenAI.ChatCompletionMessageParam[] {
    const expanded: OpenAI.ChatCompletionMessageParam[] = []

    for (const msg of messages) {
      if (msg.role === 'user') {
        expanded.push({ role: 'user', content: msg.content ?? '' })
        continue
      }

      if (msg.role === 'assistant') {
        const toolCalls: OpenAI.ChatCompletionMessageToolCall[] | undefined =
          msg.toolCalls && msg.toolCalls.length > 0
            ? msg.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.input),
                },
              }))
            : undefined

        expanded.push({
          role: 'assistant',
          content: msg.content,
          tool_calls: toolCalls,
        })
        continue
      }

      if (msg.toolResults && msg.toolResults.length > 0) {
        for (const tr of msg.toolResults) {
          expanded.push({
            role: 'tool',
            tool_call_id: tr.id,
            content: tr.error
              ? JSON.stringify({ error: tr.error })
              : JSON.stringify(tr.result ?? { success: true }),
          })
        }
      } else {
        expanded.push({ role: 'user', content: msg.content ?? '' })
      }
    }

    return expanded
  }

  private parseResponse(response: OpenAI.ChatCompletion): LLMResponse {
    const choice = response.choices[0]
    if (!choice) {
      return { content: null, toolCalls: [], stopReason: 'end_turn' }
    }

    const content = choice.message.content
    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? [])
      .filter(
        (
          tc
        ): tc is OpenAI.ChatCompletionMessageToolCall & { type: 'function' } =>
          tc.type === 'function'
      )
      .map((tc) => {
        let input: Record<string, unknown> = {}
        try {
          input = JSON.parse(tc.function.arguments) as Record<string, unknown>
        } catch (err) {
          console.warn(
            '[shipyard-inference] Failed to parse OpenAI tool call arguments',
            {
              toolName: tc.function.name,
              args: tc.function.arguments,
              error: err instanceof Error ? err.message : String(err),
            }
          )
        }
        return { id: tc.id, name: tc.function.name, input }
      })

    let stopReason: LLMResponse['stopReason'] = 'end_turn'
    if (choice.finish_reason === 'tool_calls') {
      stopReason = 'tool_use'
    } else if (choice.finish_reason === 'length') {
      stopReason = 'max_tokens'
    }

    return { content, toolCalls, stopReason, usage: parseOpenAIUsage(response.usage) }
  }
}

export function parseOpenAIUsage(
  usage: OpenAI.CompletionUsage | undefined | null,
): UsageInfo | undefined {
  if (!usage) return undefined
  const info: UsageInfo = {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  }
  const cached = usage.prompt_tokens_details?.cached_tokens
  if (cached != null) info.cacheReadTokens = cached
  return info
}
