import type { ChatMessage, LLMChatParams, LLMProvider } from '../types.js'

/**
 * Optional pre-routing transform applied to the request before model selection
 * and dispatch — the seam for context compression. Off by default; when set, it
 * runs once at the top of `Router.chat`/`chatStream`. Ships with two ready-made
 * implementations below, or bring your own.
 */
export type CompressionTransform = (
  params: LLMChatParams,
) => LLMChatParams | Promise<LLMChatParams>

/** Drop leading messages until the history starts cleanly on a user turn. */
function trimToUserStart(messages: ChatMessage[]): ChatMessage[] {
  let start = 0
  while (start < messages.length && messages[start]!.role !== 'user') start++
  return start === 0 ? messages : messages.slice(start)
}

/**
 * Keep only the most recent `maxMessages` messages (whole messages, so code
 * blocks and tool calls stay intact), trimmed to start on a user turn.
 * Deterministic and dependency-free — a safe default for long agent loops.
 */
export function slidingWindowCompression(options: {
  maxMessages: number
}): CompressionTransform {
  const { maxMessages } = options
  return (params) => {
    if (params.messages.length <= maxMessages) return params
    return { ...params, messages: trimToUserStart(params.messages.slice(-maxMessages)) }
  }
}

export interface SummarizeCompressionOptions {
  /** Provider used to produce the summary (use a cheap model). */
  provider: LLMProvider
  /** Keep this many recent messages verbatim; summarize everything older. */
  keepRecent: number
  /** Model override for the summarizer. */
  model?: string
  /** Only compress once the history exceeds this length. Default `keepRecent * 2`. */
  minMessages?: number
}

const SUMMARY_SYSTEM =
  'Summarize the following conversation concisely. Preserve key facts, decisions, ' +
  'identifiers, numbers, and any code or structured data verbatim. Output only the summary.'

/**
 * Summarize older messages with a (cheap) model and keep the most recent ones
 * verbatim — real token reduction for long histories. Asynchronous: it makes one
 * extra model call per compression.
 */
export function summarizeCompression(
  options: SummarizeCompressionOptions,
): CompressionTransform {
  const minMessages = options.minMessages ?? options.keepRecent * 2
  return async (params) => {
    if (params.messages.length <= minMessages) return params

    const older = params.messages.slice(0, -options.keepRecent)
    const recent = params.messages.slice(-options.keepRecent)

    const transcript = older
      .map((m) => {
        const calls = (m.toolCalls ?? []).map((t) => `[calls ${t.name}]`).join(' ')
        const results = (m.toolResults ?? [])
          .map((r) => `[tool_result ${JSON.stringify(r.result ?? r.error ?? '')}]`)
          .join(' ')
        return `${m.role}: ${[m.content, calls, results].filter(Boolean).join(' ')}`
      })
      .join('\n')

    const summary = await options.provider.chat({
      system: SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: transcript }],
      tools: [],
      model: options.model,
    })

    const summaryMessage: ChatMessage = {
      role: 'user',
      content: `[Summary of earlier conversation]\n${summary.content ?? ''}`,
    }
    return { ...params, messages: [summaryMessage, ...recent] }
  }
}
