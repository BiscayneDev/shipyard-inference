import OpenAI from 'openai'
import type {
  LLMProvider,
  LLMChatParams,
  LLMResponse,
  ChatMessage,
  ToolCall,
  UsageInfo,
  LLMStreamEvent,
  LLMStreamOptions,
} from '../types.js'
import { parseToolArguments } from '../stream.js'

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
  /** Default headers sent on every request (e.g. UsePod's `X-Pod-Max-Price-*`). */
  defaultHeaders?: Record<string, string>
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
      defaultHeaders: options.defaultHeaders,
    })
    this.defaultModel = options.defaultModel ?? 'gpt-4o'
    this.defaultMaxTokens = options.defaultMaxTokens ?? 4096
  }

  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create(this.buildRequest(params))
    return this.parseResponse(response)
  }

  async *chatStream(
    params: LLMChatParams,
    opts?: LLMStreamOptions,
  ): AsyncIterable<LLMStreamEvent> {
    const stream = await this.client.chat.completions.create(
      {
        ...this.buildRequest(params),
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: opts?.signal },
    )

    let content: string | null = null
    let stopReason: LLMResponse['stopReason'] = 'end_turn'
    let usage: UsageInfo | undefined
    const buffers = new Map<number, { id: string; name: string; args: string }>()
    const started = new Set<number>()

    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      if (choice) {
        const delta = choice.delta
        if (delta?.content) {
          content = (content ?? '') + delta.content
          yield { type: 'text_delta', text: delta.content }
        }
        for (const tc of delta?.tool_calls ?? []) {
          const index = tc.index
          let buf = buffers.get(index)
          if (!buf) {
            buf = { id: '', name: '', args: '' }
            buffers.set(index, buf)
          }
          if (tc.id) buf.id = tc.id
          if (tc.function?.name) buf.name = tc.function.name
          if (!started.has(index) && buf.id && buf.name) {
            started.add(index)
            yield { type: 'tool_call_start', index, id: buf.id, name: buf.name }
          }
          if (tc.function?.arguments) {
            buf.args += tc.function.arguments
            yield { type: 'tool_call_delta', index, argsTextDelta: tc.function.arguments }
          }
        }
        if (choice.finish_reason === 'tool_calls') stopReason = 'tool_use'
        else if (choice.finish_reason === 'length') stopReason = 'max_tokens'
      }
      // The final usage-only chunk (choices: []) carries token counts.
      if (chunk.usage) usage = parseOpenAIUsage(chunk.usage)
      // Unknown / non-standard chunk shapes are tolerated and skipped.
    }

    const toolCalls: ToolCall[] = [...buffers.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, b]) => ({ id: b.id, name: b.name, input: parseToolArguments(b.name, b.args) }))

    yield { type: 'done', response: { content, toolCalls, stopReason, usage } }
  }

  private buildRequest(
    params: LLMChatParams,
  ): OpenAI.ChatCompletionCreateParamsNonStreaming {
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

    return {
      model: params.model ?? this.defaultModel,
      max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      messages,
      tools,
    }
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
