import { createHash } from 'node:crypto'
import type { LLMChatParams, LLMResponse } from '../types.js'

/**
 * Pluggable response cache. The bundled `MemoryCacheStore` is an exact-match
 * store keyed by a hash of the normalized request. A *semantic* cache (vector
 * similarity) is intentionally NOT bundled — supply your own `CacheStore` that
 * does embedding lookups if you want that. This interface is the seam.
 */
export interface CacheStore {
  get(key: string): Promise<LLMResponse | undefined>
  set(key: string, value: LLMResponse): Promise<void>
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
 * Build a cache key from the request *intent* — system, messages, tools,
 * output budget, and routing hints. The concrete model the router happens to
 * pick is deliberately excluded so a cached answer is reused regardless of
 * which backend produced it.
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

/** In-memory exact-match cache with optional bounded size (FIFO eviction). */
export class MemoryCacheStore implements CacheStore {
  private store = new Map<string, LLMResponse>()
  private maxEntries: number

  constructor(options: { maxEntries?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 1000
  }

  async get(key: string): Promise<LLMResponse | undefined> {
    return this.store.get(key)
  }

  async set(key: string, value: LLMResponse): Promise<void> {
    if (this.store.has(key)) this.store.delete(key)
    this.store.set(key, value)
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value
      if (oldest === undefined) break
      this.store.delete(oldest)
    }
  }
}
