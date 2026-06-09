import { createHash } from 'node:crypto'
import type { LLMChatParams, LLMResponse } from '../types.js'

/**
 * Pluggable response cache. The store receives the whole request, so it owns its
 * keying strategy: `MemoryCacheStore` hashes for exact matches, while
 * `SemanticCacheStore` embeds and matches by similarity.
 */
export interface CacheStore {
  get(params: LLMChatParams): Promise<LLMResponse | undefined>
  set(params: LLMChatParams, value: LLMResponse): Promise<void>
}

/** Deterministic JSON: object keys sorted recursively so key order can't vary the hash. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
  )
  return `{${entries.join(',')}}`
}

/**
 * Build a cache key from the request *intent* — system, messages, tools, output
 * budget, and routing hints. The concrete model the router happens to pick is
 * excluded so a cached answer is reused regardless of which backend produced it.
 */
export function cacheKey(params: LLMChatParams): string {
  const normalized = {
    system: params.system,
    messages: params.messages,
    tools: params.tools,
    maxTokens: params.maxTokens ?? null,
    routingHints: params.routingHints ?? null,
  }
  return createHash('sha256').update(stableStringify(normalized)).digest('hex')
}

/**
 * Flatten a request to the text that carries its meaning — system prompt, message
 * contents, and tool names. Used by semantic caches to embed the request.
 */
export function canonicalRequestText(params: LLMChatParams): string {
  const parts: string[] = [params.system]
  for (const msg of params.messages) {
    if (msg.content) parts.push(`${msg.role}: ${msg.content}`)
    for (const tc of msg.toolCalls ?? []) {
      parts.push(`${msg.role} calls ${tc.name}(${JSON.stringify(tc.input)})`)
    }
    for (const tr of msg.toolResults ?? []) {
      parts.push(`tool_result: ${JSON.stringify(tr.result ?? tr.error ?? '')}`)
    }
  }
  if (params.tools.length > 0) parts.push(`tools: ${params.tools.map((t) => t.name).join(',')}`)
  return parts.join('\n')
}

/** In-memory exact-match cache with optional bounded size (FIFO eviction). */
export class MemoryCacheStore implements CacheStore {
  private store = new Map<string, LLMResponse>()
  private maxEntries: number

  constructor(options: { maxEntries?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 1000
  }

  async get(params: LLMChatParams): Promise<LLMResponse | undefined> {
    return this.store.get(cacheKey(params))
  }

  async set(params: LLMChatParams, value: LLMResponse): Promise<void> {
    const key = cacheKey(params)
    if (this.store.has(key)) this.store.delete(key)
    this.store.set(key, value)
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value
      if (oldest === undefined) break
      this.store.delete(oldest)
    }
  }
}
