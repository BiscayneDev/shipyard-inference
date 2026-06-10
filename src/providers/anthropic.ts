import Anthropic from '@anthropic-ai/sdk'
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

export interface AnthropicProviderOptions {
  apiKey?: string
  baseURL?: string
  defaultModel?: string
  defaultMaxTokens?: number
  /**
   * Custom fetch implementation passed straight to the Anthropic SDK. The
   * payment layer uses this to inject `createPayingFetch`, so an HTTP 402 from
   * the upstream is settled and retried transparently — `chat()` never learns
   * a payment happened.
   */
  fetch?: typeof fetch
  /** Default headers sent on every request (e.g. UsePod's `X-Pod-Max-Price-*`). */
  defaultHeaders?: Record<string, string>
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic
  private defaultModel: string
  private defaultMaxTokens: number

  constructor(options: AnthropicProviderOptions = {}) {
    this.client = new Anthropic({
      apiKey: options.apiKey ?? process.env.ANTHROPIC_API_KEY,
      baseURL: options.baseURL ?? process.env.ANTHROPIC_BASE_URL,
      fetch: options.fetch,
      defaultHeaders: options.defaultHeaders,
    })
    this.defaultModel = options.defaultModel ?? 'claude-sonnet-4-5'
    this.defaultMaxTokens = options.defaultMaxTokens ?? 4096
  }

  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const response = await this.client.messages.create(this.buildRequest(params))
    return this.parseResponse(response)
  }

  async *chatStream(
    params: LLMChatParams,
    opts?: LLMStreamOptions,
  ): AsyncIterable<LLMStreamEvent> {
    const stream = await this.client.messages.create(
      { ...this.buildRequest(params), stream: true },
      { signal: opts?.signal },
    )

    let content: string | null = null
    let stopReason: LLMResponse['stopReason'] = 'end_turn'
    let usage: UsageInfo | undefined
    let inputUsage: Anthropic.Usage | undefined
    // Anthropic content-block index → our stable 0-based tool index.
    const toolIndexByBlock = new Map<number, number>()
    const toolBuffers = new Map<number, { id: string; name: string; args: string }>()
    let nextToolIndex = 0

    for await (const event of stream) {
      if (event.type === 'message_start') {
        inputUsage = event.message.usage
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          const index = nextToolIndex++
          toolIndexByBlock.set(event.index, index)
          toolBuffers.set(index, {
            id: event.content_block.id,
            name: event.content_block.name,
            args: '',
          })
          yield {
            type: 'tool_call_start',
            index,
            id: event.content_block.id,
            name: event.content_block.name,
          }
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          content = (content ?? '') + event.delta.text
          yield { type: 'text_delta', text: event.delta.text }
        } else if (event.delta.type === 'input_json_delta') {
          const index = toolIndexByBlock.get(event.index)
          if (index !== undefined) {
            const buf = toolBuffers.get(index)
            if (buf) buf.args += event.delta.partial_json
            yield { type: 'tool_call_delta', index, argsTextDelta: event.delta.partial_json }
          }
        }
      } else if (event.type === 'message_delta') {
        if (event.delta.stop_reason === 'tool_use') stopReason = 'tool_use'
        else if (event.delta.stop_reason === 'max_tokens') stopReason = 'max_tokens'
        // message_delta.usage carries the running output token count.
        usage = parseAnthropicUsage({
          ...(inputUsage ?? ({} as Anthropic.Usage)),
          output_tokens: event.usage.output_tokens,
        } as Anthropic.Usage)
      }
      // Unknown event types are ignored.
    }

    const toolCalls: ToolCall[] = [...toolBuffers.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, b]) => ({ id: b.id, name: b.name, input: parseToolArguments(b.name, b.args) }))

    yield {
      type: 'done',
      response: { content, toolCalls, stopReason, usage },
    }
  }

  private buildRequest(params: LLMChatParams): Anthropic.MessageCreateParamsNonStreaming {
    const tools = params.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
    }))

    return {
      model: params.model ?? this.defaultModel,
      max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      system: params.system,
      messages: params.messages.map((msg) => this.toAnthropicMessage(msg)),
      tools: tools.length > 0 ? tools : undefined,
    }
  }

  private toAnthropicMessage(msg: ChatMessage): Anthropic.MessageParam {
    if (msg.role === 'user') {
      return { role: 'user', content: msg.content ?? '' }
    }

    if (msg.role === 'assistant') {
      const content: Anthropic.ContentBlockParam[] = []

      if (msg.content) {
        content.push({ type: 'text', text: msg.content })
      }

      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input,
          })
        }
      }

      return { role: 'assistant', content }
    }

    if (msg.toolResults) {
      const content: Anthropic.ToolResultBlockParam[] = msg.toolResults.map(
        (tr) => ({
          type: 'tool_result' as const,
          tool_use_id: tr.id,
          content: tr.error
            ? JSON.stringify({ error: tr.error })
            : JSON.stringify(tr.result ?? { success: true }),
        })
      )
      return { role: 'user', content }
    }

    return { role: 'user', content: msg.content ?? '' }
  }

  private parseResponse(response: Anthropic.Message): LLMResponse {
    let content: string | null = null
    const toolCalls: ToolCall[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        content = block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        })
      }
    }

    let stopReason: LLMResponse['stopReason'] = 'end_turn'
    if (response.stop_reason === 'tool_use') {
      stopReason = 'tool_use'
    } else if (response.stop_reason === 'max_tokens') {
      stopReason = 'max_tokens'
    }

    return { content, toolCalls, stopReason, usage: parseAnthropicUsage(response.usage) }
  }
}

export function parseAnthropicUsage(
  usage: Anthropic.Usage | undefined | null,
): UsageInfo | undefined {
  if (!usage) return undefined
  const info: UsageInfo = {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
  }
  if (usage.cache_read_input_tokens != null) {
    info.cacheReadTokens = usage.cache_read_input_tokens
  }
  if (usage.cache_creation_input_tokens != null) {
    info.cacheWriteTokens = usage.cache_creation_input_tokens
  }
  return info
}
