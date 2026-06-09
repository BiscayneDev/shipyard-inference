import Anthropic from '@anthropic-ai/sdk'
import type {
  LLMProvider,
  LLMChatParams,
  LLMResponse,
  ChatMessage,
  ToolCall,
} from '../types.js'

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
    })
    this.defaultModel = options.defaultModel ?? 'claude-sonnet-4-5'
    this.defaultMaxTokens = options.defaultMaxTokens ?? 4096
  }

  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const model = params.model ?? this.defaultModel
    const maxTokens = params.maxTokens ?? this.defaultMaxTokens

    const messages = params.messages.map((msg) => this.toAnthropicMessage(msg))

    const tools = params.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
    }))

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: params.system,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    })

    return this.parseResponse(response)
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

    return { content, toolCalls, stopReason }
  }
}
