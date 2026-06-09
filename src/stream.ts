import type { LLMResponse, LLMStreamEvent, ToolCall } from './types.js'

/**
 * Parse a (fully assembled) tool-call argument string into an object, mirroring
 * the non-streaming providers' warn-on-failure behavior. Never call this on a
 * partial fragment — only on the complete buffer.
 */
export function parseToolArguments(
  name: string,
  args: string,
): Record<string, unknown> {
  if (!args) return {}
  try {
    return JSON.parse(args) as Record<string, unknown>
  } catch (err) {
    console.warn('[shipyard-inference] Failed to parse streamed tool call arguments', {
      toolName: name,
      args,
      error: err instanceof Error ? err.message : String(err),
    })
    return {}
  }
}

/**
 * Consume a stream into a full `LLMResponse`. Prefers the authoritative `done`
 * event; falls back to assembling from deltas if a stream ends without one.
 */
export async function collectStream(
  stream: AsyncIterable<LLMStreamEvent>,
): Promise<LLMResponse> {
  let content: string | null = null
  const buffers = new Map<number, { id: string; name: string; args: string }>()

  for await (const event of stream) {
    switch (event.type) {
      case 'text_delta':
        content = (content ?? '') + event.text
        break
      case 'tool_call_start':
        buffers.set(event.index, { id: event.id, name: event.name, args: '' })
        break
      case 'tool_call_delta': {
        const buf = buffers.get(event.index)
        if (buf) buf.args += event.argsTextDelta
        break
      }
      case 'done':
        return event.response
    }
  }

  // Fallback: no terminal `done` (malformed stream) — assemble what we have.
  const toolCalls: ToolCall[] = [...buffers.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, b]) => ({ id: b.id, name: b.name, input: parseToolArguments(b.name, b.args) }))
  return {
    content,
    toolCalls,
    stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
  }
}

/**
 * Adapt a completed `LLMResponse` into a stream: reconstructed content/tool
 * events followed by `done`. Used by the Router to present non-streaming
 * providers and cache hits through the streaming interface uniformly.
 */
export async function* responseToStream(
  response: LLMResponse,
): AsyncIterable<LLMStreamEvent> {
  if (response.content) {
    yield { type: 'text_delta', text: response.content }
  }
  for (let index = 0; index < response.toolCalls.length; index++) {
    const tc = response.toolCalls[index]!
    yield { type: 'tool_call_start', index, id: tc.id, name: tc.name }
    yield {
      type: 'tool_call_delta',
      index,
      argsTextDelta: JSON.stringify(tc.input),
    }
  }
  yield { type: 'done', response }
}
